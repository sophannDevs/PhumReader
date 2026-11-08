package app.phumreader.admin.service;

import app.phumreader.admin.domain.ContentType;
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
     * @param status series: draft, published, hidden; episode: draft, scheduled, published, hidden;
     *     comment: visible, hidden, deleted
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

    public record Overview(
            long openReports,
            long bannedUsers,
            long hiddenSeries,
            long hiddenEpisodes,
            long hiddenComments,
            long refundedOrders) {}

    /**
     * @param refundedCoins coins taken back from the wallet
     */
    public record RefundResult(AdminOrder order, int refundedCoins) {}
}
