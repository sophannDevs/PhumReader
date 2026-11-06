package app.phumreader.common.redis;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import app.phumreader.common.views.RedisViewCounter;
import app.phumreader.common.views.ViewKind;
import app.phumreader.config.AppProperties;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/** Against a real Redis on 127.0.0.1:6379 (REDIS_TEST_PORT); skipped when none is running. */
class RedisViewCounterTest {

    private LettuceConnectionFactory factory;
    private StringRedisTemplate redis;
    private RedisViewCounter counter;
    private final String key = "t" + UUID.randomUUID().toString().substring(0, 8);

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
        AppProperties props =
                new AppProperties(
                        "http://localhost:3000",
                        new AppProperties.Auth(
                                Duration.ofMinutes(15),
                                Duration.ofDays(30),
                                Duration.ofSeconds(20),
                                false,
                                null,
                                true,
                                null),
                        new AppProperties.Catalog(Duration.ZERO),
                        new AppProperties.Payments(false, Duration.ofMinutes(10)),
                        new AppProperties.Views(
                                true, Duration.ofSeconds(1), Duration.ofSeconds(60)));
        counter = new RedisViewCounter(redis, props);
        // Start from nothing for this test's kinds only.
        redis.delete("phumreader:views:SERIES");
    }

    @AfterEach
    void cleanUp() {
        if (redis != null) {
            redis.delete("phumreader:views:SERIES");
            var seen = redis.keys("phumreader:seen:*" + key + "*");
            if (seen != null && !seen.isEmpty()) {
                redis.delete(seen);
            }
            factory.destroy();
        }
    }

    @Test
    void dedupesPerViewerCountsAcrossViewersAndDrainsAtomically() throws Exception {
        assertThat(counter.record(ViewKind.SERIES, key, "ip:1")).isTrue();
        assertThat(counter.record(ViewKind.SERIES, key, "ip:1")).isFalse();
        assertThat(counter.record(ViewKind.SERIES, key, "ip:2")).isTrue();

        Thread.sleep(1100); // the 1 s de-dupe window ends
        assertThat(counter.record(ViewKind.SERIES, key, "ip:1")).isTrue();

        assertThat(counter.drain(ViewKind.SERIES)).containsEntry(key, 3L);
        assertThat(counter.drain(ViewKind.SERIES)).isEmpty();

        counter.restore(ViewKind.SERIES, java.util.Map.of(key, 5L));
        assertThat(counter.drain(ViewKind.SERIES)).containsEntry(key, 5L);
    }
}
