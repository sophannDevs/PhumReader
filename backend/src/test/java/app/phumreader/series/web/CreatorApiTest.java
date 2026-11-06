package app.phumreader.series.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/**
 * The creator dashboard (plan P3-14 stats) for the demo's stand-in creator, Chan Sreyleak ({@code
 * creator@toonwave.app}), at the demo's "today".
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class CreatorApiTest {

    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");
    static final String DASHBOARD = "/api/v1/creator/dashboard";

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;

    @BeforeEach
    void demoAtDemoNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(DEMO_NOON);
        sessions = new Sessions(jwt, jdbc);
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    @Test
    void theStandInCreatorSeesTheirFourSeriesWithTheirNumbers() throws Exception {
        UUID creator = sessions.userId("creator@toonwave.app");
        String body =
                mvc.perform(get(DASHBOARD).with(sessions.as(creator, "READER", "CREATOR")))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.creator").value(true))
                        .andExpect(jsonPath("$.name").value("Chan Sreyleak"))
                        .andExpect(jsonPath("$.totals.series").value(4))
                        // Most viewed first (demo-data.json: 48M, 23M, 3.9M, 1.6M views).
                        .andExpect(jsonPath("$.series[0].series.slug").value("pocket-seasons"))
                        .andExpect(jsonPath("$.series[1].series.slug").value("volt-and-vale"))
                        .andExpect(jsonPath("$.series[2].series.slug").value("the-orchard-pact"))
                        .andExpect(jsonPath("$.series[3].series.slug").value("ember-and-co"))
                        .andExpect(jsonPath("$.series[0].series.creator").value("Chan Sreyleak"))
                        .andExpect(jsonPath("$.series[0].series.fastPassEpisodes").value(3))
                        .andExpect(jsonPath("$.series[0].visibility").value("published"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();

        assertThat(JsonPath.<Number>read(body, "$.totals.views").longValue())
                .isEqualTo(sum("view_count"))
                .isEqualTo(76_500_000L);
        assertThat(JsonPath.<Number>read(body, "$.totals.likes").longValue())
                .isEqualTo(sum("like_count"))
                .isEqualTo(14_400_000L);
        assertThat(JsonPath.<Number>read(body, "$.totals.subscribers").longValue())
                .isEqualTo(sum("subscriber_count"));

        // The comment count matches the series page.
        long pageComments =
                JsonPath.<Number>read(
                                mvc.perform(get("/api/v1/series/pocket-seasons"))
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString(),
                                "$.stats.comments")
                        .longValue();
        assertThat(JsonPath.<Number>read(body, "$.series[0].comments").longValue())
                .isEqualTo(pageComments);
    }

    @Test
    void anUnlockShowsUpAsEarnings() throws Exception {
        UUID creator = sessions.userId("creator@toonwave.app");
        String before = dashboard(creator);
        long earnedBefore = JsonPath.<Number>read(before, "$.totals.earnedCoins").longValue();
        long unlocksBefore = JsonPath.<Number>read(before, "$.series[0].unlocks").longValue();

        int episode =
                jdbc.sql(
                                "select e.number from episodes e join series s on s.id = e.series_id"
                                        + " where s.slug = 'pocket-seasons' and e.free_at > :now"
                                        + " order by e.number limit 1")
                        .param("now", DEMO_NOON.atOffset(ZoneOffset.UTC))
                        .query(Integer.class)
                        .single();
        UUID reader = sessions.newReader("Dara");
        sessions.grantCoins(reader, 20);
        String unlocked =
                mvc.perform(
                                post("/api/v1/series/pocket-seasons/episodes/"
                                                + episode
                                                + "/unlock")
                                        .with(sessions.as(reader))
                                        .header("Idempotency-Key", "creator-test-0001"))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        int price = JsonPath.read(unlocked, "$.coins");
        assertThat(price).isPositive();

        String after = dashboard(creator);
        assertThat(JsonPath.<Number>read(after, "$.totals.earnedCoins").longValue())
                .isEqualTo(earnedBefore + price);
        assertThat(JsonPath.<Number>read(after, "$.totals.unlocks").longValue())
                .isEqualTo(JsonPath.<Number>read(before, "$.totals.unlocks").longValue() + 1);
        assertThat(JsonPath.<Number>read(after, "$.series[0].unlocks").longValue())
                .isEqualTo(unlocksBefore + 1);
    }

    @Test
    void readersGetAnEmptyDashboard() throws Exception {
        UUID demoReader = sessions.userId("reader@toonwave.app");
        mvc.perform(get(DASHBOARD).with(sessions.as(demoReader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.creator").value(false))
                .andExpect(jsonPath("$.name").doesNotExist())
                .andExpect(jsonPath("$.series.length()").value(0))
                .andExpect(jsonPath("$.totals.series").value(0))
                .andExpect(jsonPath("$.totals.views").value(0));
        // A CREATOR role in the token alone is not enough: the profile decides.
        mvc.perform(get(DASHBOARD).with(sessions.as(demoReader, "READER", "CREATOR")))
                .andExpect(jsonPath("$.creator").value(false));
        mvc.perform(get(DASHBOARD)).andExpect(status().isUnauthorized());
    }

    private String dashboard(UUID creator) throws Exception {
        return mvc.perform(get(DASHBOARD).with(sessions.as(creator, "READER", "CREATOR")))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
    }

    private long sum(String column) {
        return jdbc.sql(
                        "select coalesce(sum(s."
                                + column
                                + "), 0) from series s join creator_profiles p"
                                + " on p.user_id = s.creator_id where p.pen_name = 'Chan Sreyleak'")
                .query(Long.class)
                .single();
    }
}
