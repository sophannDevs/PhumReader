package app.phumreader.notification.repository;

import app.phumreader.notification.domain.NotificationKind;
import app.phumreader.notification.domain.NotificationType;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * The {@code notifications} table (V21-03): the reader's inbox and the rows the sources write.
 * Every write is keyed by {@code (user_id, group_key)}, so writing the same thing again changes
 * nothing. Rows are only written for accounts that still exist (not erased).
 */
@Repository
public class InboxQueries {

    /** One inbox row with its series. */
    public record InboxRow(
            UUID id,
            NotificationKind kind,
            NotificationType type,
            OffsetDateTime createdAt,
            boolean read,
            @Nullable UUID seriesId,
            @Nullable String seriesSlug,
            @Nullable String seriesTitle,
            @Nullable String seriesType,
            @Nullable Integer episodeNumber,
            String data) {}

    /** Where the previous page ended. */
    public record Key(OffsetDateTime createdAt, UUID id) {}

    private static final String INSERT =
            "insert into notifications"
                    + " (user_id, kind, type, group_key, series_id, episode_number, data, created_at) ";

    private final JdbcClient jdbc;

    public InboxQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- the inbox ----------

    /**
     * A page of the inbox, newest first (removed items left out).
     *
     * @param kind only this kind, or every kind
     * @param unreadOnly only unread items
     */
    public List<InboxRow> page(
            UUID userId,
            @Nullable NotificationKind kind,
            boolean unreadOnly,
            @Nullable Key after,
            int limit) {
        String sql =
                "select n.id, n.kind, n.type, n.created_at, n.read_at is not null as read,"
                        + " n.series_id, s.slug, s.title, s.type as series_type, n.episode_number,"
                        + " n.data::text as data"
                        + " from notifications n left join series s on s.id = n.series_id"
                        + " where n.user_id = :u and n.removed_at is null"
                        + (kind == null ? "" : " and n.kind = :kind")
                        + (unreadOnly ? " and n.read_at is null" : "")
                        + (after == null ? "" : " and (n.created_at, n.id) < (:t, :id)")
                        + " order by n.created_at desc, n.id desc limit :limit";
        JdbcClient.StatementSpec spec = jdbc.sql(sql).param("u", userId).param("limit", limit);
        if (kind != null) {
            spec = spec.param("kind", kind.name());
        }
        if (after != null) {
            spec = spec.param("t", after.createdAt()).param("id", after.id());
        }
        return spec.query((rs, n) -> row(rs)).list();
    }

    public long unread(UUID userId) {
        return jdbc.sql(
                        "select count(*) from notifications where user_id = :u"
                                + " and read_at is null and removed_at is null")
                .param("u", userId)
                .query(Long.class)
                .single();
    }

    /**
     * Marks one of the person's items read (keeping the first time) or unread.
     *
     * @return {@code false} when the person has no such item
     */
    public boolean markRead(UUID userId, UUID id, boolean read, OffsetDateTime now) {
        return jdbc.sql(
                                "update notifications set read_at = "
                                        + (read ? "coalesce(read_at, :now)" : "null")
                                        + " where id = :id and user_id = :u")
                        .param("now", now)
                        .param("id", id)
                        .param("u", userId)
                        .update()
                > 0;
    }

    /** Marks every unread item read; returns how many. */
    public int markAllRead(UUID userId, OffsetDateTime now) {
        return jdbc.sql(
                        "update notifications set read_at = :now where user_id = :u"
                                + " and read_at is null and removed_at is null")
                .param("now", now)
                .param("u", userId)
                .update();
    }

    /**
     * Removes (keeping the first time) or restores one of the person's items.
     *
     * @return {@code false} when the person has no such item
     */
    public boolean markRemoved(UUID userId, UUID id, boolean removed, OffsetDateTime now) {
        return jdbc.sql(
                                "update notifications set removed_at = "
                                        + (removed ? "coalesce(removed_at, :now)" : "null")
                                        + " where id = :id and user_id = :u")
                        .param("now", now)
                        .param("id", id)
                        .param("u", userId)
                        .update()
                > 0;
    }

    // ---------- sources ----------

    /**
     * One item for one person (unless the account was erased); nothing when the person already has
     * the item with this key.
     */
    public void add(
            UUID userId,
            NotificationType type,
            String groupKey,
            @Nullable UUID seriesId,
            @Nullable Integer episodeNumber,
            String data,
            OffsetDateTime now) {
        jdbc.sql(
                        INSERT
                                + "select u.id, :kind, :type, :key, cast(:series as uuid),"
                                + " cast(:episode as integer), cast(:data as jsonb), :now from users u"
                                + " where u.id = :u and u.status <> 'DELETED'"
                                + " on conflict (user_id, group_key) do nothing")
                .param("u", userId)
                .param("kind", type.kind().name())
                .param("type", type.key())
                .param("key", groupKey)
                .param("series", seriesId)
                .param("episode", episodeNumber)
                .param("data", data)
                .param("now", now)
                .update();
    }

    /**
     * "New episode" for these people (a dispatcher page); people who have it already are skipped.
     */
    public int episodePublished(
            Collection<UUID> userIds,
            UUID episodeId,
            UUID seriesId,
            int episodeNumber,
            OffsetDateTime now) {
        if (userIds.isEmpty()) {
            return 0;
        }
        NotificationType type = NotificationType.EPISODE_PUBLISHED;
        return jdbc.sql(
                        INSERT
                                + "select u.id, :kind, :type, :key, :series, :episode, '{}'::jsonb,"
                                + " :now from users u where u.id in (:ids)"
                                + " on conflict (user_id, group_key) do nothing")
                .param("kind", type.kind().name())
                .param("type", type.key())
                .param("key", "episode:" + episodeId)
                .param("series", seriesId)
                .param("episode", episodeNumber)
                .param("now", now)
                .param("ids", userIds)
                .update();
    }

    /**
     * Someone other than the author liked a comment: the author's item for that comment and day
     * (from {@code dayStart} to {@code dayEnd}) shows how many people liked it that day. A new
     * liker raises the count and makes the item unread and newest again (also when it was removed);
     * a like taken back and given again changes nothing.
     */
    public void commentLiked(
            UUID likerId,
            UUID commentId,
            String groupKey,
            OffsetDateTime dayStart,
            OffsetDateTime dayEnd,
            OffsetDateTime now) {
        NotificationType type = NotificationType.COMMENT_LIKED;
        jdbc.sql(
                        INSERT
                                + """
                                 select c.author_id, :kind, :type, :key, c.series_id, e.number,
                                        jsonb_build_object('commentId', c.id, 'count',
                                            (select count(*) from comment_likes l
                                             where l.comment_id = c.id and l.user_id <> c.author_id
                                               and l.created_at >= :from and l.created_at < :to)),
                                        :now
                                 from comments c
                                 join users u on u.id = c.author_id and u.status <> 'DELETED'
                                 left join episodes e on e.id = c.episode_id
                                 where c.id = :comment and c.author_id <> :liker
                                 on conflict (user_id, group_key) do update
                                 set data = excluded.data, created_at = excluded.created_at,
                                     read_at = null, removed_at = null
                                 where (excluded.data ->> 'count')::int
                                       > (notifications.data ->> 'count')::int
                                """)
                .param("kind", type.kind().name())
                .param("type", type.key())
                .param("key", groupKey)
                .param("from", dayStart)
                .param("to", dayEnd)
                .param("now", now)
                .param("comment", commentId)
                .param("liker", likerId)
                .update();
    }

    /**
     * The reporters hear how their reports ended (not the admin who settled them, for their own
     * reports). The item opens the series the reported series, episode or comment belongs to.
     */
    public void reportsSettled(
            Collection<UUID> reportIds,
            NotificationType type,
            boolean hidden,
            UUID adminId,
            OffsetDateTime now) {
        if (reportIds.isEmpty()) {
            return;
        }
        jdbc.sql(
                        INSERT
                                + """
                                 select r.reporter_id, :kind, :type, 'report:' || r.id,
                                        coalesce(s.id, e.series_id, c.series_id),
                                        coalesce(e.number, ce.number),
                                        jsonb_build_object('reportId', r.id,
                                                           'targetType', lower(r.target_type),
                                                           'hidden', :hidden),
                                        :now
                                 from reports r
                                 join users u on u.id = r.reporter_id and u.status <> 'DELETED'
                                 left join series s on r.target_type = 'SERIES' and s.id = r.target_id
                                 left join episodes e
                                        on r.target_type = 'EPISODE' and e.id = r.target_id
                                 left join comments c
                                        on r.target_type = 'COMMENT' and c.id = r.target_id
                                 left join episodes ce on ce.id = c.episode_id
                                 where r.id in (:ids) and r.reporter_id <> :admin
                                 on conflict (user_id, group_key) do nothing
                                """)
                .param("kind", type.kind().name())
                .param("type", type.key())
                .param("hidden", hidden)
                .param("now", now)
                .param("ids", reportIds)
                .param("admin", adminId)
                .update();
    }

    /** The series' creator hears the review decision (not when they decided it themselves). */
    public void seriesReviewed(
            UUID seriesId,
            long reviewId,
            NotificationType type,
            UUID adminId,
            String data,
            OffsetDateTime now) {
        jdbc.sql(
                        INSERT
                                + "select s.creator_id, :kind, :type, :key, s.id, null,"
                                + " cast(:data as jsonb), :now from series s"
                                + " join users u on u.id = s.creator_id and u.status <> 'DELETED'"
                                + " where s.id = :series and s.creator_id <> :admin"
                                + " on conflict (user_id, group_key) do nothing")
                .param("kind", type.kind().name())
                .param("type", type.key())
                .param("key", "review:" + reviewId)
                .param("data", data)
                .param("now", now)
                .param("series", seriesId)
                .param("admin", adminId)
                .update();
    }

    // ---------- clean-up ----------

    /**
     * Deletes up to {@code batch} items removed before {@code removedBefore} or read and created
     * before {@code readBefore}; returns how many.
     */
    public int deleteExpired(OffsetDateTime removedBefore, OffsetDateTime readBefore, int batch) {
        return jdbc.sql(
                        """
                        delete from notifications where id in (
                            select id from notifications
                            where removed_at < :removed
                               or (read_at is not null and created_at < :read)
                            limit :batch)
                        """)
                .param("removed", removedBefore)
                .param("read", readBefore)
                .param("batch", batch)
                .update();
    }

    // ---------- mapping ----------

    private static InboxRow row(ResultSet rs) throws SQLException {
        return new InboxRow(
                rs.getObject("id", UUID.class),
                NotificationKind.valueOf(rs.getString("kind")),
                NotificationType.ofKey(rs.getString("type")),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getBoolean("read"),
                rs.getObject("series_id", UUID.class),
                rs.getString("slug"),
                rs.getString("title"),
                rs.getString("series_type"),
                rs.getObject("episode_number", Integer.class),
                rs.getString("data"));
    }
}
