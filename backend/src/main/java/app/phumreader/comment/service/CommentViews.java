package app.phumreader.comment.service;

import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the comment endpoints return (plan P3-13). */
public final class CommentViews {

    private CommentViews() {}

    /**
     * A comment in a thread.
     *
     * @param top the thread's most liked comment (at least 10 likes): the "Top" badge
     * @param liked the signed-in reader liked it
     * @param mine the signed-in reader wrote it
     * @param canDelete the signed-in reader may delete it (author, the series' creator, admin)
     * @param blocked the signed-in reader blocked its author: the website hides it behind "Show"
     */
    public record CommentView(
            UUID id,
            CommentAuthor author,
            String body,
            long likes,
            Instant createdAt,
            boolean top,
            boolean liked,
            boolean mine,
            boolean canDelete,
            boolean blocked) {}

    public record CommentAuthor(UUID id, String name, @Nullable String avatarUrl) {}

    /** A comment like after a change. */
    public record CommentLikeState(boolean liked, long likes) {}

    /**
     * The answer to a report.
     *
     * @param caseNumber shown as R-{caseNumber}; the same number when this reader already had an
     *     open report on the target
     * @param accusedId the person behind the reported thing (for an account report: the account),
     *     for "Also block"
     */
    public record ReportReceipt(
            int caseNumber, @Nullable UUID accusedId, @Nullable String accusedName) {}

    /**
     * One of the reader's reports.
     *
     * @param targetType series, episode, comment or user (an account)
     * @param status in_review, removed or no_violation
     */
    public record MyReport(
            int caseNumber,
            String targetType,
            @Nullable String seriesTitle,
            @Nullable Integer episodeNumber,
            @Nullable String accusedName,
            String reason,
            String status,
            Instant createdAt) {}
}
