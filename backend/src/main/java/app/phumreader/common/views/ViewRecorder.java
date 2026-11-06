package app.phumreader.common.views;

import app.phumreader.config.AppProperties;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Counts a view when a series page or an episode is opened. A failure here is only logged: a
 * counter problem must never break reading.
 */
@Service
public class ViewRecorder {

    private static final Logger log = LoggerFactory.getLogger(ViewRecorder.class);

    private final ViewCounter counter;
    private final boolean enabled;

    public ViewRecorder(ViewCounter counter, AppProperties properties) {
        this.counter = counter;
        this.enabled = properties.views().enabled();
    }

    /** A series page was opened by {@code viewer} (see {@link Viewer}). */
    public void series(UUID seriesId, String viewer) {
        record(ViewKind.SERIES, seriesId.toString(), viewer);
    }

    /** An episode or chapter was opened by {@code viewer}. */
    public void episode(UUID seriesId, int number, String viewer) {
        record(ViewKind.EPISODE, seriesId + ":" + number, viewer);
    }

    private void record(ViewKind kind, String key, String viewer) {
        if (!enabled) {
            return;
        }
        try {
            counter.record(kind, key, viewer);
        } catch (RuntimeException e) {
            log.warn("View not counted ({} {}): {}", kind, key, e.toString());
        }
    }
}
