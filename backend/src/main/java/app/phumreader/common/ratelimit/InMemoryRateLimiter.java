package app.phumreader.common.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** {@link RateLimiter} kept in this API instance's memory. */
@Component
public class InMemoryRateLimiter implements RateLimiter {

    private static final int CLEANUP_ABOVE = 10_000;

    private record Window(int count, Instant endsAt) {}

    private final Map<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    public InMemoryRateLimiter(Clock clock) {
        this.clock = clock;
    }

    @Override
    public Optional<Duration> blocked(String key, int limit) {
        Instant now = clock.instant();
        Window window = windows.get(key);
        if (window == null || !now.isBefore(window.endsAt()) || window.count() < limit) {
            return Optional.empty();
        }
        Duration wait = Duration.between(now, window.endsAt());
        // Whole seconds, at least one (the Retry-After header counts seconds).
        long seconds = Math.max(1, (wait.toMillis() + 999) / 1000);
        return Optional.of(Duration.ofSeconds(seconds));
    }

    @Override
    public void hit(String key, Duration window) {
        Instant now = clock.instant();
        windows.compute(
                key,
                (k, w) ->
                        w == null || !now.isBefore(w.endsAt())
                                ? new Window(1, now.plus(window))
                                : new Window(w.count() + 1, w.endsAt()));
        if (windows.size() > CLEANUP_ABOVE) {
            windows.values().removeIf(w -> !now.isBefore(w.endsAt()));
        }
    }

    @Override
    public void reset(String key) {
        windows.remove(key);
    }

    @Override
    public void clear() {
        windows.clear();
    }
}
