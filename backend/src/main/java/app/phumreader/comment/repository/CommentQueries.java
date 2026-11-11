package app.phumreader.comment.repository;

import app.phumreader.comment.domain.CommentOrder;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Comment threads (a series page, or one episode), comment likes and reports (plain SQL). Only
 * VISIBLE comments are listed.
 */
@Repository
public class CommentQueries {

    /** A visible comment with its author. */
    public record CommentRow(
            UUID id,
            UUID authorId,
            String authorName,
            @Nullable String authorAvatar,
            String body,
            long likes,
            OffsetDateTime createdAt) {}

    /** Who may act on a comment: its author and the creator of its series. */
    public record CommentInfo(
            UUID id,
            UUID seriesId,
            @Nullable UUID episodeId,
            UUID authorId,
            UUID seriesCreatorId,
            String status) {

        public boolean visible() {
            return "VISIBLE".equals(status);
        }
    }

    /** Where the previous page ended (likes are used by {@link CommentOrder#TOP}). */
    public record Key(long likes, OffsetDateTime createdAt, UUID id) {}

    private static final String SELECT =
            "select c.id, c.author_id, u.display_name, u.avatar_url, c.body, c.like_count,"
                    + " c.created_at from comments c join users u on u.id = c.author_id";

    private final JdbcClient jdbc;

    public CommentQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** One page of a thread: the series page when {@code episodeId} is null, else that episode. */
    public List<CommentRow> page(
            UUID seriesId,
            @Nullable UUID episodeId,
            CommentOrder order,
            @Nullable Key after,
            int limit) {
        StringBuilder sql =
                new StringBuilder(SELECT)
                        .append(" where c.series_id = :s and c.status = 'VISIBLE'")
                        .append(
                                episodeId == null
                                        ? " and c.episode_id is null"
                                        : " and c.episode_id = :e");
        if (order == CommentOrder.TOP) {
            if (after != null) {
                sql.append(" and (c.like_count, c.created_at, c.id) < (:l, :t, :id)");
            }
            sql.append(" order by c.like_count desc, c.created_at desc, c.id desc");
        } else {
            if (after != null) {
                sql.append(" and (c.created_at, c.id) < (:t, :id)");
            }
            sql.append(" order by c.created_at desc, c.id desc");
        }
        sql.append(" limit :limit");
        JdbcClient.StatementSpec spec =
                jdbc.sql(sql.toString()).param("s", seriesId).param("limit", limit);
        if (episodeId != null) {
            spec = spec.param("e", episodeId);
        }
        if (after != null) {
            spec = spec.param("t", after.createdAt()).param("id", after.id());
            if (order == CommentOrder.TOP) {
                spec = spec.param("l", after.likes());
            }
        }
        return spec.query((rs, n) -> row(rs)).list();
    }

    /** The thread's most liked visible comment, when it has at least {@code minLikes}. */
    public Optional<UUID> topComment(UUID seriesId, @Nullable UUID episodeId, int minLikes) {
        String sql =
                "select id from comments where series_id = :s and status = 'VISIBLE'"
                        + (episodeId == null ? " and episode_id is null" : " and episode_id = :e")
                        + " and like_count >= :min"
                        + " order by like_count desc, created_at, id limit 1";
        JdbcClient.StatementSpec spec = jdbc.sql(sql).param("s", seriesId).param("min", minLikes);
        if (episodeId != null) {
            spec = spec.param("e", episodeId);
        }
        return spec.query(UUID.class).optional();
    }

    /** Which of these comments the user liked. */
    public Set<UUID> likedBy(UUID userId, Collection<UUID> commentIds) {
        if (commentIds.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(
                jdbc.sql(
                                "select comment_id from comment_likes where user_id = :u"
                                        + " and comment_id in (:ids)")
                        .param("u", userId)
                        .param("ids", List.copyOf(commentIds))
                        .query(UUID.class)
                        .list());
    }

    public CommentRow insert(
            UUID seriesId,
            @Nullable UUID episodeId,
            UUID authorId,
            String body,
            OffsetDateTime now) {
        UUID id =
                jdbc.sql(
                                "insert into comments (series_id, episode_id, author_id, body,"
                                        + " created_at, updated_at)"
                                        + " values (:s, :e, :a, :b, :now, :now) returning id")
                        .param("s", seriesId)
                        .param("e", episodeId, Types.OTHER)
                        .param("a", authorId)
                        .param("b", body)
                        .param("now", now)
                        .query(UUID.class)
                        .single();
        return jdbc.sql(SELECT + " where c.id = :id")
                .param("id", id)
                .query((rs, n) -> row(rs))
                .single();
    }

    public Optional<CommentInfo> info(UUID commentId) {
        return jdbc.sql(
                        "select c.id, c.series_id, c.episode_id, c.author_id, s.creator_id,"
                                + " c.status from comments c join series s on s.id = c.series_id"
                                + " where c.id = :id")
                .param("id", commentId)
                .query((rs, n) ->
                        new CommentInfo(
                                rs.getObject("id", UUID.class),
                                rs.getObject("series_id", UUID.class),
                                rs.getObject("episode_id", UUID.class),
                                rs.getObject("author_id", UUID.class),
                                rs.getObject("creator_id", UUID.class),
                                rs.getString("status")))
                .optional();
    }

    public void markDeleted(UUID commentId, OffsetDateTime now) {
        jdbc.sql("update comments set status = 'DELETED', updated_at = :now where id = :id")
                .param("id", commentId)
                .param("now", now)
                .update();
    }

    /** Adds the like once; the comment's like count follows. */
    /** Adds the like; {@code false} when this person already liked the comment. */
    public boolean like(UUID userId, UUID commentId, OffsetDateTime now) {
        int added =
                jdbc.sql(
                                "insert into comment_likes (user_id, comment_id, created_at)"
                                        + " values (:u, :c, :now) on conflict do nothing")
                        .param("u", userId)
                        .param("c", commentId)
                        .param("now", now)
                        .update();
        if (added == 1) {
            changeLikes(commentId, 1);
        }
        return added == 1;
    }

    public void unlike(UUID userId, UUID commentId) {
        int removed =
                jdbc.sql("delete from comment_likes where user_id = :u and comment_id = :c")
                        .param("u", userId)
                        .param("c", commentId)
                        .update();
        if (removed == 1) {
            changeLikes(commentId, -1);
        }
    }

    public long likes(UUID commentId) {
        return jdbc.sql("select like_count from comments where id = :id")
                .param("id", commentId)
                .query(Long.class)
                .single();
    }

    /** A report as the filing returns it. */
    public record FiledReport(
            int caseNumber, @Nullable UUID accusedId, @Nullable String accusedName) {}

    /** One of the reporter's cases ("Your reports" in Settings). */
    public record MyReportRow(
            int caseNumber,
            String targetType,
            @Nullable String seriesTitle,
            @Nullable Integer episodeNumber,
            @Nullable String accusedName,
            String reason,
            String status,
            @Nullable String action,
            OffsetDateTime createdAt) {}

    /**
     * Files a report for the admin queue, unless this reporter already has an open report on the
     * same target (that one is returned).
     */
    public FiledReport report(
            UUID reporterId,
            String targetType,
            UUID targetId,
            @Nullable UUID accusedId,
            String reason,
            @Nullable String details,
            OffsetDateTime now) {
        jdbc.sql(
                        "insert into reports (reporter_id, target_type, target_id, accused_id,"
                                + " reason, details, created_at)"
                                + " select :r, :type, :target, :accused, :reason, :details, :now"
                                + " where not exists (select 1 from reports"
                                + " where reporter_id = :r and target_type = :type"
                                + " and target_id = :target and status = 'OPEN')")
                .param("r", reporterId)
                .param("type", targetType)
                .param("target", targetId)
                .param("accused", accusedId, Types.OTHER)
                .param("reason", reason)
                .param("details", details, Types.VARCHAR)
                .param("now", now)
                .update();
        return jdbc.sql(
                        "select r.case_number, r.accused_id, u.display_name from reports r"
                                + " left join users u on u.id = r.accused_id"
                                + " where r.reporter_id = :r and r.target_type = :type"
                                + " and r.target_id = :target order by r.created_at desc, r.id desc"
                                + " limit 1")
                .param("r", reporterId)
                .param("type", targetType)
                .param("target", targetId)
                .query((rs, n) ->
                        new FiledReport(
                                rs.getInt("case_number"),
                                rs.getObject("accused_id", UUID.class),
                                rs.getString("display_name")))
                .single();
    }

    /** The reporter's cases, newest first (at most {@code limit}). */
    public List<MyReportRow> myReports(UUID reporterId, int limit) {
        return jdbc.sql(
                        "select r.case_number, r.target_type, r.reason, r.status, r.action,"
                                + " r.created_at, acc.display_name as accused,"
                                + " coalesce(ts.title, tes.title, tcs.title) as series_title,"
                                + " coalesce(te.number, tce.number) as episode_number"
                                + " from reports r left join users acc on acc.id = r.accused_id"
                                + " left join series ts on r.target_type = 'SERIES'"
                                + "   and ts.id = r.target_id"
                                + " left join episodes te on r.target_type = 'EPISODE'"
                                + "   and te.id = r.target_id"
                                + " left join series tes on tes.id = te.series_id"
                                + " left join comments tc on r.target_type = 'COMMENT'"
                                + "   and tc.id = r.target_id"
                                + " left join series tcs on tcs.id = tc.series_id"
                                + " left join episodes tce on tce.id = tc.episode_id"
                                + " where r.reporter_id = :r order by r.created_at desc, r.id desc"
                                + " limit :limit")
                .param("r", reporterId)
                .param("limit", limit)
                .query((rs, n) ->
                        new MyReportRow(
                                rs.getInt("case_number"),
                                rs.getString("target_type"),
                                rs.getString("series_title"),
                                rs.getObject("episode_number", Integer.class),
                                rs.getString("accused"),
                                rs.getString("reason"),
                                rs.getString("status"),
                                rs.getString("action"),
                                rs.getObject("created_at", OffsetDateTime.class)))
                .list();
    }

    private void changeLikes(UUID commentId, int delta) {
        jdbc.sql("update comments set like_count = greatest(like_count + :d, 0) where id = :id")
                .param("d", delta)
                .param("id", commentId)
                .update();
    }

    private static CommentRow row(ResultSet rs) throws SQLException {
        return new CommentRow(
                rs.getObject("id", UUID.class),
                rs.getObject("author_id", UUID.class),
                rs.getString("display_name"),
                rs.getString("avatar_url"),
                rs.getString("body"),
                rs.getLong("like_count"),
                rs.getObject("created_at", OffsetDateTime.class));
    }
}
