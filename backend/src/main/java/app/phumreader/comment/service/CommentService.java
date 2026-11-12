package app.phumreader.comment.service;

import app.phumreader.comment.domain.CommentOrder;
import app.phumreader.comment.repository.CommentQueries;
import app.phumreader.comment.repository.CommentQueries.CommentInfo;
import app.phumreader.comment.repository.CommentQueries.CommentRow;
import app.phumreader.comment.repository.CommentQueries.FiledReport;
import app.phumreader.comment.repository.CommentQueries.Key;
import app.phumreader.comment.repository.CommentQueries.MyReportRow;
import app.phumreader.comment.service.CommentViews.CommentAuthor;
import app.phumreader.comment.service.CommentViews.CommentLikeState;
import app.phumreader.comment.service.CommentViews.CommentView;
import app.phumreader.comment.service.CommentViews.MyReport;
import app.phumreader.comment.service.CommentViews.ReportReceipt;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.episode.service.ReadingService;
import app.phumreader.notification.service.NotificationInbox;
import app.phumreader.series.service.CatalogRefs.EpisodeRef;
import app.phumreader.series.service.CatalogRefs.SeriesRef;
import app.phumreader.series.service.CatalogService;
import app.phumreader.user.domain.Role;
import app.phumreader.user.service.BlockService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
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
        COMMENT,
        /** An account (the creator profile's Report). */
        USER
    }

    private final CommentQueries queries;
    private final CatalogService catalog;
    private final ReadingService reading;
    private final RateLimiter limiter;
    private final NotificationInbox inbox;
    private final BlockService blocks;
    private final Clock clock;

    public CommentService(
            CommentQueries queries,
            CatalogService catalog,
            ReadingService reading,
            RateLimiter limiter,
            NotificationInbox inbox,
            BlockService blocks,
            Clock clock) {
        this.queries = queries;
        this.catalog = catalog;
        this.reading = reading;
        this.limiter = limiter;
        this.inbox = inbox;
        this.blocks = blocks;
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
        Set<UUID> blocked =
                user == null
                        ? Set.of()
                        : blocks.blockedAmong(
                                user.id(), page.stream().map(CommentRow::authorId).toList());
        List<CommentView> items =
                page.stream()
                        .map(r ->
                                view(
                                        r,
                                        top.filter(r.id()::equals).isPresent(),
                                        liked.contains(r.id()),
                                        blocked.contains(r.authorId()),
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
        return view(row, false, false, false, user, series.creatorId());
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

    /**
     * Likes or unlikes a comment. A new like from someone other than the author goes to the
     * author's notifications inbox (one item per comment and day with the count, V21-03); taking a
     * like back changes no item.
     */
    @Transactional
    public CommentLikeState like(CurrentUser user, UUID commentId, boolean liked) {
        CommentInfo info = visible(commentId);
        if (liked) {
            OffsetDateTime at = now();
            if (queries.like(user.id(), commentId, at)
                    && !blocks.isBlocked(info.authorId(), user.id())) {
                inbox.commentLiked(user.id(), commentId, at.toInstant());
            }
        } else {
            queries.unlike(user.id(), commentId);
        }
        return new CommentLikeState(liked, queries.likes(commentId));
    }

    /** Report reasons per kind of target (the website's keys, demo-data {@code reportReasons}). */
    private static final Set<String> COMMENT_REASONS =
            Set.of("spam", "harass", "hate", "sexual", "violence", "spoiler", "other");

    private static final Set<String> CONTENT_REASONS =
            Set.of("copyright", "spam", "harass", "hate", "sexual", "violence", "rating", "other");

    private static final Set<String> ACCOUNT_REASONS =
            Set.of("spam", "impersonate", "harass", "other");

    /** These reasons need a few words from the reporter. */
    private static final Set<String> NEEDS_DETAILS = Set.of("other", "copyright");

    static final int MIN_DETAILS = 10;

    /**
     * Reports a series ({@code slug}), an episode ({@code slug} + {@code episode}), a comment
     * ({@code id}) or an account ({@code id}) to the admin queue and returns the case number. A
     * second report on the same target while the first is open changes nothing and returns the
     * first case. 400 {@code invalid_reason} (the reason is not one for this kind of target) and
     * {@code details_required} (other and copyright need at least {@value #MIN_DETAILS}
     * characters). Accounts: 400 {@code cannot_report_self}, 404 {@code user_not_found} (no such
     * account, or a deleted one).
     */
    @Transactional
    public ReportReceipt report(
            CurrentUser user,
            TargetType type,
            @Nullable String slug,
            @Nullable Integer episode,
            @Nullable UUID id,
            String reason,
            @Nullable String details) {
        String key = reason.strip().toLowerCase(Locale.ROOT);
        String detailText = details == null || details.isBlank() ? null : details.strip();
        UUID target;
        UUID accused;
        switch (type) {
            case SERIES -> {
                SeriesRef series = catalog.require(require(slug));
                target = series.id();
                accused = series.creatorId();
            }
            case EPISODE -> {
                SeriesRef series = catalog.require(require(slug));
                target = catalog.requireEpisode(series, require(episode)).id();
                accused = series.creatorId();
            }
            case COMMENT -> {
                CommentInfo info = visible(require(id));
                target = info.id();
                accused = info.authorId();
            }
            case USER -> {
                UUID account = require(id);
                if (account.equals(user.id())) {
                    throw ApiException.badRequest(
                            "cannot_report_self", "You cannot report yourself.");
                }
                if (!queries.accountExists(account)) {
                    throw ApiException.notFound("user_not_found", "No such account.");
                }
                target = account;
                accused = account;
            }
            default -> throw new IllegalStateException("Unknown report target " + type);
        }
        Set<String> allowed =
                switch (type) {
                    case COMMENT -> COMMENT_REASONS;
                    case USER -> ACCOUNT_REASONS;
                    default -> CONTENT_REASONS;
                };
        if (!allowed.contains(key)) {
            throw ApiException.invalidField(
                    "reason", "invalid_reason", "Choose one of the listed reasons.");
        }
        if (NEEDS_DETAILS.contains(key)
                && (detailText == null || detailText.length() < MIN_DETAILS)) {
            throw ApiException.invalidField(
                    "details",
                    "details_required",
                    "Tell us a little more (at least " + MIN_DETAILS + " characters).");
        }
        limiter.acquire(
                "report:" + user.id(), REPORTS_PER_HOUR, Duration.ofHours(1), "too_many_reports");
        FiledReport filed =
                queries.report(user.id(), type.name(), target, accused, key, detailText, now());
        // Never offer "Also block" for yourself.
        boolean self = user.id().equals(filed.accusedId());
        return new ReportReceipt(
                filed.caseNumber(),
                self ? null : filed.accusedId(),
                self ? null : filed.accusedName());
    }

    /** The reader's own reports, newest first (at most 50): Settings > Your reports. */
    public List<MyReport> myReports(CurrentUser user) {
        return queries.myReports(user.id(), 50).stream().map(CommentService::view).toList();
    }

    private static MyReport view(MyReportRow r) {
        String status =
                switch (r.status()) {
                    case "RESOLVED" -> "removed";
                    case "DISMISSED" -> "no_violation";
                    default -> "in_review";
                };
        return new MyReport(
                r.caseNumber(),
                r.targetType().toLowerCase(Locale.ROOT),
                r.seriesTitle(),
                r.episodeNumber(),
                r.accusedName(),
                r.reason(),
                status,
                r.createdAt().toInstant());
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
            boolean blocked,
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
                new CommentAuthor(r.authorId(), r.authorName(), r.authorAvatar()),
                r.body(),
                r.likes(),
                r.createdAt().toInstant(),
                top,
                liked,
                mine,
                canDelete,
                blocked);
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
