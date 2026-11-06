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
            boolean canDelete) {}

    public record CommentAuthor(String name, @Nullable String avatarUrl) {}

    /** A comment like after a change. */
    public record CommentLikeState(boolean liked, long likes) {}
}
