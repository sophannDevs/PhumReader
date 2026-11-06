package app.phumreader.common.store;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * {@link ShortLivedStore} in Redis: email codes and reset tokens survive an API restart and work
 * across API instances. Active when {@code phumreader.redis.url} is set. Errors are not hidden: a
 * code that cannot be saved or read must fail the request.
 */
@Component
@ConditionalOnExpression("!'${phumreader.redis.url:}'.isBlank()")
public class RedisShortLivedStore implements ShortLivedStore {

    private static final String PREFIX = "phumreader:kv:";

    private final StringRedisTemplate redis;
    private final Clock clock;

    public RedisShortLivedStore(StringRedisTemplate redis, Clock clock) {
        this.redis = redis;
        this.clock = clock;
    }

    @Override
    public void put(String key, String value, Instant expiresAt) {
        Duration ttl = Duration.between(clock.instant(), expiresAt);
        if (ttl.isNegative() || ttl.isZero()) {
            remove(key);
            return;
        }
        redis.opsForValue().set(PREFIX + key, value, ttl);
    }

    @Override
    public Optional<String> get(String key) {
        return Optional.ofNullable(redis.opsForValue().get(PREFIX + key));
    }

    @Override
    public void remove(String key) {
        redis.delete(PREFIX + key);
    }

    @Override
    public void clear() {
        try (Cursor<String> keys =
                redis.scan(ScanOptions.scanOptions().match(PREFIX + "*").count(500).build())) {
            keys.forEachRemaining(redis::delete);
        }
    }
}
