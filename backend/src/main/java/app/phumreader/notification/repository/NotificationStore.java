package app.phumreader.notification.repository;

import app.phumreader.notification.domain.QuietHours;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * What the notification worker reads and writes: its events in {@code outbox_events}, the people to
 * notify (every active subscriber, with their alert settings) and their push tokens.
 */
@Repository
public class NotificationStore {

    public static final int MAX_ATTEMPTS = 5;

    /** A claimed event: a new episode and how far its recipients were already served. */
    public record Claimed(long id, UUID episodeId, @Nullable UUID after, int attempts) {}

    /** The episode a notification is about; absent fields mean it is no longer live. */
    public record EpisodeInfo(
            UUID episodeId,
            UUID seriesId,
            String seriesSlug,
            String seriesTitle,
            String seriesType,
            UUID creatorId,
            int number,
            String title) {}

    /**
     * One subscriber: every one gets the inbox item; push and email follow their alert settings.
     *
     * @param push "New episodes" push is on
     * @param mail "New episodes" email is on
     */
    public record Recipient(
            UUID userId,
            String email,
            boolean emailVerified,
            String language,
            boolean push,
            boolean mail,
            QuietHours quiet) {}

    private final JdbcClient jdbc;

    public NotificationStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- events ----------

    /** Queues "episode went live" (call in the same transaction as the publish). */
    public void episodePublished(UUID episodeId) {
        jdbc.sql(
                        "insert into outbox_events (topic, event_type, aggregate_id)"
                                + " values ('NOTIFICATION', 'EPISODE_PUBLISHED', :id)")
                .param("id", episodeId)
                .update();
    }

    /**
     * Claims the oldest event nobody works on for {@code lease}; other workers skip it until the
     * lease ends (a worker that dies is replaced after that).
     */
    public @Nullable Claimed claim(Instant now, java.time.Duration lease) {
        return jdbc.sql(
                        """
                        update outbox_events set locked_until = :until
                        where id = (select id from outbox_events
                                    where topic = 'NOTIFICATION' and processed_at is null
                                      and attempts < :max and aggregate_id is not null
                                      and (locked_until is null or locked_until < :now)
                                    order by id limit 1 for update skip locked)
                        returning id, aggregate_id, payload ->> 'after' as after, attempts
                        """)
                .param("until", java.sql.Timestamp.from(now.plus(lease)))
                .param("now", java.sql.Timestamp.from(now))
                .param("max", MAX_ATTEMPTS)
                .query((rs, n) ->
                        new Claimed(
                                rs.getLong("id"),
                                rs.getObject("aggregate_id", UUID.class),
                                rs.getString("after") == null
                                        ? null
                                        : UUID.fromString(rs.getString("after")),
                                rs.getInt("attempts")))
                .optional()
                .orElse(null);
    }

    /** Records the last recipient served and keeps the claim for another {@code lease}. */
    public void progress(long id, UUID after, Instant now, java.time.Duration lease) {
        jdbc.sql(
                        "update outbox_events set payload = jsonb_build_object('after', cast(:after as text)),"
                                + " locked_until = :until where id = :id")
                .param("after", after.toString())
                .param("until", java.sql.Timestamp.from(now.plus(lease)))
                .param("id", id)
                .update();
    }

    public void done(long id) {
        jdbc.sql(
                        "update outbox_events set processed_at = now(), locked_until = null where id = :id")
                .param("id", id)
                .update();
    }

    /** Counts a failed attempt and frees the event for the next round. */
    public void failed(long id, String error) {
        jdbc.sql(
                        "update outbox_events set attempts = attempts + 1, last_error = :error,"
                                + " locked_until = null where id = :id")
                .param("id", id)
                .param("error", error.length() > 500 ? error.substring(0, 500) : error)
                .update();
    }

    // ---------- who and what ----------

    /** The episode, when it and its series are live (and the creator did not hide it). */
    public @Nullable EpisodeInfo liveEpisode(UUID episodeId) {
        return jdbc.sql(
                        """
                        select e.id, s.id as series_id, s.slug, s.title as series_title, s.type, s.creator_id,
                               e.number, e.title
                        from episodes e join series s on s.id = e.series_id
                        where e.id = :id and e.status = 'PUBLISHED' and e.hidden_at is null
                              and s.visibility = 'PUBLISHED'
                        """)
                .param("id", episodeId)
                .query((rs, n) ->
                        new EpisodeInfo(
                                rs.getObject("id", UUID.class),
                                rs.getObject("series_id", UUID.class),
                                rs.getString("slug"),
                                rs.getString("series_title"),
                                rs.getString("type"),
                                rs.getObject("creator_id", UUID.class),
                                rs.getInt("number"),
                                rs.getString("title")))
                .optional()
                .orElse(null);
    }

    /**
     * The next page of subscribers (by user id, after {@code after}) whose accounts are active,
     * with their alert settings (accounts without a settings row have the website's defaults: push
     * on, email off, quiet 22-7). The creator is not notified about their own episode.
     */
    public List<Recipient> recipients(
            UUID seriesId, UUID creatorId, @Nullable UUID after, int limit) {
        return jdbc.sql(
                        """
                        select u.id, u.email, u.email_verified_at is not null as verified,
                               coalesce(st.language, 'en') as language,
                               coalesce(st.notify_new_episodes, true) as push,
                               coalesce(st.email_new_episodes, false) as mail,
                               coalesce(st.quiet_hours, true) as quiet,
                               coalesce(st.quiet_from, 22) as quiet_from,
                               coalesce(st.quiet_to, 7) as quiet_to
                        from subscriptions sub
                        join users u on u.id = sub.user_id
                        left join user_settings st on st.user_id = u.id
                        where sub.series_id = :series and u.status = 'ACTIVE' and u.id <> :creator
                          and (cast(:after as uuid) is null or u.id > cast(:after as uuid))
                        order by u.id limit :limit
                        """)
                .param("series", seriesId)
                .param("creator", creatorId)
                .param("after", after)
                .param("limit", limit)
                .query((rs, n) ->
                        new Recipient(
                                rs.getObject("id", UUID.class),
                                rs.getString("email"),
                                rs.getBoolean("verified"),
                                rs.getString("language"),
                                rs.getBoolean("push"),
                                rs.getBoolean("mail"),
                                new QuietHours(
                                        rs.getBoolean("quiet"),
                                        rs.getInt("quiet_from"),
                                        rs.getInt("quiet_to"))))
                .list();
    }

    /** Push tokens of these people, by user. */
    public Map<UUID, List<String>> tokens(Collection<UUID> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return jdbc
                .sql("select user_id, token from push_tokens where user_id in (:ids)")
                .param("ids", userIds)
                .query((rs, n) ->
                        Map.entry(rs.getObject("user_id", UUID.class), rs.getString("token")))
                .list()
                .stream()
                .collect(
                        Collectors.groupingBy(
                                Map.Entry::getKey,
                                Collectors.mapping(Map.Entry::getValue, Collectors.toList())));
    }

    // ---------- push tokens ----------

    /** Saves a browser's token for this person; a token that was another person's moves over. */
    public void saveToken(UUID userId, String token) {
        jdbc.sql(
                        """
                        insert into push_tokens (user_id, token) values (:user, :token)
                        on conflict (token) do update set user_id = excluded.user_id, last_seen_at = now()
                        """)
                .param("user", userId)
                .param("token", token)
                .update();
    }

    public int deleteToken(UUID userId, String token) {
        return jdbc.sql("delete from push_tokens where user_id = :user and token = :token")
                .param("user", userId)
                .param("token", token)
                .update();
    }

    /** Drops tokens the push service said no longer exist. */
    public void deleteTokens(Collection<String> tokens) {
        if (!tokens.isEmpty()) {
            jdbc.sql("delete from push_tokens where token in (:tokens)")
                    .param("tokens", tokens)
                    .update();
        }
    }
}
