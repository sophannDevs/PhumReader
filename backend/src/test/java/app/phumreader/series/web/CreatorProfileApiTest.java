package app.phumreader.series.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.series.service.Handles;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/**
 * Creator earnings and the public profile (V21-05): handles, the profile, Edit profile, the
 * earnings page and the payout method. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class CreatorProfileApiTest {

    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired RateLimiter limiter;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;
    UUID creator;
    String handle;

    @BeforeEach
    void demoAtDemoNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(DEMO_NOON);
        limiter.clear();
        sessions = new Sessions(jwt, jdbc);
        creator =
                jdbc.sql("select creator_id from series where slug = 'glass-compass'")
                        .query(UUID.class)
                        .single();
        // Other test classes may have left earnings of this seeded creator behind; every test rolls
        // back.
        jdbc.sql("delete from creator_earnings where creator_id = :id")
                .param("id", creator)
                .update();
        handle =
                jdbc.sql("select handle from creator_profiles where user_id = :id")
                        .param("id", creator)
                        .query(String.class)
                        .single();
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    // ---------- handles ----------

    @Test
    void handlesComeFromTheLatinLettersOfTheName() {
        assertThat(Handles.base("Dara Vann")).isEqualTo("dara-vann");
        assertThat(Handles.base("Pich & Co.")).isEqualTo("pich-co");
        assertThat(Handles.base("ដារ៉ា")).isEqualTo("creator");
        assertThat(Handles.base("x".repeat(60))).hasSize(Handles.MAX);
        assertThat(Handles.free("Dara", h -> h.equals("dara") || h.equals("dara-2")))
                .isEqualTo("dara-3");
    }

    @Test
    void theSeededCreatorsHaveTheDemoHandles() {
        assertThat(handle).matches("[a-z0-9]+(-[a-z0-9]+)*");
        assertThat(
                        jdbc.sql("select count(*) = count(distinct handle) from creator_profiles")
                                .query(Boolean.class)
                                .single())
                .isTrue();
    }

    @Test
    void becomingACreatorPicksAFreeHandle() throws Exception {
        UUID a = sessions.newReader("Reader A");
        UUID b = sessions.newReader("Reader B");
        UUID c = sessions.newReader("Reader C");
        become(a, "Ink Pen").andExpect(status().isCreated());
        become(b, "Ink  Pen!").andExpect(status().isCreated());
        become(c, "ដារ៉ា").andExpect(status().isCreated());
        assertThat(handleOf(a)).isEqualTo("ink-pen");
        assertThat(handleOf(b)).isEqualTo("ink-pen-2");
        assertThat(handleOf(c)).isEqualTo("creator");

        mvc.perform(get("/api/v1/creator/dashboard").with(sessions.as(b, "CREATOR")))
                .andExpect(jsonPath("$.handle").value("ink-pen-2"));
        mvc.perform(get("/api/v1/creator/dashboard").with(sessions.as(sessions.newReader("R"))))
                .andExpect(jsonPath("$.handle").doesNotExist());
    }

    // ---------- public profile ----------

    @Test
    void theProfileIsPublicAndKnowsTheViewer() throws Exception {
        mvc.perform(get("/api/v1/creators/" + handle))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(creator.toString()))
                .andExpect(jsonPath("$.handle").value(handle))
                .andExpect(jsonPath("$.series[?(@.slug == 'glass-compass')]").exists())
                .andExpect(jsonPath("$.following").value(false))
                .andExpect(jsonPath("$.owner").value(false));
        // The address ignores case.
        mvc.perform(get("/api/v1/creators/" + handle.toUpperCase())).andExpect(status().isOk());

        UUID reader = sessions.newReader("Dara");
        jdbc.sql("insert into creator_follows (user_id, creator_id) values (:u, :c)")
                .param("u", reader)
                .param("c", creator)
                .update();
        mvc.perform(get("/api/v1/creators/" + handle).with(sessions.as(reader)))
                .andExpect(jsonPath("$.following").value(true))
                .andExpect(jsonPath("$.followers").value(1));
        mvc.perform(get("/api/v1/creators/" + handle).with(sessions.as(creator, "CREATOR")))
                .andExpect(jsonPath("$.owner").value(true));

        mvc.perform(get("/api/v1/creators/nobody-here"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("creator_not_found"));
    }

    @Test
    void onlyPublishedSeriesAreListed() throws Exception {
        jdbc.sql("update series set visibility = 'HIDDEN' where slug = 'glass-compass'").update();
        mvc.perform(get("/api/v1/creators/" + handle))
                .andExpect(jsonPath("$.series[?(@.slug == 'glass-compass')]").isEmpty());
    }

    @Test
    void editProfileChangesNameLocationAndBioButNotTheHandle() throws Exception {
        patchProfile(
                        creator,
                        "{\"name\":\"New Pen Name\",\"location\":\"Siem Reap\","
                                + "\"bio\":\"I draw maps.\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("New Pen Name"))
                .andExpect(jsonPath("$.location").value("Siem Reap"))
                .andExpect(jsonPath("$.bio").value("I draw maps."))
                .andExpect(jsonPath("$.handle").value(handle));
        mvc.perform(get("/api/v1/creators/" + handle))
                .andExpect(jsonPath("$.name").value("New Pen Name"));

        // Blank clears location and bio.
        patchProfile(creator, "{\"name\":\"New Pen Name\",\"location\":\" \",\"bio\":\"\"}")
                .andExpect(jsonPath("$.location").doesNotExist())
                .andExpect(jsonPath("$.bio").doesNotExist());

        patchProfile(creator, "{\"name\":\" \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.name").exists());
        patchProfile(creator, "{\"name\":\"" + "n".repeat(61) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.name").value("too_long"));
        patchProfile(creator, "{\"name\":\"Ok\",\"bio\":\"" + "b".repeat(201) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.bio").value("too_long"));
        patchProfile(creator, "{\"name\":\"Ok\",\"location\":\"" + "l".repeat(61) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.location").value("too_long"));

        // A reader who is not a creator cannot.
        mvc.perform(
                        patch("/api/v1/creator/profile")
                                .with(sessions.as(sessions.newReader("R")))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\":\"X\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("not_a_creator"));
    }

    // ---------- earnings ----------

    @Test
    void earningsAreCoinsFromUnlocksByMonthAndSeries() throws Exception {
        UUID r1 = sessions.newReader("R1");
        UUID r2 = sessions.newReader("R2");
        // September (2 readers), October (1), the current month November (1, the same reader as
        // October).
        unlock(r1, 1, 5, "2026-09-10T05:00:00Z");
        unlock(r2, 1, 5, "2026-09-20T05:00:00Z");
        unlock(r2, 2, 7, "2026-09-21T05:00:00Z");
        unlock(r1, 2, 5, "2026-10-12T05:00:00Z");
        unlock(r1, 3, 5, "2026-11-03T05:00:00Z");

        mvc.perform(get("/api/v1/creator/earnings").with(sessions.as(creator, "CREATOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.months.length()").value(6))
                .andExpect(jsonPath("$.months[0].month").value("2026-06"))
                .andExpect(jsonPath("$.months[0].coins").value(0))
                .andExpect(jsonPath("$.months[3].month").value("2026-09"))
                .andExpect(jsonPath("$.months[3].coins").value(17))
                .andExpect(jsonPath("$.months[3].unlocks").value(3))
                .andExpect(jsonPath("$.months[3].readers").value(2))
                .andExpect(jsonPath("$.months[4].coins").value(5))
                .andExpect(jsonPath("$.months[5].month").value("2026-11"))
                .andExpect(jsonPath("$.months[5].coins").value(5))
                .andExpect(jsonPath("$.series[?(@.slug == 'glass-compass')].coins[3]").value(17))
                .andExpect(jsonPath("$.series[?(@.slug == 'glass-compass')].unlocks").value(5))
                // The finished months with coins, newest first; the current month is not paid yet.
                .andExpect(jsonPath("$.history.length()").value(2))
                .andExpect(jsonPath("$.history[0].month").value("2026-10"))
                .andExpect(jsonPath("$.history[0].coins").value(5))
                .andExpect(jsonPath("$.history[1].month").value("2026-09"))
                .andExpect(jsonPath("$.payoutMethod").doesNotExist());
    }

    @Test
    void aMonthStartsAtMidnightInPhnomPenh() throws Exception {
        UUID r1 = sessions.newReader("R1");
        // 17:30 UTC on 31 October is 00:30 on 1 November in Phnom Penh.
        unlock(r1, 1, 5, "2026-10-31T17:30:00Z");
        mvc.perform(get("/api/v1/creator/earnings").with(sessions.as(creator, "CREATOR")))
                .andExpect(jsonPath("$.months[4].coins").value(0))
                .andExpect(jsonPath("$.months[5].coins").value(5));
    }

    @Test
    void anotherCreatorsUnlocksAreNotCounted() throws Exception {
        UUID other = sessions.newReader("Other");
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'CREATOR')")
                .param("id", other)
                .update();
        jdbc.sql(
                        "insert into creator_profiles (user_id, pen_name, accepted_terms_at) values (:id, 'Other', now())")
                .param("id", other)
                .update();
        unlock(sessions.newReader("R1"), 1, 5, "2026-11-03T05:00:00Z");
        mvc.perform(get("/api/v1/creator/earnings").with(sessions.as(other, "CREATOR")))
                .andExpect(jsonPath("$.months[5].coins").value(0))
                .andExpect(jsonPath("$.series.length()").value(0));
    }

    @Test
    void thePayoutMethodIsOnlyTheKind() throws Exception {
        UUID c = creator;
        payout(c, "{\"method\":\"aba\"}").andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/creator/earnings").with(sessions.as(c, "CREATOR")))
                .andExpect(jsonPath("$.payoutMethod").value("aba"));
        payout(c, "{\"method\":\"BANK\"}").andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/creator/earnings").with(sessions.as(c, "CREATOR")))
                .andExpect(jsonPath("$.payoutMethod").value("bank"));
        payout(c, "{\"method\":\"card\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.method").value("invalid_method"));
        mvc.perform(delete("/api/v1/creator/payout-method").with(sessions.as(c, "CREATOR")))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/creator/earnings").with(sessions.as(c, "CREATOR")))
                .andExpect(jsonPath("$.payoutMethod").doesNotExist());
    }

    @Test
    void readersWhoAreNotCreatorsGetNoEarnings() throws Exception {
        UUID reader = sessions.newReader("R");
        mvc.perform(get("/api/v1/creator/earnings").with(sessions.as(reader)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("not_a_creator"));
        payout(reader, "{\"method\":\"aba\"}").andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/creator/earnings")).andExpect(status().isUnauthorized());
    }

    // ---------- helpers ----------

    private ResultActions become(UUID user, String penName) throws Exception {
        return mvc.perform(
                post("/api/v1/creator")
                        .with(sessions.as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"penName\":\"" + penName + "\",\"acceptTerms\":true}"));
    }

    private ResultActions patchProfile(UUID user, String body) throws Exception {
        return mvc.perform(
                patch("/api/v1/creator/profile")
                        .with(sessions.as(user, "CREATOR"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private ResultActions payout(UUID user, String body) throws Exception {
        return mvc.perform(
                put("/api/v1/creator/payout-method")
                        .with(sessions.as(user, "CREATOR"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private String handleOf(UUID user) {
        return jdbc.sql("select handle from creator_profiles where user_id = :id")
                .param("id", user)
                .query(String.class)
                .single();
    }

    /**
     * The reader unlocks episode {@code number} of Glass Compass at that moment; its creator earns
     * the coins.
     */
    private void unlock(UUID reader, int number, int coins, String at) {
        UUID episode =
                jdbc.sql(
                                "select e.id from episodes e join series s on s.id = e.series_id"
                                        + " where s.slug = 'glass-compass' and e.number = :n")
                        .param("n", number)
                        .query(UUID.class)
                        .single();
        UUID unlock =
                jdbc.sql(
                                "insert into unlocks (user_id, episode_id, coins, created_at)"
                                        + " values (:u, :e, :c, :at::timestamptz) returning id")
                        .param("u", reader)
                        .param("e", episode)
                        .param("c", coins)
                        .param("at", at)
                        .query(UUID.class)
                        .single();
        jdbc.sql(
                        "insert into creator_earnings (creator_id, unlock_id, episode_id, coins,"
                                + " created_at) values (:cr, :u, :e, :c, :at::timestamptz)")
                .param("cr", creator)
                .param("u", unlock)
                .param("e", episode)
                .param("c", coins)
                .param("at", at)
                .update();
    }
}
