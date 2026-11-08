package app.phumreader.search.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The SEARCH events in {@code outbox_events}, written with every series change. */
@Repository
public class OutboxEvents {

    /** One event to handle: "something changed about this series". */
    public record Event(long id, String type, UUID seriesId, int attempts) {}

    private final JdbcClient jdbc;

    public OutboxEvents(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Queues a search update for one series (call in the same transaction as the change). */
    public void add(String eventType, UUID seriesId) {
        jdbc.sql(
                        "insert into outbox_events (topic, event_type, aggregate_id)"
                                + " values ('SEARCH', :type, :id)")
                .param("type", eventType)
                .param("id", seriesId)
                .update();
    }

    /** Locks and returns the oldest unprocessed events; other workers skip the locked rows. */
    public List<Event> lockPending(int limit) {
        return jdbc.sql(
                        "select id, event_type, aggregate_id, attempts from outbox_events"
                                + " where topic = 'SEARCH' and processed_at is null and attempts < :max"
                                + " and aggregate_id is not null order by id limit :limit"
                                + " for update skip locked")
                .param("limit", limit)
                .param("max", MAX_ATTEMPTS)
                .query((rs, n) ->
                        new Event(
                                rs.getLong("id"),
                                rs.getString("event_type"),
                                rs.getObject("aggregate_id", UUID.class),
                                rs.getInt("attempts")))
                .list();
    }

    public static final int MAX_ATTEMPTS = 5;

    public void markDone(List<Long> ids) {
        if (ids.isEmpty()) {
            return;
        }
        jdbc.sql("update outbox_events set processed_at = now() where id in (:ids)")
                .param("ids", ids)
                .update();
    }

    public void markFailed(List<Long> ids, String error) {
        if (ids.isEmpty()) {
            return;
        }
        jdbc.sql(
                        "update outbox_events set attempts = attempts + 1, last_error = :error"
                                + " where id in (:ids)")
                .param("ids", ids)
                .param("error", error.length() > 500 ? error.substring(0, 500) : error)
                .update();
    }
}
