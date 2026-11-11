package app.phumreader.library.repository;

import app.phumreader.library.domain.LibraryOrder;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Subscriptions, creator follows, reading history and unlocked episodes of one reader (plain SQL).
 * Lists skip series that are not published.
 */
@Repository
public class LibraryQueries {

    /**
     * Where the previous page ended: {@code at} and {@code id} for {@link LibraryOrder#RECENT};
     * {@code title}, {@code id} and {@code number} for {@link LibraryOrder#TITLE}.
     */
    public record Key(
            @Nullable OffsetDateTime at,
            UUID id,
            @Nullable String title,
            @Nullable Integer number) {}

    public record SubscriptionRow(UUID seriesId, String title, OffsetDateTime subscribedAt) {}

    /**
     * @param episode number of the episode opened last
     * @param lastRead highest episode number opened
     */
    public record HistoryRow(
            UUID seriesId,
            String title,
            int episode,
            float progress,
            int lastRead,
            OffsetDateTime readAt) {}

    public record UnlockRow(
            UUID unlockId,
            UUID episodeId,
            UUID seriesId,
            String title,
            int number,
            OffsetDateTime unlockedAt) {}

    public record FollowRow(
            UUID creatorId, String name, long seriesCount, OffsetDateTime followedAt) {}

    /** A creator profile. */
    public record CreatorRow(UUID id, String name) {}

    /** Where a reader is in one series. */
    public record ProgressRow(int episode, float progress, int lastRead) {}

    private final JdbcClient jdbc;

    public LibraryQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- subscriptions ----------

    /** Subscribes once; the series' subscriber count follows. */
    public boolean subscribe(UUID userId, UUID seriesId, OffsetDateTime at) {
        int added =
                jdbc.sql(
                                "insert into subscriptions (user_id, series_id, created_at)"
                                        + " values (:u, :s, :at) on conflict do nothing")
                        .param("u", userId)
                        .param("s", seriesId)
                        .param("at", at)
                        .update();
        if (added == 1) {
            changeSubscribers(List.of(seriesId), 1);
        }
        return added == 1;
    }

    public boolean unsubscribe(UUID userId, UUID seriesId) {
        return !removeSubscriptions(userId, List.of(seriesId)).isEmpty();
    }

    public boolean isSubscribed(UUID userId, UUID seriesId) {
        return jdbc.sql(
                        "select exists(select 1 from subscriptions where user_id = :u"
                                + " and series_id = :s)")
                .param("u", userId)
                .param("s", seriesId)
                .query(Boolean.class)
                .single();
    }

    public long subscribers(UUID seriesId) {
        return jdbc.sql("select subscriber_count from series where id = :id")
                .param("id", seriesId)
                .query(Long.class)
                .single();
    }

    /** Removes the reader's subscriptions to these series and returns what was removed. */
    public List<SubscriptionRow> removeSubscriptions(UUID userId, Collection<UUID> seriesIds) {
        if (seriesIds.isEmpty()) {
            return List.of();
        }
        List<SubscriptionRow> removed =
                jdbc.sql(
                                "delete from subscriptions d using series s"
                                        + " where d.user_id = :u and d.series_id in (:ids)"
                                        + " and s.id = d.series_id"
                                        + " returning d.series_id, s.title, d.created_at")
                        .param("u", userId)
                        .param("ids", List.copyOf(seriesIds))
                        .query((rs, n) ->
                                new SubscriptionRow(
                                        rs.getObject("series_id", UUID.class),
                                        rs.getString("title"),
                                        rs.getObject("created_at", OffsetDateTime.class)))
                        .list();
        changeSubscribers(removed.stream().map(SubscriptionRow::seriesId).toList(), -1);
        return removed;
    }

    public List<SubscriptionRow> subscriptions(
            UUID userId, LibraryOrder order, @Nullable Key after, int limit) {
        String select =
                "select d.series_id, s.title, d.created_at from subscriptions d"
                        + " join series s on s.id = d.series_id"
                        + " where d.user_id = :u and s.visibility = 'PUBLISHED'";
        return page(order, after, "created_at", "series_id", "series_id", null)
                .run(jdbc, select, userId, limit)
                .query((rs, n) ->
                        new SubscriptionRow(
                                rs.getObject("series_id", UUID.class),
                                rs.getString("title"),
                                rs.getObject("created_at", OffsetDateTime.class)))
                .list();
    }

    private void changeSubscribers(List<UUID> seriesIds, int delta) {
        if (seriesIds.isEmpty()) {
            return;
        }
        jdbc.sql(
                        "update series set subscriber_count = greatest(subscriber_count + :d, 0)"
                                + " where id in (:ids)")
                .param("d", delta)
                .param("ids", seriesIds)
                .update();
    }

    // ---------- follows ----------

    public Optional<CreatorRow> creator(UUID creatorId) {
        return jdbc.sql("select user_id, pen_name from creator_profiles where user_id = :id")
                .param("id", creatorId)
                .query((rs, n) ->
                        new CreatorRow(
                                rs.getObject("user_id", UUID.class), rs.getString("pen_name")))
                .optional();
    }

    public void follow(UUID userId, UUID creatorId, OffsetDateTime at) {
        jdbc.sql(
                        "insert into creator_follows (user_id, creator_id, created_at)"
                                + " values (:u, :c, :at) on conflict do nothing")
                .param("u", userId)
                .param("c", creatorId)
                .param("at", at)
                .update();
    }

    public void unfollow(UUID userId, UUID creatorId) {
        jdbc.sql("delete from creator_follows where user_id = :u and creator_id = :c")
                .param("u", userId)
                .param("c", creatorId)
                .update();
    }

    public boolean isFollowing(UUID userId, UUID creatorId) {
        return jdbc.sql(
                        "select exists(select 1 from creator_follows where user_id = :u"
                                + " and creator_id = :c)")
                .param("u", userId)
                .param("c", creatorId)
                .query(Boolean.class)
                .single();
    }

    public long followers(UUID creatorId) {
        return jdbc.sql("select count(*) from creator_follows where creator_id = :c")
                .param("c", creatorId)
                .query(Long.class)
                .single();
    }

    /** Followed creators, most recent first. */
    public List<FollowRow> follows(UUID userId, @Nullable Key after, int limit) {
        String sql =
                "select f.creator_id, p.pen_name, f.created_at,"
                        + " (select count(*) from series s where s.creator_id = f.creator_id"
                        + " and s.visibility = 'PUBLISHED') as series_count"
                        + " from creator_follows f join creator_profiles p on p.user_id = f.creator_id"
                        + " where f.user_id = :u"
                        + (after == null ? "" : " and (f.created_at, f.creator_id) < (:at, :id)")
                        + " order by f.created_at desc, f.creator_id desc limit :limit";
        JdbcClient.StatementSpec spec = jdbc.sql(sql).param("u", userId).param("limit", limit);
        if (after != null) {
            spec = spec.param("at", after.at()).param("id", after.id());
        }
        return spec.query((rs, n) ->
                        new FollowRow(
                                rs.getObject("creator_id", UUID.class),
                                rs.getString("pen_name"),
                                rs.getLong("series_count"),
                                rs.getObject("created_at", OffsetDateTime.class)))
                .list();
    }

    // ---------- reading history ----------

    public List<HistoryRow> history(
            UUID userId, LibraryOrder order, @Nullable Key after, int limit) {
        String select =
                "select p.series_id, s.title, e.number, p.progress, p.max_episode_number,"
                        + " p.updated_at from reading_progress p"
                        + " join series s on s.id = p.series_id"
                        + " join episodes e on e.id = p.episode_id"
                        + " where p.user_id = :u and s.visibility = 'PUBLISHED'";
        return page(order, after, "updated_at", "series_id", "series_id", null)
                .run(jdbc, select, userId, limit)
                .query((rs, n) -> history(rs))
                .list();
    }

    /** Where the reader is in one series, if they opened it. */
    public Optional<ProgressRow> progress(UUID userId, UUID seriesId) {
        return jdbc.sql(
                        "select e.number, p.progress, p.max_episode_number from reading_progress p"
                                + " join episodes e on e.id = p.episode_id"
                                + " where p.user_id = :u and p.series_id = :s")
                .param("u", userId)
                .param("s", seriesId)
                .query((rs, n) ->
                        new ProgressRow(
                                rs.getInt("number"),
                                rs.getFloat("progress"),
                                rs.getInt("max_episode_number")))
                .optional();
    }

    /** Removes these series from the reader's history and returns what was removed. */
    public List<HistoryRow> removeHistory(UUID userId, Collection<UUID> seriesIds) {
        if (seriesIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(
                        "with gone as (delete from reading_progress where user_id = :u"
                                + " and series_id in (:ids) returning *)"
                                + " select g.series_id, s.title, e.number, g.progress,"
                                + " g.max_episode_number, g.updated_at from gone g"
                                + " join series s on s.id = g.series_id"
                                + " join episodes e on e.id = g.episode_id")
                .param("u", userId)
                .param("ids", List.copyOf(seriesIds))
                .query((rs, n) -> history(rs))
                .list();
    }

    /** Puts a removed history entry back (undo); does nothing if the series has one again. */
    public void restoreHistory(
            UUID userId,
            UUID seriesId,
            int episode,
            float progress,
            int lastRead,
            OffsetDateTime readAt) {
        jdbc.sql(
                        "insert into reading_progress (user_id, series_id, episode_id, progress,"
                                + " max_episode_number, updated_at)"
                                + " select :u, e.series_id, e.id, :p, :max, :at from episodes e"
                                + " where e.series_id = :s and e.number = :n"
                                + " on conflict do nothing")
                .param("u", userId)
                .param("s", seriesId)
                .param("n", episode)
                .param("p", progress)
                .param("max", lastRead)
                .param("at", readAt)
                .update();
    }

    private static HistoryRow history(ResultSet rs) throws SQLException {
        return new HistoryRow(
                rs.getObject("series_id", UUID.class),
                rs.getString("title"),
                rs.getInt("number"),
                rs.getFloat("progress"),
                rs.getInt("max_episode_number"),
                rs.getObject("updated_at", OffsetDateTime.class));
    }

    // ---------- unlocked episodes ----------

    public List<UnlockRow> unlocked(
            UUID userId, LibraryOrder order, @Nullable Key after, int limit) {
        String select =
                "select u.id, u.episode_id, e.series_id, s.title, e.number, u.created_at"
                        + " from unlocks u join episodes e on e.id = u.episode_id"
                        + " join series s on s.id = e.series_id"
                        + " where u.user_id = :u and s.visibility = 'PUBLISHED'"
                        + " and e.hidden_at is null";
        return page(order, after, "created_at", "id", "series_id", "number")
                .run(jdbc, select, userId, limit)
                .query((rs, n) ->
                        new UnlockRow(
                                rs.getObject("id", UUID.class),
                                rs.getObject("episode_id", UUID.class),
                                rs.getObject("series_id", UUID.class),
                                rs.getString("title"),
                                rs.getInt("number"),
                                rs.getObject("created_at", OffsetDateTime.class)))
                .list();
    }

    /**
     * Episode numbers of one series the reader unlocked, lowest first (not the ones the creator
     * hid).
     */
    public List<Integer> unlockedNumbers(UUID userId, UUID seriesId) {
        return jdbc.sql(
                        "select e.number from unlocks u join episodes e on e.id = u.episode_id"
                                + " where u.user_id = :u and e.series_id = :s"
                                + " and e.hidden_at is null order by e.number")
                .param("u", userId)
                .param("s", seriesId)
                .query(Integer.class)
                .list();
    }

    // ---------- keyset paging ----------

    /**
     * Keyset paging over a list query whose columns are seen by their plain names. RECENT orders by
     * {@code time} then {@code recentId}, newest first; TITLE by lower(title), {@code seriesId} and
     * (for unlocks) {@code number}.
     */
    private record Page(String where, String orderBy, Map<String, Object> params) {

        JdbcClient.StatementSpec run(JdbcClient jdbc, String select, UUID userId, int limit) {
            JdbcClient.StatementSpec spec =
                    jdbc.sql("select * from (" + select + ") x" + where + orderBy + " limit :limit")
                            .param("u", userId)
                            .param("limit", limit);
            for (Map.Entry<String, Object> p : params.entrySet()) {
                spec = spec.param(p.getKey(), p.getValue());
            }
            return spec;
        }
    }

    private static Page page(
            LibraryOrder order,
            @Nullable Key after,
            String time,
            String recentId,
            String seriesId,
            @Nullable String number) {
        Map<String, Object> params = new LinkedHashMap<>();
        String where = "";
        String orderBy;
        if (order == LibraryOrder.RECENT) {
            orderBy = " order by " + time + " desc, " + recentId + " desc";
            if (after != null) {
                where = " where (" + time + ", " + recentId + ") < (:afterAt, :afterId)";
                params.put("afterAt", after.at());
                params.put("afterId", after.id());
            }
        } else {
            String key = "lower(title), " + seriesId + (number == null ? "" : ", " + number);
            orderBy = " order by " + key;
            if (after != null) {
                where =
                        " where ("
                                + key
                                + ") > (:afterTitle, :afterId"
                                + (number == null ? "" : ", :afterNumber")
                                + ")";
                params.put("afterTitle", after.title());
                params.put("afterId", after.id());
                if (number != null) {
                    params.put("afterNumber", after.number());
                }
            }
        }
        return new Page(where, orderBy, params);
    }
}
