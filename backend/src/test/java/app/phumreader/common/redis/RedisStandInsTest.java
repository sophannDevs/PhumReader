package app.phumreader.common.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import app.phumreader.common.ratelimit.RedisRateLimiter;
import app.phumreader.common.store.RedisShortLivedStore;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Runs the Redis versions against a real Redis on 127.0.0.1:6379 (or REDIS_TEST_PORT). Skipped when
 * none is running, so {@code ./gradlew check} still needs no services.
 */
class RedisStandInsTest {

    private LettuceConnectionFactory factory;
    private StringRedisTemplate redis;
    private final String ns = "t" + UUID.randomUUID().toString().substring(0, 8) + ":";

    @BeforeEach
    void connect() {
        int port = Integer.parseInt(System.getenv().getOrDefault("REDIS_TEST_PORT", "6379"));
        try (Socket s = new Socket()) {
            s.connect(new InetSocketAddress("127.0.0.1", port), 300);
        } catch (Exception e) {
            assumeTrue(false, "no Redis on port " + port);
        }
        factory = new LettuceConnectionFactory(new RedisStandaloneConfiguration("127.0.0.1", port));
        factory.afterPropertiesSet();
        redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();
    }

    @AfterEach
    void cleanUp() {
        if (redis != null) {
            var keys = redis.keys("phumreader:*:" + ns + "*");
            if (keys != null && !keys.isEmpty()) {
                redis.delete(keys);
            }
            factory.destroy();
        }
    }

    @Test
    void rateLimitBlocksAtTheLimitReportsTheWaitAndResets() {
        var limiter = new RedisRateLimiter(redis);
        String key = ns + "login";
        assertThat(limiter.blocked(key, 3)).isEmpty();
        for (int i = 0; i < 3; i++) {
            limiter.hit(key, Duration.ofSeconds(60));
        }
        var wait = limiter.blocked(key, 3);
        assertThat(wait).isPresent();
        assertThat(wait.get().toSeconds()).isBetween(1L, 60L);
        limiter.reset(key);
        assertThat(limiter.blocked(key, 3)).isEmpty();
    }

    @Test
    void rateLimitWindowEndsByItself() throws Exception {
        var limiter = new RedisRateLimiter(redis);
        String key = ns + "short";
        limiter.hit(key, Duration.ofMillis(300));
        assertThat(limiter.blocked(key, 1)).isPresent();
        Thread.sleep(450);
        assertThat(limiter.blocked(key, 1)).isEmpty();
    }

    @Test
    void storeKeepsValuesUntilTheyExpire() throws Exception {
        var store = new RedisShortLivedStore(redis, Clock.systemUTC());
        String key = ns + "code";
        store.put(key, "123456", Instant.now().plusSeconds(60));
        assertThat(store.get(key)).contains("123456");
        store.remove(key);
        assertThat(store.get(key)).isEmpty();

        store.put(key, "x", Instant.now().plusMillis(300));
        Thread.sleep(450);
        assertThat(store.get(key)).isEmpty();

        store.put(key, "late", Instant.now().minusSeconds(1));
        assertThat(store.get(key)).isEmpty();
    }
}
