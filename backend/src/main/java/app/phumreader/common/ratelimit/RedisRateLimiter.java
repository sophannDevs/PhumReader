package app.phumreader.common.ratelimit;

import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;

/**
 * {@link RateLimiter} in Redis, so limits hold across API instances and restarts. Active when
 * {@code phumreader.redis.url} is set. If Redis is unreachable the limiter lets requests through
 * (and logs a warning) rather than blocking everyone from signing in.
 */
@Component
@ConditionalOnExpression("!'${phumreader.redis.url:}'.isBlank()")
public class RedisRateLimiter implements RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RedisRateLimiter.class);
    private static final String PREFIX = "phumreader:rl:";

    /** Counts one event and opens the window on the first one, in one step. */
    private static final DefaultRedisScript<Long> HIT =
            new DefaultRedisScript<>(
                    """
                    local c = redis.call('INCR', KEYS[1])
                    if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
                    return c
                    """,
                    Long.class);

    private final StringRedisTemplate redis;

    public RedisRateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public Optional<Duration> blocked(String key, int limit) {
        try {
            String count = redis.opsForValue().get(PREFIX + key);
            if (count == null || Long.parseLong(count) < limit) {
                return Optional.empty();
            }
            Long millis = redis.getExpire(PREFIX + key, java.util.concurrent.TimeUnit.MILLISECONDS);
            if (millis == null || millis <= 0) {
                return Optional.empty();
            }
            // Whole seconds, at least one (the Retry-After header counts seconds).
            return Optional.of(Duration.ofSeconds(Math.max(1, (millis + 999) / 1000)));
        } catch (RuntimeException e) {
            log.warn(
                    "Redis rate limit check failed, letting the request through: {}", e.toString());
            return Optional.empty();
        }
    }

    @Override
    public void hit(String key, Duration window) {
        try {
            redis.execute(HIT, List.of(PREFIX + key), String.valueOf(window.toMillis()));
        } catch (RuntimeException e) {
            log.warn("Redis rate limit count failed: {}", e.toString());
        }
    }

    @Override
    public void reset(String key) {
        try {
            redis.delete(PREFIX + key);
        } catch (RuntimeException e) {
            log.warn("Redis rate limit reset failed: {}", e.toString());
        }
    }

    @Override
    public void clear() {
        try (Cursor<String> keys =
                redis.scan(ScanOptions.scanOptions().match(PREFIX + "*").count(500).build())) {
            keys.forEachRemaining(redis::delete);
        }
    }
}
