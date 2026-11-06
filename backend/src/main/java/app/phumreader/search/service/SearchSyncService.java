package app.phumreader.search.service;

import app.phumreader.search.repository.OutboxEvents;
import app.phumreader.search.repository.OutboxEvents.Event;
import app.phumreader.series.service.CatalogService;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Keeps the search index in line with the database: a full sync at startup, then the SEARCH events
 * in {@code outbox_events} every few seconds. A failed event is retried up to {@link
 * OutboxEvents#MAX_ATTEMPTS} times; search falls back to PostgreSQL while the index is down.
 */
@Service
@ConditionalOnExpression("!'${phumreader.search.url:}'.isBlank()")
public class SearchSyncService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SearchSyncService.class);
    private static final int BATCH = 200;

    private final SearchIndex index;
    private final CatalogService catalog;
    private final OutboxEvents outbox;
    private final TransactionTemplate tx;

    public SearchSyncService(
            SearchIndex index,
            CatalogService catalog,
            OutboxEvents outbox,
            TransactionTemplate tx) {
        this.index = index;
        this.catalog = catalog;
        this.outbox = outbox;
        this.tx = tx;
    }

    /** Full sync at startup, in the background so a slow Meilisearch never delays the API. */
    @Override
    public void run(ApplicationArguments args) {
        Thread.ofVirtual().name("search-initial-sync").start(this::syncAllQuietly);
    }

    void syncAllQuietly() {
        try {
            syncAll();
        } catch (RuntimeException e) {
            log.warn(
                    "Initial search sync failed (search uses PostgreSQL meanwhile): {}",
                    e.toString());
        }
    }

    /** Makes the index hold exactly the published series. */
    public void syncAll() {
        List<SearchDoc> docs = catalog.searchDocuments(null);
        index.replaceAll(docs);
        log.info("Search index synced: {} series", docs.size());
    }

    /** Applies pending outbox events; returns how many were handled. */
    @Scheduled(
            fixedDelayString = "${phumreader.search.poll-interval:5s}",
            initialDelayString = "10s")
    public int processOutbox() {
        Integer handled =
                tx.execute(status -> {
                    List<Event> events = outbox.lockPending(BATCH);
                    if (events.isEmpty()) {
                        return 0;
                    }
                    Set<UUID> ids =
                            events.stream().map(Event::seriesId).collect(Collectors.toSet());
                    try {
                        apply(ids);
                        outbox.markDone(events.stream().map(Event::id).toList());
                    } catch (RuntimeException e) {
                        log.warn("Search outbox batch failed, will retry: {}", e.toString());
                        outbox.markFailed(events.stream().map(Event::id).toList(), e.toString());
                        return 0;
                    }
                    return events.size();
                });
        return handled == null ? 0 : handled;
    }

    /** Re-reads these series: published ones are indexed, the others removed. */
    private void apply(Collection<UUID> ids) {
        List<SearchDoc> current = catalog.searchDocuments(ids);
        Map<UUID, SearchDoc> published =
                current.stream().collect(Collectors.toMap(SearchDoc::id, d -> d));
        Set<UUID> gone = new HashSet<>(ids);
        gone.removeAll(published.keySet());
        if (!published.isEmpty()) {
            index.upsert(published.values());
        }
        index.delete(gone);
    }
}
