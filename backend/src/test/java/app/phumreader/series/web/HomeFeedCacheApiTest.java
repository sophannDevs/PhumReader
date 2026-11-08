package app.phumreader.series.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.series.service.CatalogService;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * The home feed with its cache switched on (the other tests turn it off): the cached copy is
 * identical to a fresh one, it is served fast, and a publish clears it (plan P3-06).
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@TestPropertySource(properties = "phumreader.catalog.home-cache-ttl=60s")
class HomeFeedCacheApiTest {

    private static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired CatalogService catalog;
    @Autowired ShortLivedStore store;

    @BeforeEach
    void demoContentAtDemoNoon() {
        clock.set(DEMO_NOON);
        SeededDemo.ensure(seeder, jdbc, transactions);
        catalog.refreshHome();
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    @Test
    void theCachedFeedIsIdenticalToAFreshOne() throws Exception {
        String fresh = home();
        assertThat(store.get("cache:home:THU")).as("copy in the cache").isPresent();

        assertThat(home()).isEqualTo(fresh);
    }

    @Test
    void aPublishClearsEveryDaysCopyAndTheNextVisitBuildsItAgain() throws Exception {
        home();
        assertThat(store.get("cache:home:THU")).isPresent();

        catalog.refreshHome();

        assertThat(store.get("cache:home:THU")).isEmpty();
        assertThat(home()).isNotBlank();
        assertThat(store.get("cache:home:THU")).isPresent();
    }

    @Test
    void theCopyExpiresAfterTheTtl() throws Exception {
        home();
        clock.advance(java.time.Duration.ofSeconds(61));

        assertThat(store.get("cache:home:THU")).isEmpty();
    }

    @Test
    void servingFromTheCacheIsFast() throws Exception {
        home();
        List<Long> micros = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            long start = System.nanoTime();
            home();
            micros.add((System.nanoTime() - start) / 1000);
        }
        Collections.sort(micros);
        long p95Millis = micros.get((int) (micros.size() * 0.95)) / 1000;

        // The plan asks for under 150 ms at p95; MockMvc has no network, so this checks the work
        // the API itself does for a cached visit.
        assertThat(p95Millis).as("p95 in ms").isLessThan(150);
    }

    private String home() throws Exception {
        return mvc.perform(get("/api/v1/home"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }
}
