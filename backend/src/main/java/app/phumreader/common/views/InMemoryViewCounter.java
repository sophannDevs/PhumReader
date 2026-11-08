package app.phumreader.common.views;

import app.phumreader.config.AppProperties;
import java.time.Clock;
import java.time.Instant;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;

/** {@link ViewCounter} kept in this API instance's memory. */
@Component
@ConditionalOnExpression("'${phumreader.redis.url:}'.isBlank()")
public class InMemoryViewCounter implements ViewCounter {

    private static final int CLEANUP_ABOVE = 50_000;

    private final Map<ViewKind, Map<String, AtomicLong>> counts = new EnumMap<>(ViewKind.class);
    private final Map<String, Instant> seen = new ConcurrentHashMap<>();
    private final Clock clock;
    private final java.time.Duration window;

    public InMemoryViewCounter(Clock clock, AppProperties properties) {
        this.clock = clock;
        this.window = properties.views().dedupeWindow();
        for (ViewKind kind : ViewKind.values()) {
            counts.put(kind, new ConcurrentHashMap<>());
        }
    }

    @Override
    public boolean record(ViewKind kind, String key, String viewer) {
        Instant now = clock.instant();
        String seenKey = kind + "|" + key + "|" + viewer;
        boolean[] counted = {false};
        seen.compute(
                seenKey,
                (k, until) -> {
                    if (until != null && now.isBefore(until)) {
                        return until;
                    }
                    counted[0] = true;
                    return now.plus(window);
                });
        if (!counted[0]) {
            return false;
        }
        counts.get(kind).computeIfAbsent(key, k -> new AtomicLong()).incrementAndGet();
        if (seen.size() > CLEANUP_ABOVE) {
            seen.values().removeIf(until -> !now.isBefore(until));
        }
        return true;
    }

    @Override
    public Map<String, Long> drain(ViewKind kind) {
        Map<String, Long> taken = new HashMap<>();
        Map<String, AtomicLong> map = counts.get(kind);
        for (String key : map.keySet()) {
            AtomicLong value = map.remove(key);
            if (value != null && value.get() > 0) {
                taken.put(key, value.get());
            }
        }
        return taken;
    }

    @Override
    public void restore(ViewKind kind, Map<String, Long> restored) {
        restored.forEach((key, n) ->
                counts.get(kind).computeIfAbsent(key, k -> new AtomicLong()).addAndGet(n));
    }

    @Override
    public void clear() {
        counts.values().forEach(Map::clear);
        seen.clear();
    }
}
