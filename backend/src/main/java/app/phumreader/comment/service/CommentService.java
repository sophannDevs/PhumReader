package app.phumreader.comment.service;

import app.phumreader.comment.domain.CommentOrder;
import app.phumreader.comment.repository.CommentQueries;
import app.phumreader.comment.repository.CommentQueries.CommentInfo;
import app.phumreader.comment.repository.CommentQueries.CommentRow;
import app.phumreader.comment.repository.CommentQueries.Key;
import app.phumreader.comment.service.CommentViews.CommentAuthor;
import app.phumreader.comment.service.CommentViews.CommentLikeState;
import app.phumreader.comment.service.CommentViews.CommentView;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.episode.service.ReadingService;
import app.phumreader.series.service.CatalogRefs.EpisodeRef;
import app.phumreader.series.service.CatalogRefs.SeriesRef;
import app.phumreader.series.service.CatalogService;
import app.phumreader.user.domain.Role;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Comments on a series page or an episode, comment likes and reports to the admin queue (plan
 * P3-13). Posting on an episode needs access to it and respects its comments on/off setting.
 */
@Service
public class CommentService {

    /** Longest comment, as the website's composer counts it. */
    public static final int MAX_BODY = 500;

    /** The "Top" badge needs at least this many likes. */
    static final int TOP_MIN_LIKES = 10;

    static final int COMMENTS_PER_WINDOW = 10;
    static final Duration COMMENT_WINDOW = Duration.ofMinutes(10);
    static final int REPORTS_PER_HOUR = 20;

    /** What a report is about. */
    public enum TargetType {
        SERIES,
        EPISODE,
        COMMENT
    }

    private final CommentQueries queries;
    private final CatalogService catalog;
    private final ReadingService reading;
    private final RateLimiter limiter;
    private final Clock clock;

    public CommentService(
            CommentQueries queries,
            CatalogService catalog,
            ReadingService reading,
            RateLimiter limiter,
            Clock clock) {
        this.queries = queries;
        this.catalog = catalog;
        this.reading = reading;
        this.limiter = limiter;
        this.clock = clock;
    }

    /** A thread: the series page when {@code episode} is null, otherwise that episode. */
    public CursorPage<CommentView> list(
            String slug,
            @Nullable Integer episode,
            CommentOrder order,
            @Nullable String cursor,
            @Nullable Integer limit,
            @Nullable CurrentUser user) {
        SeriesRef series = catalog.require(slug);
        UUID episodeId = episode == null ? null : catalog.requireEpisode(series, episode).id();
        int size = Cursors.limit(limit);
        List<CommentRow> rows =
                queries.page(series.id(), episodeId, order, readKey(cursor, order), size + 1);
        List<CommentRow> page = rows.size() > size ? rows.subList(0, size) : rows;
        Optional<UUID> top = queries.topComment(series.id(), episodeId, TOP_MIN_LIKES);
        Set<UUID> liked =
                user == null
                        ? Set.of()
                        : queries.likedBy(user.id(), page.stream().map(CommentRow::id).toList());
        List<CommentView> items =
                page.stream()
                        .map(r ->
                                view(
                                        r,
                                        top.filter(r.id()::equals).isPresent(),
                                        liked.contains(r.id()),
                                        user,
                                        series.creatorId()))
                        .toList();
        String next = rows.size() > size ? key(page.getLast(), order) : null;
        return new CursorPage<>(items, next);
    }

    /**
     * Posts a comment (1-500 characters after trimming). 403 {@code comments_disabled} when the
     * creator turned comments off for the whole series (V21-02). On an episode: 402 when the reader
     * may not read it, 403 {@code comments_disabled} when the creator turned comments off for it.
     */
    @Transactional
    public CommentView post(CurrentUser user, String slug, @Nullable Integer episode, String body) {
        String text = body == null ? "" : body.strip();
        if (text.isEmpty()) {
            throw ApiException.invalidField("body", "blank", "Write something first.");
        }
        if (text.length() > MAX_BODY) {
            throw ApiException.invalidField(
                    "body", "too_long", "Comments can be at most " + MAX_BODY + " characters.");
        }
        SeriesRef series = catalog.require(slug);
        if (!series.commentsEnabled()) {
            throw ApiException.forbidden(
                    "comments_disabled", "Comments are turned off for this series.");
        }
        UUID episodeId = null;
        if (episode != null) {
            EpisodeRef ref = reading.requireReadable(series, episode, user);
            if (!ref.commentsEnabled()) {
                throw ApiException.forbidden(
                        "comments_disabled", "Comments are turned off for this episode.");
            }
            episodeId = ref.id();
        }
        limiter.acquire(
                "comment:" + user.id(), COMMENTS_PER_WINDOW, COMMENT_WINDOW, "too_many_comments");
        CommentRow row = queries.insert(series.id(), episodeId, user.id(), text, now());
        return view(row, false, false, user, series.creatorId());
    }

    /** Deletes a comment: its author, the creator of its series or an admin. */
    @Transactional
    public void delete(CurrentUser user, UUID commentId) {
        CommentInfo info = visible(commentId);
        boolean allowed =
                info.authorId().equals(user.id())
                        || info.seriesCreatorId().equals(user.id())
                        || user.hasRole(Role.ADMIN.name());
        if (!allowed) {
            throw ApiException.forbidden(
                    "forbidden", "Only its author or the series' creator can delete a comment.");
        }
        queries.markDeleted(commentId, now());
    }

    @Transactional
    public CommentLikeState like(CurrentUser user, UUID commentId, boolean liked) {
        visible(commentId);
        if (liked) {
            queries.like(user.id(), commentId, now());
        } else {
            queries.unlike(user.id(), commentId);
        }
        return new CommentLikeState(liked, queries.likes(commentId));
    }

    /**
     * Reports a series ({@code slug}), an episode ({@code slug} + {@code episode}) or a comment to
     * the admin queue. A second report on the same target while the first is open changes nothing.
     */
    @Transactional
    public void report(
            CurrentUser user,
            TargetType type,
            @Nullable String slug,
            @Nullable Integer episode,
            @Nullable UUID commentId,
            String reason,
            @Nullable String details) {
        UUID target =
                switch (type) {
                    case SERIES -> catalog.require(require(slug)).id();
                    case EPISODE ->
                            catalog.requireEpisode(catalog.require(require(slug)), require(episode))
                                    .id();
                    case COMMENT -> visible(require(commentId)).id();
                };
        limiter.acquire(
                "report:" + user.id(), REPORTS_PER_HOUR, Duration.ofHours(1), "too_many_reports");
        String detailText = details == null || details.isBlank() ? null : details.strip();
        queries.report(user.id(), type.name(), target, reason.strip(), detailText, now());
    }

    // ---------- helpers ----------

    private CommentInfo visible(UUID commentId) {
        return queries.info(commentId)
                .filter(CommentInfo::visible)
                .orElseThrow(
                        () -> ApiException.notFound("comment_not_found", "Comment not found."));
    }

    private static CommentView view(
            CommentRow r,
            boolean top,
            boolean liked,
            @Nullable CurrentUser user,
            UUID seriesCreatorId) {
        boolean mine = user != null && user.id().equals(r.authorId());
        boolean canDelete =
                user != null
                        && (mine
                                || user.id().equals(seriesCreatorId)
                                || user.hasRole(Role.ADMIN.name()));
        return new CommentView(
                r.id(),
                new CommentAuthor(r.authorName(), r.authorAvatar()),
                r.body(),
                r.likes(),
                r.createdAt().toInstant(),
                top,
                liked,
                mine,
                canDelete);
    }

    private static String key(CommentRow r, CommentOrder order) {
        String prefix = order == CommentOrder.TOP ? "ct" : "cn";
        return Cursors.encode(
                prefix + "|" + r.likes() + "|" + r.createdAt().toInstant() + "|" + r.id());
    }

    private static @Nullable Key readKey(@Nullable String cursor, CommentOrder order) {
        String text = Cursors.decode(cursor);
        if (text == null) {
            return null;
        }
        String[] parts = text.split("\\|", -1);
        String prefix = order == CommentOrder.TOP ? "ct" : "cn";
        try {
            if (parts.length == 4 && parts[0].equals(prefix)) {
                return new Key(
                        Long.parseLong(parts[1]),
                        Instant.parse(parts[2]).atOffset(ZoneOffset.UTC),
                        UUID.fromString(parts[3]));
            }
        } catch (IllegalArgumentException | DateTimeParseException ignored) {
            // falls through to the error below
        }
        throw ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
    }

    private static <T> T require(@Nullable T value) {
        if (value == null) {
            throw ApiException.badRequest("missing_target", "The report target is missing.");
        }
        return value;
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }
}
