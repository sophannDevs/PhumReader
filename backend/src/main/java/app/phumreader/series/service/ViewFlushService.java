package app.phumreader.series.service;

import app.phumreader.common.views.ViewCounter;
import app.phumreader.common.views.ViewKind;
import app.phumreader.search.service.SearchEvents;
import app.phumreader.series.repository.ViewCounts;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Adds the counted views to {@code series.view_count} and {@code episodes.view_count} every {@code
 * phumreader.views.flush-interval}, then asks the search index to refresh those series (ranking
 * follows views). If the database write fails the counts are put back and tried again next time.
 */
@Service
public class ViewFlushService {

    private static final Logger log = LoggerFactory.getLogger(ViewFlushService.class);

    private final ViewCounter counter;
    private final ViewCounts counts;
    private final SearchEvents searchEvents;
    private final TransactionTemplate tx;

    public ViewFlushService(
            ViewCounter counter,
            ViewCounts counts,
            SearchEvents searchEvents,
            TransactionTemplate tx) {
        this.counter = counter;
        this.counts = counts;
        this.searchEvents = searchEvents;
        this.tx = tx;
    }

    /** Writes the counted views to the database; returns how many views were added. */
    @Scheduled(
            fixedDelayString = "${phumreader.views.flush-interval:60s}",
            initialDelayString = "${phumreader.views.flush-interval:60s}")
    public long flush() {
        Map<String, Long> series = counter.drain(ViewKind.SERIES);
        Map<String, Long> episodes = counter.drain(ViewKind.EPISODE);
        if (series.isEmpty() && episodes.isEmpty()) {
            return 0;
        }
        try {
            Map<UUID, Long> bySeries = new HashMap<>();
            series.forEach((k, n) -> bySeries.merge(UUID.fromString(k), n, Long::sum));
            tx.executeWithoutResult(status -> {
                counts.addSeries(bySeries);
                episodes.forEach((k, n) -> {
                    int colon = k.indexOf(':');
                    UUID seriesId = UUID.fromString(k.substring(0, colon));
                    counts.addEpisode(seriesId, Integer.parseInt(k.substring(colon + 1)), n);
                });
                searchEvents.seriesChanged("VIEWS_CHANGED", bySeries.keySet());
            });
        } catch (RuntimeException e) {
            log.warn("Could not add views to the database, will retry: {}", e.toString());
            counter.restore(ViewKind.SERIES, series);
            counter.restore(ViewKind.EPISODE, episodes);
            return 0;
        }
        long total =
                series.values().stream().mapToLong(Long::longValue).sum()
                        + episodes.values().stream().mapToLong(Long::longValue).sum();
        log.info(
                "Views added: {} series, {} episodes ({} views)",
                series.size(),
                episodes.size(),
                total);
        return total;
    }
}
