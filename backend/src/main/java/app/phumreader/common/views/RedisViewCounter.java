package app.phumreader.common.views;

import app.phumreader.config.AppProperties;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/**
 * {@link ViewCounter} in Redis: a hash of counts per kind ({@code phumreader:views:SERIES}) and one
 * short-lived "seen" key per viewer and target for the de-dupe window. Active when {@code
 * phumreader.redis.url} is set.
 */
@Component
@ConditionalOnExpression("!'${phumreader.redis.url:}'.isBlank()")
public class RedisViewCounter implements ViewCounter {

    private static final String COUNTS = "phumreader:views:";
    private static final String SEEN = "phumreader:seen:";

    /** Counts a view only the first time a viewer is seen within the window. */
    private static final DefaultRedisScript<Long> RECORD =
            new DefaultRedisScript<>(
                    """
                    if redis.call('SET', KEYS[1], '1', 'NX', 'PX', ARGV[1]) then
                      redis.call('HINCRBY', KEYS[2], ARGV[2], 1)
                      return 1
                    end
                    return 0
                    """,
                    Long.class);

    /** Reads and deletes the whole hash in one step, so no view is lost between the two. */
    @SuppressWarnings("rawtypes")
    private static final DefaultRedisScript<List> DRAIN =
            new DefaultRedisScript<>(
                    """
                    local all = redis.call('HGETALL', KEYS[1])
                    redis.call('DEL', KEYS[1])
                    return all
                    """,
                    List.class);

    private final StringRedisTemplate redis;
    private final Duration window;

    public RedisViewCounter(StringRedisTemplate redis, AppProperties properties) {
        this.redis = redis;
        this.window = properties.views().dedupeWindow();
    }

    @Override
    public boolean record(ViewKind kind, String key, String viewer) {
        Long counted =
                redis.execute(
                        RECORD,
                        List.of(SEEN + kind + ":" + key + ":" + viewer, COUNTS + kind),
                        String.valueOf(window.toMillis()),
                        key);
        return counted != null && counted == 1L;
    }

    @Override
    public Map<String, Long> drain(ViewKind kind) {
        @SuppressWarnings("unchecked")
        List<Object> flat = redis.execute(DRAIN, List.of(COUNTS + kind));
        Map<String, Long> taken = new HashMap<>();
        if (flat != null) {
            for (int i = 0; i + 1 < flat.size(); i += 2) {
                taken.put(
                        String.valueOf(flat.get(i)),
                        Long.parseLong(String.valueOf(flat.get(i + 1))));
            }
        }
        return taken;
    }

    @Override
    public void restore(ViewKind kind, Map<String, Long> counts) {
        counts.forEach((key, n) -> redis.opsForHash().increment(COUNTS + kind, key, n));
    }

    @Override
    public void clear() {
        for (String pattern : List.of(COUNTS + "*", SEEN + "*")) {
            try (Cursor<String> keys =
                    redis.scan(ScanOptions.scanOptions().match(pattern).count(500).build())) {
                keys.forEachRemaining(redis::delete);
            }
        }
    }
}
