package app.phumreader.common.store;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** {@link ShortLivedStore} kept in this API instance's memory. */
@Component
public class InMemoryShortLivedStore implements ShortLivedStore {

    private static final int CLEANUP_ABOVE = 10_000;

    private record Entry(String value, Instant expiresAt) {}

    private final Map<String, Entry> entries = new ConcurrentHashMap<>();
    private final Clock clock;

    public InMemoryShortLivedStore(Clock clock) {
        this.clock = clock;
    }

    @Override
    public void put(String key, String value, Instant expiresAt) {
        entries.put(key, new Entry(value, expiresAt));
        if (entries.size() > CLEANUP_ABOVE) {
            Instant now = clock.instant();
            entries.values().removeIf(e -> !now.isBefore(e.expiresAt()));
        }
    }

    @Override
    public Optional<String> get(String key) {
        Entry entry = entries.get(key);
        if (entry == null) {
            return Optional.empty();
        }
        if (!clock.instant().isBefore(entry.expiresAt())) {
            entries.remove(key, entry);
            return Optional.empty();
        }
        return Optional.of(entry.value());
    }

    @Override
    public void remove(String key) {
        entries.remove(key);
    }

    @Override
    public void clear() {
        entries.clear();
    }
}
