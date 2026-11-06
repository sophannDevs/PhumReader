package app.phumreader.search.service;

import app.phumreader.search.repository.OutboxEvents;
import java.util.Collection;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Tells the search index that series changed. Does nothing while search runs on PostgreSQL (no
 * {@code phumreader.search.url}), so the outbox does not fill up with events nobody reads.
 */
@Service
public class SearchEvents {

    private final OutboxEvents outbox;
    private final boolean enabled;

    public SearchEvents(OutboxEvents outbox, @Value("${phumreader.search.url:}") String url) {
        this.outbox = outbox;
        this.enabled = !url.isBlank();
    }

    /** Call in the same transaction as the change. */
    public void seriesChanged(String eventType, Collection<UUID> seriesIds) {
        if (enabled) {
            seriesIds.forEach(id -> outbox.add(eventType, id));
        }
    }
}
