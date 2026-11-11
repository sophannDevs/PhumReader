package app.phumreader.admin.service;

import app.phumreader.admin.domain.ContentType;
import app.phumreader.admin.domain.FlagKind;
import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.SeriesType;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the admin API returns. States are lower case, like the rest of the API. */
public final class AdminViews {

    private AdminViews() {}

    /**
     * @param status active, banned, deletion_pending or deleted
     * @param roles READER, CREATOR, ADMIN
     */
    public record AdminUser(
            UUID id,
            String email,
            String displayName,
            String status,
            List<String> roles,
            Instant createdAt,
            @Nullable Instant lastLoginAt) {}

    /**
     * A series, an episode or a comment.
     *
     * @param title series or episode title, or the start of the comment
     * @param owner the series' creator, the episode's series, or the comment's author
     * @param status series: draft, review, changes, published, hidden; episode: draft, scheduled,
     *     published, hidden; comment: visible, hidden, deleted
     * @param seriesSlug for the link to the public page
     * @param episodeNumber set for episodes and for comments on an episode
     * @param openReports reports still waiting for an admin
     */
    public record AdminContent(
            ContentType type,
            UUID id,
            String title,
            String owner,
            String status,
            String seriesSlug,
            @Nullable Integer episodeNumber,
            Instant createdAt,
            long openReports) {}

    /** What a report points at; empty fields when the target no longer exists. */
    public record ReportTarget(
            ContentType type,
            UUID id,
            @Nullable String title,
            @Nullable String status,
            @Nullable String seriesSlug,
            @Nullable Integer episodeNumber) {}

    /**
     * @param status open, resolved or dismissed
     * @param caseNumber shown to the reporter as R-{caseNumber}
     * @param accusedName the person behind the reported thing
     * @param action what was done: remove, remove_warn, suspend or none (null while open)
     */
    public record AdminReport(
            UUID id,
            String reason,
            @Nullable String details,
            String status,
            String reporter,
            Instant createdAt,
            @Nullable Instant resolvedAt,
            @Nullable String resolvedBy,
            @Nullable String note,
            int caseNumber,
            @Nullable UUID accusedId,
            @Nullable String accusedName,
            @Nullable String action,
            ReportTarget target) {}

    /**
     * @param status pending, paid, failed, cancelled, expired or refunded
     * @param refundable a paid order can be refunded
     */
    public record AdminOrder(
            UUID id,
            String orderNumber,
            UUID userId,
            String email,
            String displayName,
            int coins,
            String method,
            String status,
            @Nullable Integer priceUsdCents,
            @Nullable Integer priceKhr,
            Instant createdAt,
            @Nullable Instant paidAt,
            @Nullable Instant refundedAt,
            boolean refundable) {}

    /**
     * @param action for example {@code user.ban}, {@code content.hide}, {@code order.refund}
     * @param details what the admin entered and what changed
     */
    public record AuditEntry(
            long id,
            @Nullable UUID actorId,
            @Nullable String actorName,
            String action,
            String targetType,
            @Nullable String targetId,
            Map<String, Object> details,
            @Nullable String requestId,
            Instant createdAt) {}

    /**
     * @param seriesInReview series waiting for a review decision
     * @param oldestReviewAt when the longest-waiting of them was submitted; {@code null} when none
     *     waits
     */
    public record Overview(
            long openReports,
            long bannedUsers,
            long hiddenSeries,
            long hiddenEpisodes,
            long hiddenComments,
            long refundedOrders,
            long seriesInReview,
            @Nullable Instant oldestReviewAt) {}

    /**
     * A series waiting for review (the admin's series queue, V21-01).
     *
     * @param creator the creator's pen name
     * @param genre genre slug
     * @param languages "en" and / or "km"
     * @param episodeCount the series' episodes, drafts included
     * @param submittedAt when the creator submitted it (the queue is oldest first)
     * @param flags what the automatic checks found; empty when nothing
     */
    public record ReviewQueueItem(
            UUID id,
            String slug,
            String title,
            String creator,
            SeriesType type,
            String genre,
            AgeRating ageRating,
            List<String> languages,
            int episodeCount,
            @Nullable String coverUrl,
            String summary,
            Instant submittedAt,
            List<ReviewFlag> flags) {}

    /**
     * An automatic-check finding.
     *
     * @param kind contact (contact details or links in the summary), similar (the title is like a
     *     live series' title) or watermark (not detected yet: never set)
     * @param detail contact: what was found; similar: the live series' title
     */
    public record ReviewFlag(FlagKind kind, @Nullable String detail) {}

    /**
     * @param refundedCoins coins taken back from the wallet
     */
    public record RefundResult(AdminOrder order, int refundedCoins) {}
}
