package app.phumreader.series.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.jobs.JobLock;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.media.domain.UploadKind;
import app.phumreader.media.service.MediaService;
import app.phumreader.media.service.MediaService.ReadyImage;
import app.phumreader.notification.service.NotificationEvents;
import app.phumreader.search.service.SearchEvents;
import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.ReviewDecision;
import app.phumreader.series.domain.ReviewItem;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.domain.SeriesVisibility;
import app.phumreader.series.repository.CreatorQueries.EditRow;
import app.phumreader.series.repository.CreatorQueries.ReviewRow;
import app.phumreader.series.repository.CreatorWrites;
import app.phumreader.series.repository.CreatorWrites.EpisodeRow;
import app.phumreader.series.repository.CreatorWrites.EpisodeValues;
import app.phumreader.series.repository.CreatorWrites.PanelRow;
import app.phumreader.series.repository.CreatorWrites.SeriesValues;
import app.phumreader.series.service.CreatorInput.Block;
import app.phumreader.series.service.CreatorInput.EpisodeInput;
import app.phumreader.series.service.CreatorInput.FastPass;
import app.phumreader.series.service.CreatorInput.PublishMode;
import app.phumreader.series.service.CreatorInput.SeriesFastPass;
import app.phumreader.series.service.CreatorInput.SeriesInput;
import app.phumreader.series.service.CreatorViews.BlockView;
import app.phumreader.series.service.CreatorViews.CreatorEpisode;
import app.phumreader.series.service.CreatorViews.EpisodeEdit;
import app.phumreader.series.service.CreatorViews.PanelView;
import app.phumreader.series.service.CreatorViews.SeriesEdit;
import java.text.Normalizer;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * Creators write series and episodes (plan P3-14). Every method checks that the series is the
 * caller's own ({@link CreatorService#requireOwnedSeries}).
 */
@Service
public class CreatorContentService {

    private static final Logger log = LoggerFactory.getLogger(CreatorContentService.class);

    /** A19: at most 100 images and 200 MB per episode. */
    static final int MAX_IMAGES = 100;

    static final long MAX_EPISODE_BYTES = 200L * 1024 * 1024;

    /** A3: default Fast Pass is 5 coins, free after 7 days. */
    static final int DEFAULT_PRICE = 5;

    static final int DEFAULT_FREE_DAYS = 7;

    /** V21-02: a new series has Fast Pass on, 3 episodes ahead. */
    static final SeriesFastPass DEFAULT_SERIES_FAST_PASS = new SeriesFastPass(true, 3);

    private final CreatorService creators;
    private final CreatorWrites writes;
    private final MediaService media;
    private final SearchEvents searchEvents;
    private final NotificationEvents notifications;
    private final CatalogService catalog;
    private final JobLock lock;
    private final JsonMapper json;
    private final Clock clock;

    public CreatorContentService(
            CreatorService creators,
            CreatorWrites writes,
            MediaService media,
            SearchEvents searchEvents,
            NotificationEvents notifications,
            CatalogService catalog,
            JobLock lock,
            JsonMapper json,
            Clock clock) {
        this.creators = creators;
        this.writes = writes;
        this.media = media;
        this.searchEvents = searchEvents;
        this.notifications = notifications;
        this.catalog = catalog;
        this.lock = lock;
        this.json = json;
        this.clock = clock;
    }

    // ================================================================ series

    @Transactional
    public SeriesEdit createSeries(CurrentUser user, SeriesInput in) {
        creators.requireCreator(user.id());
        if (in.type() == null) {
            throw ApiException.invalidField("type", "required", "Choose comic or web novel.");
        }
        UUID id = UUID.randomUUID();
        SeriesValues values = seriesValues(user, in, null, null);
        writes.insertSeries(id, user.id(), uniqueSlug(in.title()), in.type(), values);
        changed(id);
        return creators.ownedSeries(user, id);
    }

    @Transactional
    public SeriesEdit updateSeries(CurrentUser user, UUID id, SeriesInput in) {
        EditRow row = creators.requireOwnedSeries(user, id);
        if (in.type() != null && in.type() != row.type()) {
            throw ApiException.invalidField(
                    "type", "type_fixed", "A series cannot change between comic and novel.");
        }
        if (row.visibility() == SeriesVisibility.PUBLISHED
                && in.coverUploadId() == null
                && row.coverUrl() == null) {
            throw ApiException.invalidField(
                    "coverUploadId", "required", "A live series needs a cover.");
        }
        writes.updateSeries(id, seriesValues(user, in, row.coverUrl(), row.bannerUrl()));
        changed(id);
        return creators.ownedSeries(user, id);
    }

    /**
     * Puts a series live again that an admin approved before (V21-01): a series that never went
     * live answers 409 {@code review_required} and goes through {@link #submitSeries} instead.
     * Needs a summary and a cover; 403 when an admin hid it.
     */
    @Transactional
    public SeriesEdit publishSeries(CurrentUser user, UUID id) {
        EditRow row = creators.requireOwnedSeries(user, id);
        requireNotHiddenOrInReview(row);
        if (!row.launched()) {
            throw ApiException.conflict(
                    "review_required",
                    "A new series goes live after a review. Submit it for review instead.");
        }
        requireSummaryAndCover(row, "publishing");
        writes.setVisibility(id, SeriesVisibility.PUBLISHED.name(), clock.instant());
        changed(id);
        return creators.ownedSeries(user, id);
    }

    /** Takes the series back to a draft (readers no longer see it). */
    @Transactional
    public SeriesEdit unpublishSeries(CurrentUser user, UUID id) {
        EditRow row = creators.requireOwnedSeries(user, id);
        requireNotHiddenOrInReview(row);
        writes.setVisibility(id, SeriesVisibility.DRAFT.name(), clock.instant());
        changed(id);
        return creators.ownedSeries(user, id);
    }

    /**
     * Deletes the series for good (V21-02), only while none of its episodes was ever published:
     * drafts and future scheduled episodes go with it. Otherwise 409 {@code
     * has_published_episodes}: readers may have paid for an episode, so such a series can only be
     * hidden.
     */
    @Transactional
    public void deleteSeries(CurrentUser user, UUID id) {
        creators.requireOwnedSeries(user, id);
        if (writes.lockAndCheckEverPublished(id, clock.instant())) {
            throw ApiException.conflict(
                    "has_published_episodes",
                    "This series has published episodes, so it cannot be deleted. Hide it"
                            + " instead.");
        }
        writes.deleteSeries(id);
        changed(id);
    }

    // ================================================================ review (V21-01)

    /**
     * Sends the series to the admins' review queue: a draft (Submit for review) or a series the
     * admin sent back, once every requested change is marked fixed (Resubmit). Needs a summary and
     * a cover, like publishing.
     */
    @Transactional
    public SeriesEdit submitSeries(CurrentUser user, UUID id) {
        EditRow row = creators.requireOwnedSeries(user, id);
        if (row.visibility() == SeriesVisibility.PUBLISHED) {
            throw ApiException.conflict("already_published", "This series is already live.");
        }
        if (row.visibility() != SeriesVisibility.CHANGES) {
            requireNotHiddenOrInReview(row);
        }
        requireSummaryAndCover(row, "submitting it for review");
        if (row.visibility() == SeriesVisibility.CHANGES
                && openChanges(row).items().stream().anyMatch(i -> !i.fixed())) {
            throw ApiException.conflict(
                    "changes_not_fixed",
                    "Mark every requested change fixed before submitting the series again.");
        }
        if (!writes.moveSeries(id, row.visibility().name(), SeriesVisibility.REVIEW.name())) {
            throw ApiException.conflict(
                    "already_in_review", "This series is already waiting for a review.");
        }
        writes.insertReview(id, clock.instant());
        return creators.ownedSeries(user, id);
    }

    /** Mark fixed (Manage series): one change the admin asked for is done. */
    @Transactional
    public SeriesEdit markFixed(CurrentUser user, UUID id, String item) {
        EditRow row = creators.requireOwnedSeries(user, id);
        ReviewItem change = ReviewItem.parse(item);
        if (!writes.markFixed(openChanges(row).id(), change.key(), clock.instant())) {
            throw notRequested();
        }
        return creators.ownedSeries(user, id);
    }

    /** Undoes Mark fixed. */
    @Transactional
    public SeriesEdit markNotFixed(CurrentUser user, UUID id, String item) {
        EditRow row = creators.requireOwnedSeries(user, id);
        ReviewItem change = ReviewItem.parse(item);
        if (!writes.markNotFixed(openChanges(row).id(), change.key())) {
            throw notRequested();
        }
        return creators.ownedSeries(user, id);
    }

    /**
     * The review that asked for changes, while the series waits for them; 409 {@code
     * no_changes_requested} otherwise.
     */
    private ReviewRow openChanges(EditRow series) {
        return Optional.of(series)
                .filter(s -> s.visibility() == SeriesVisibility.CHANGES)
                .flatMap(s -> creators.latestReview(s.id()))
                .filter(r -> ReviewDecision.CHANGES.name().equals(r.decision()))
                .orElseThrow(() ->
                        ApiException.conflict(
                                "no_changes_requested",
                                "No changes are waiting to be made on this series."));
    }

    private static ApiException notRequested() {
        return ApiException.notFound(
                "item_not_requested", "The reviewer did not ask to change this.");
    }

    /**
     * 403 {@code hidden_by_admin} for a series an admin took down; 409 {@code already_in_review}
     * while it waits for a review and {@code changes_requested} while the admin's changes are open:
     * only the admin's decision or a resubmit moves it on.
     */
    private static void requireNotHiddenOrInReview(EditRow row) {
        switch (row.visibility()) {
            case HIDDEN ->
                    throw ApiException.forbidden(
                            "hidden_by_admin",
                            "This series was hidden by PhumReader. Contact support.");
            case REVIEW ->
                    throw ApiException.conflict(
                            "already_in_review", "This series is already waiting for a review.");
            case CHANGES ->
                    throw ApiException.conflict(
                            "changes_requested",
                            "Changes were requested: fix them and submit the series again.");
            case DRAFT, PUBLISHED -> {}
        }
    }

    private static void requireSummaryAndCover(EditRow row, String before) {
        if (row.summary().isBlank()) {
            throw ApiException.invalidField(
                    "summary", "required", "Write a summary before " + before + ".");
        }
        if (row.coverUrl() == null) {
            throw ApiException.invalidField(
                    "coverUploadId", "required", "Add a cover before " + before + ".");
        }
    }

    private SeriesValues seriesValues(
            CurrentUser user,
            SeriesInput in,
            @Nullable String keepCover,
            @Nullable String keepBanner) {
        String cover =
                in.coverUploadId() == null
                        ? keepCover
                        : image(user, in.coverUploadId(), UploadKind.COVER, "coverUploadId").url();
        String banner =
                in.bannerUploadId() == null
                        ? keepBanner
                        : image(user, in.bannerUploadId(), UploadKind.BANNER, "bannerUploadId")
                                .url();
        List<String> tags =
                in.tags() == null
                        ? List.of()
                        : new ArrayList<>(
                                new LinkedHashSet<>(
                                        in.tags().stream()
                                                .map(t -> t.trim().toLowerCase(Locale.ROOT))
                                                .filter(t -> !t.isEmpty())
                                                .toList()));
        short genre = genre(in);
        SeriesStatus status = in.status() == null ? SeriesStatus.ONGOING : in.status();
        SeriesFastPass fastPass = in.fastPass() == null ? DEFAULT_SERIES_FAST_PASS : in.fastPass();
        // The break message only belongs to a series on a break; any other status drops it.
        String breakMessage =
                status != SeriesStatus.HIATUS
                                || in.breakMessage() == null
                                || in.breakMessage().isBlank()
                        ? null
                        : in.breakMessage().strip();
        return new SeriesValues(
                in.title().trim(),
                in.summary() == null ? "" : in.summary().trim(),
                genre,
                secondGenre(in, genre),
                List.copyOf(new LinkedHashSet<>(in.languages())),
                in.ageRating() == null ? AgeRating.ALL : in.ageRating(),
                status,
                updateDays(in.updateDays()),
                in.releaseHour(),
                fastPass.on(),
                fastPass.ahead(),
                in.commentsEnabled() == null || in.commentsEnabled(),
                breakMessage,
                cover,
                banner,
                tags);
    }

    /** The days in week order; 400 {@code duplicate_day} when a day comes twice. */
    private static List<DayOfWeek> updateDays(@Nullable List<Weekday> days) {
        if (days == null) {
            return List.of();
        }
        EnumSet<DayOfWeek> set = EnumSet.noneOf(DayOfWeek.class);
        for (Weekday day : days) {
            if (!set.add(day.day())) {
                throw ApiException.invalidField(
                        "updateDays", "duplicate_day", "Choose each update day once.");
            }
        }
        return List.copyOf(set);
    }

    /**
     * The second genre's id; 400 {@code unknown_genre} for a slug that is not in the list and
     * {@code same_as_genre} when it is the main genre.
     */
    private @Nullable Short secondGenre(SeriesInput in, short mainGenre) {
        if (in.secondGenre() == null || in.secondGenre().isBlank()) {
            return null;
        }
        short id =
                writes.genreId(in.secondGenre().strip())
                        .orElseThrow(() ->
                                ApiException.invalidField(
                                        "secondGenre",
                                        "unknown_genre",
                                        "Choose a genre from the list."));
        if (id == mainGenre) {
            throw ApiException.invalidField(
                    "secondGenre",
                    "same_as_genre",
                    "Choose a second genre that is not the main genre.");
        }
        return id;
    }

    private short genre(SeriesInput in) {
        return writes.genreId(in.genre())
                .orElseThrow(() ->
                        ApiException.invalidField(
                                "genre", "unknown_genre", "Choose a genre from the list."));
    }

    private String uniqueSlug(String title) {
        String base =
                Normalizer.normalize(title, Normalizer.Form.NFD)
                        .replaceAll("[^\\p{ASCII}]", "")
                        .toLowerCase(Locale.ROOT)
                        .replaceAll("[^a-z0-9]+", "-")
                        .replaceAll("^-+|-+$", "");
        if (base.length() > 60) {
            base = base.substring(0, 60).replaceAll("-+$", "");
        }
        if (base.isEmpty()) {
            base = "series";
        }
        String slug = base;
        for (int n = 2; writes.slugTaken(slug); n++) {
            slug = base + "-" + n;
        }
        return slug;
    }

    // ================================================================ episodes

    @Transactional(readOnly = true)
    public List<CreatorEpisode> episodes(CurrentUser user, UUID seriesId) {
        creators.requireOwnedSeries(user, seriesId);
        return writes.episodes(seriesId).stream().map(CreatorContentService::row).toList();
    }

    private static CreatorEpisode row(EpisodeRow e) {
        return new CreatorEpisode(
                e.number(),
                e.title(),
                e.status().toLowerCase(Locale.ROOT),
                e.publishedAt(),
                e.freeAt(),
                e.priceCoins(),
                e.thumbnailUrl(),
                e.commentsEnabled(),
                e.hiddenAt(),
                e.views(),
                e.likes());
    }

    @Transactional(readOnly = true)
    public EpisodeEdit episode(CurrentUser user, UUID seriesId, int number) {
        creators.requireOwnedSeries(user, seriesId);
        return edit(requireEpisode(seriesId, number));
    }

    @Transactional
    public EpisodeEdit createEpisode(CurrentUser user, UUID seriesId, EpisodeInput in) {
        EditRow series = creators.requireOwnedSeries(user, seriesId);
        int number = in.number() == null ? writes.nextNumber(seriesId) : in.number();
        if (writes.episode(seriesId, number).isPresent()) {
            throw ApiException.invalidField(
                    "number", "number_taken", "Episode " + number + " already exists.");
        }
        UUID id = UUID.randomUUID();
        Content content = content(user, series, in);
        Stored stored = state(in, fastPassOf(in, series), null);
        writes.insertEpisode(id, seriesId, number, values(user, in, stored, null));
        saveContent(id, series.type(), content);
        afterWrite(seriesId, stored.status());
        if (stored.status().equals("PUBLISHED")) {
            notifications.episodePublished(id);
        }
        return edit(requireEpisode(seriesId, number));
    }

    @Transactional
    public EpisodeEdit updateEpisode(CurrentUser user, UUID seriesId, int number, EpisodeInput in) {
        EditRow series = creators.requireOwnedSeries(user, seriesId);
        EpisodeRow current = requireEpisode(seriesId, number);
        if (in.number() != null && in.number() != number) {
            throw ApiException.invalidField("number", "number_fixed", "The number cannot change.");
        }
        if (Boolean.TRUE.equals(in.useSeriesFastPass())) {
            throw ApiException.invalidField(
                    "useSeriesFastPass",
                    "new_episodes_only",
                    "The series' Fast Pass only sets new episodes; send fastPass instead.");
        }
        Content content = content(user, series, in);
        Stored stored = state(in, in.fastPass(), current);
        writes.updateEpisode(current.id(), values(user, in, stored, current.thumbnailUrl()));
        saveContent(current.id(), series.type(), content);
        afterWrite(seriesId, stored.status());
        // Only the step to live announces the episode; saving a live one again does not.
        if (stored.status().equals("PUBLISHED") && !current.status().equals("PUBLISHED")) {
            notifications.episodePublished(current.id());
        }
        return edit(requireEpisode(seriesId, number));
    }

    /** Drafts and scheduled episodes can be deleted; a live one has readers and unlocks. */
    @Transactional
    public void deleteEpisode(CurrentUser user, UUID seriesId, int number) {
        creators.requireOwnedSeries(user, seriesId);
        EpisodeRow current = requireEpisode(seriesId, number);
        if (current.status().equals("PUBLISHED") || current.status().equals("HIDDEN")) {
            throw ApiException.conflict(
                    "episode_published", "A published episode cannot be deleted.");
        }
        writes.deleteEpisode(current.id());
    }

    /**
     * The creator hides a live episode from readers (V21-02): it leaves the lists and the reader,
     * also for readers who unlocked it, until it is shown again; numbers don't shift. Hiding it
     * again keeps the first time. 409 {@code episode_not_published} for drafts and scheduled
     * episodes, {@code episode_hidden} when an admin took it down.
     */
    @Transactional
    public CreatorEpisode hideEpisode(CurrentUser user, UUID seriesId, int number) {
        creators.requireOwnedSeries(user, seriesId);
        EpisodeRow current = requireLive(seriesId, number);
        writes.hideEpisode(current.id(), clock.instant());
        catalog.refreshHome();
        return row(requireEpisode(seriesId, number));
    }

    /** Readers see a hidden episode again; showing a visible one changes nothing. */
    @Transactional
    public CreatorEpisode showEpisode(CurrentUser user, UUID seriesId, int number) {
        creators.requireOwnedSeries(user, seriesId);
        EpisodeRow current = requireLive(seriesId, number);
        if (current.hiddenAt() != null) {
            writes.showEpisode(current.id());
            catalog.refreshHome();
        }
        return row(requireEpisode(seriesId, number));
    }

    /** A published episode that the admins did not take down. */
    private EpisodeRow requireLive(UUID seriesId, int number) {
        EpisodeRow e = requireEpisode(seriesId, number);
        if (e.status().equals("HIDDEN")) {
            throw ApiException.conflict(
                    "episode_hidden",
                    "An admin took this episode down; only PhumReader can put it back.");
        }
        if (!e.status().equals("PUBLISHED")) {
            throw ApiException.conflict(
                    "episode_not_published", "Only a published episode can be hidden or shown.");
        }
        return e;
    }

    private EpisodeRow requireEpisode(UUID seriesId, int number) {
        return writes.episode(seriesId, number)
                .orElseThrow(
                        () -> ApiException.notFound("episode_not_found", "Episode not found."));
    }

    /** The episode's content after checking the uploads and the rules for its type. */
    private record Content(List<PanelRow> panels, @Nullable String blocksJson, int words) {}

    private Content content(CurrentUser user, EditRow series, EpisodeInput in) {
        boolean live = in.publish().mode() != PublishMode.DRAFT;
        if (series.type() == SeriesType.COMIC) {
            if (in.blocks() != null && !in.blocks().isEmpty()) {
                throw ApiException.invalidField(
                        "blocks", "not_for_comics", "A comic has panels, not text.");
            }
            List<UUID> ids = in.imageUploadIds() == null ? List.of() : in.imageUploadIds();
            if (ids.size() > MAX_IMAGES) {
                throw ApiException.invalidField(
                        "imageUploadIds", "too_many_images", "At most 100 images per episode.");
            }
            if (live && ids.isEmpty()) {
                throw ApiException.invalidField(
                        "imageUploadIds", "required", "Add at least one panel.");
            }
            List<ReadyImage> images =
                    media.readyImages(user.id(), ids, UploadKind.PANEL, "imageUploadIds");
            List<PanelRow> panels = new ArrayList<>();
            long bytes = 0;
            int n = 1;
            for (ReadyImage img : images) {
                bytes += img.bytes();
                panels.add(
                        new PanelRow(
                                img.id(),
                                img.url(),
                                img.width(),
                                img.height(),
                                in.title().trim() + " – panel " + n++));
            }
            if (bytes > MAX_EPISODE_BYTES) {
                throw ApiException.invalidField(
                        "imageUploadIds", "episode_too_large", "An episode can be at most 200 MB.");
            }
            return new Content(panels, null, 0);
        }
        if (in.imageUploadIds() != null && !in.imageUploadIds().isEmpty()) {
            throw ApiException.invalidField(
                    "imageUploadIds", "not_for_novels", "A chapter has text, not panels.");
        }
        List<Block> blocks = in.blocks() == null ? List.of() : in.blocks();
        int words = 0;
        boolean hasText = false;
        List<BlockView> clean = new ArrayList<>();
        for (Block b : blocks) {
            if (b.type().equals("scene-break")) {
                clean.add(new BlockView("scene-break", null));
                continue;
            }
            String text = b.text() == null ? "" : b.text().trim();
            if (text.isEmpty()) {
                continue;
            }
            hasText = true;
            words += text.split("\\s+").length;
            clean.add(new BlockView(b.type(), text));
        }
        if (live && !hasText) {
            throw ApiException.invalidField(
                    "blocks", "required", "Write the chapter before publishing.");
        }
        if (clean.isEmpty()) {
            return new Content(List.of(), null, 0);
        }
        try {
            return new Content(List.of(), json.writeValueAsString(clean), words);
        } catch (JacksonException e) {
            throw new IllegalStateException(e);
        }
    }

    private void saveContent(UUID episodeId, SeriesType type, Content c) {
        if (type == SeriesType.COMIC) {
            writes.replacePanels(episodeId, c.panels());
        } else {
            writes.replaceChapter(episodeId, c.blocksJson(), c.words());
        }
    }

    /** Status, release time and Fast Pass dates that follow from the request. */
    private record Stored(
            String status,
            @Nullable Instant publishedAt,
            @Nullable Instant freeAt,
            @Nullable Integer price,
            @Nullable Integer days) {}

    /**
     * The Fast Pass of a new episode: {@code fastPass} as sent, or with {@code useSeriesFastPass}
     * the series' switch (V21-02): on, Fast Pass at the default price, free after ceil(ahead * 7 /
     * update days) days; off, free.
     */
    private static @Nullable FastPass fastPassOf(EpisodeInput in, EditRow series) {
        if (!Boolean.TRUE.equals(in.useSeriesFastPass())) {
            return in.fastPass();
        }
        if (in.fastPass() != null) {
            throw ApiException.invalidField(
                    "fastPass",
                    "not_with_series_fast_pass",
                    "Send either fastPass or useSeriesFastPass, not both.");
        }
        if (!series.fastPass()) {
            return null;
        }
        return new FastPass(
                DEFAULT_PRICE, freeAfterDays(series.fastPassAhead(), series.updateDays().size()));
    }

    /**
     * Days until a new Fast Pass episode is free when readers can buy {@code ahead} episodes ahead
     * of a series that updates {@code updateDays} times a week (a weekly series, 3 ahead: 21).
     */
    static int freeAfterDays(int ahead, int updateDays) {
        return Math.ceilDiv(ahead * 7, Math.max(1, updateDays));
    }

    private Stored state(EpisodeInput in, @Nullable FastPass fp, @Nullable EpisodeRow current) {
        if (current != null && current.status().equals("HIDDEN")) {
            throw ApiException.conflict(
                    "episode_hidden", "An admin took this episode down; it cannot be edited.");
        }
        Instant now = clock.instant();
        Integer price =
                fp == null ? null : fp.priceCoins() == null ? DEFAULT_PRICE : fp.priceCoins();
        Integer days =
                fp == null
                        ? null
                        : fp.freeAfterDays() == null ? DEFAULT_FREE_DAYS : fp.freeAfterDays();

        if (current != null && current.status().equals("PUBLISHED")) {
            if (in.publish().mode() != PublishMode.NOW) {
                throw ApiException.conflict(
                        "episode_published",
                        "A published episode cannot go back to a draft or be rescheduled.");
            }
            Instant at = current.publishedAt();
            return new Stored("PUBLISHED", at, free(at, days), price, days);
        }
        return switch (in.publish().mode()) {
            case DRAFT -> new Stored("DRAFT", null, null, price, days);
            case NOW -> new Stored("PUBLISHED", now, free(now, days), price, days);
            case SCHEDULED -> {
                Instant at = in.publish().at();
                if (at == null) {
                    throw ApiException.invalidField(
                            "publish.at", "required", "Choose when to publish.");
                }
                at = at.truncatedTo(ChronoUnit.SECONDS);
                if (!at.isAfter(now)) {
                    throw ApiException.invalidField(
                            "publish.at", "schedule_in_past", "Choose a time in the future.");
                }
                yield new Stored("SCHEDULED", at, free(at, days), price, days);
            }
        };
    }

    private static @Nullable Instant free(Instant releasedAt, @Nullable Integer days) {
        return days == null ? null : releasedAt.plus(days, ChronoUnit.DAYS);
    }

    private EpisodeValues values(
            CurrentUser user, EpisodeInput in, Stored s, @Nullable String keepThumbnail) {
        // Without a new upload the saved thumbnail stays.
        String thumb =
                in.thumbnailUploadId() == null
                        ? keepThumbnail
                        : image(
                                        user,
                                        in.thumbnailUploadId(),
                                        UploadKind.THUMBNAIL,
                                        "thumbnailUploadId")
                                .url();
        String note =
                in.creatorNote() == null || in.creatorNote().isBlank()
                        ? null
                        : in.creatorNote().trim();
        return new EpisodeValues(
                in.title().trim(),
                s.status(),
                s.publishedAt(),
                s.freeAt(),
                s.price(),
                s.days(),
                thumb,
                note,
                in.commentsEnabled() == null || in.commentsEnabled());
    }

    private EpisodeEdit edit(EpisodeRow e) {
        List<PanelView> panels =
                writes.panels(e.id()).stream()
                        .map(p -> new PanelView(p.uploadId(), p.url(), p.width(), p.height()))
                        .toList();
        List<BlockView> blocks = List.of();
        int words = 0;
        var chapter = writes.chapter(e.id());
        if (chapter.isPresent()) {
            words = chapter.get().wordCount();
            try {
                blocks =
                        json.readValue(
                                chapter.get().blocksJson(),
                                json.getTypeFactory()
                                        .constructCollectionType(List.class, BlockView.class));
            } catch (JacksonException ex) {
                throw new IllegalStateException(ex);
            }
        }
        Integer days = e.fastPassDays();
        if (days == null && e.freeAt() != null && e.publishedAt() != null) {
            days = (int) Math.max(1, Duration.between(e.publishedAt(), e.freeAt()).toDays());
        }
        return new EpisodeEdit(
                e.number(),
                e.title(),
                e.status().toLowerCase(Locale.ROOT),
                e.publishedAt(),
                e.freeAt(),
                e.priceCoins(),
                days,
                e.thumbnailUrl(),
                e.creatorNote(),
                e.commentsEnabled(),
                e.hiddenAt(),
                panels,
                blocks,
                words);
    }

    private ReadyImage image(CurrentUser user, UUID id, UploadKind kind, String field) {
        return media.readyImage(user.id(), id, kind, field);
    }

    // ================================================================ publishing

    private void afterWrite(UUID seriesId, String status) {
        if (status.equals("PUBLISHED")) {
            changed(seriesId);
        }
    }

    private void changed(UUID seriesId) {
        searchEvents.seriesChanged("CHANGED", List.of(seriesId));
        catalog.refreshHome();
    }

    /** Makes scheduled episodes live when their time has come; returns how many went live. */
    @Transactional
    public int publishDueEpisodes() {
        List<CreatorWrites.Published> due = writes.publishDue(clock.instant());
        if (!due.isEmpty()) {
            searchEvents.seriesChanged(
                    "CHANGED",
                    due.stream()
                            .map(CreatorWrites.Published::seriesId)
                            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)));
            due.forEach(p -> notifications.episodePublished(p.episodeId()));
            catalog.refreshHome();
        }
        return due.size();
    }

    /** Every 30 seconds, on one instance at a time. */
    @Scheduled(
            fixedDelayString = "${phumreader.creator.publish-interval:30s}",
            initialDelayString = "15s")
    void publishDueOnSchedule() {
        try {
            lock.runExclusively(
                    "publish-scheduled-episodes",
                    Duration.ofMinutes(2),
                    () -> {
                        int n = publishDueEpisodes();
                        if (n > 0) {
                            log.info("Published {} scheduled episode(s)", n);
                        }
                    });
        } catch (RuntimeException e) {
            log.warn("Publishing scheduled episodes failed, will retry: {}", e.toString());
        }
    }
}
