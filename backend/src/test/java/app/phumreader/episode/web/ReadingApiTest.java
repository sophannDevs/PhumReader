package app.phumreader.episode.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.seed.DemoSeeder;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/**
 * The readers (plan P3-09) on the seeded demo at the demo's "today": free and Fast Pass access,
 * comic panels and chapter text, progress, likes and bookmarks. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class ReadingApiTest {

    /** Thursday 2026-11-05, 12:00 in Asia/Phnom_Penh. */
    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");

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

    // ---------- content ----------

    @Test
    void aFreeComicEpisodeIsOpenToGuests() throws Exception {
        mvc.perform(get("/api/v1/series/glass-compass/episodes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series.slug").value("glass-compass"))
                .andExpect(jsonPath("$.episode.n").value(1))
                .andExpect(jsonPath("$.episode.access").value("free"))
                .andExpect(jsonPath("$.total").value(68))
                .andExpect(jsonPath("$.previous").doesNotExist())
                .andExpect(jsonPath("$.next.n").value(2))
                .andExpect(jsonPath("$.panels.length()").value(9))
                .andExpect(
                        jsonPath("$.panels[0].src")
                                .value("/panels/ddeff94b48d22dc29b42285cab341132.svg"))
                .andExpect(jsonPath("$.panels[0].width").value(800))
                .andExpect(jsonPath("$.panels[0].height").value(760))
                .andExpect(jsonPath("$.panels[0].alt").value("Panel 1"))
                .andExpect(jsonPath("$.blocks.length()").value(0))
                .andExpect(jsonPath("$.wordCount").value(0))
                .andExpect(jsonPath("$.comments").value(3))
                .andExpect(jsonPath("$.commentsEnabled").value(true))
                .andExpect(jsonPath("$.viewer.signedIn").value(false))
                .andExpect(jsonPath("$.viewer.liked").value(false));
    }

    @Test
    void aNovelChapterHasItsTextAndTheCreatorsNote() throws Exception {
        mvc.perform(get("/api/v1/series/the-last-archivist/episodes/12"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series.type").value("novel"))
                .andExpect(jsonPath("$.panels.length()").value(0))
                .andExpect(jsonPath("$.blocks.length()").value(15))
                .andExpect(jsonPath("$.blocks[0].type").value("paragraph"))
                .andExpect(jsonPath("$.blocks[3].type").value("quote"))
                .andExpect(jsonPath("$.blocks[5].type").value("scene-break"))
                .andExpect(jsonPath("$.blocks[5].text").doesNotExist())
                .andExpect(
                        jsonPath("$.creatorNote")
                                .value(org.hamcrest.Matchers.startsWith("Thank you for reading!")))
                .andExpect(jsonPath("$.wordCount").value(org.hamcrest.Matchers.greaterThan(100)))
                .andExpect(jsonPath("$.previous.n").value(11))
                .andExpect(jsonPath("$.next.n").value(13))
                .andExpect(jsonPath("$.next.access").value("fastpass"))
                .andExpect(jsonPath("$.next.price").value(5));
    }

    @Test
    void aFastPassEpisodeAnswers402UntilUnlocked() throws Exception {
        // Guests and readers without an unlock: 402 with the price and the free date.
        mvc.perform(get("/api/v1/series/glass-compass/episodes/66"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error.code").value("episode_locked"))
                .andExpect(jsonPath("$.error.price").value(5))
                .andExpect(jsonPath("$.error.freeOn").value("2026-11-12"));
        UUID reader = sessions.newReader("Dara");
        mvc.perform(get("/api/v1/series/glass-compass/episodes/66").with(sessions.as(reader)))
                .andExpect(status().isPaymentRequired());

        // After an unlock (made by the coins API in part 4) the reader may read it.
        unlock(reader, "glass-compass", 66);
        mvc.perform(get("/api/v1/series/glass-compass/episodes/66").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.episode.access").value("fastpass"))
                .andExpect(jsonPath("$.viewer.unlocked").value(true))
                .andExpect(jsonPath("$.next.n").value(67));
        mvc.perform(get("/api/v1/series/glass-compass/episodes/67").with(sessions.as(reader)))
                .andExpect(status().isPaymentRequired());

        // The series' creator and admins read everything.
        UUID owen = sessions.creatorId("Owen Blake");
        mvc.perform(
                        get("/api/v1/series/glass-compass/episodes/68")
                                .with(sessions.as(owen, "READER", "CREATOR")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewer.unlocked").value(false));
        mvc.perform(
                        get("/api/v1/series/glass-compass/episodes/68")
                                .with(sessions.as(reader, "READER", "ADMIN")))
                .andExpect(status().isOk());

        // On its free date it is free for everyone.
        clock.set(Instant.parse("2026-11-11T17:00:01Z"));
        mvc.perform(get("/api/v1/series/glass-compass/episodes/66"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.episode.access").value("free"));
    }

    @Test
    void unknownOrUnreleasedEpisodesAreNotFound() throws Exception {
        mvc.perform(get("/api/v1/series/glass-compass/episodes/69"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("episode_not_found"));
        mvc.perform(get("/api/v1/series/no-such-series/episodes/1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("series_not_found"));
        mvc.perform(get("/api/v1/series/glass-compass/episodes/one"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_parameter"));

        // A scheduled (not yet published) episode stays hidden.
        jdbc.sql(
                        "update episodes set status = 'SCHEDULED' where number = 1 and series_id ="
                                + " (select id from series where slug = 'glass-compass')")
                .update();
        mvc.perform(get("/api/v1/series/glass-compass/episodes/1"))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/series/glass-compass/episodes/2"))
                .andExpect(jsonPath("$.previous").doesNotExist());
    }

    // ---------- progress ----------

    @Test
    void progressFeedsContinueReading() throws Exception {
        UUID reader = sessions.newReader("Dara");

        saveProgress(reader, "glass-compass", 3, 0.5).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/history").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].series").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].episode").value(3))
                .andExpect(jsonPath("$.items[0].progress").value(0.5))
                .andExpect(jsonPath("$.items[0].lastRead").value(3))
                .andExpect(jsonPath("$.items[0].seriesData.title").value("Glass Compass"));

        // Going back to episode 1 keeps the highest episode read.
        saveProgress(reader, "glass-compass", 1, 1.0).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/series/glass-compass/me").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastRead").value(3))
                .andExpect(jsonPath("$.lastEpisode").value(1))
                .andExpect(jsonPath("$.progress").value(1.0));

        saveProgress(reader, "glass-compass", 66, 0.1).andExpect(status().isPaymentRequired());
        saveProgress(reader, "glass-compass", 3, 1.5)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.progress").exists());
        mvc.perform(
                        put("/api/v1/series/glass-compass/progress")
                                .with(sessions.guest())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"episode\":1,\"progress\":0.5}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(
                        put("/api/v1/series/glass-compass/progress")
                                .with(sessions.withoutCsrf(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"episode\":1,\"progress\":0.5}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("invalid_csrf_token"));
    }

    // ---------- likes and bookmarks ----------

    @Test
    void likesAndBookmarksAreToggledOnce() throws Exception {
        UUID reader = sessions.newReader("Dara");
        long episodeLikes = likes("episodes", "glass-compass", 65);
        long seriesLikes = seriesLikes("glass-compass");

        for (int i = 0; i < 2; i++) {
            mvc.perform(
                            put("/api/v1/series/glass-compass/episodes/65/like")
                                    .with(sessions.as(reader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.liked").value(true))
                    .andExpect(jsonPath("$.likes").value(episodeLikes + 1));
        }
        assertThat(seriesLikes("glass-compass")).isEqualTo(seriesLikes + 1);
        mvc.perform(
                        put("/api/v1/series/glass-compass/episodes/65/bookmark")
                                .with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bookmarked").value(true));
        mvc.perform(get("/api/v1/series/glass-compass/episodes/65").with(sessions.as(reader)))
                .andExpect(jsonPath("$.viewer.signedIn").value(true))
                .andExpect(jsonPath("$.viewer.liked").value(true))
                .andExpect(jsonPath("$.viewer.bookmarked").value(true))
                .andExpect(jsonPath("$.episode.likes").value(episodeLikes + 1));

        for (int i = 0; i < 2; i++) {
            mvc.perform(
                            delete("/api/v1/series/glass-compass/episodes/65/like")
                                    .with(sessions.as(reader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.liked").value(false))
                    .andExpect(jsonPath("$.likes").value(episodeLikes));
        }
        assertThat(seriesLikes("glass-compass")).isEqualTo(seriesLikes);
        mvc.perform(
                        delete("/api/v1/series/glass-compass/episodes/65/bookmark")
                                .with(sessions.as(reader)))
                .andExpect(jsonPath("$.bookmarked").value(false));

        mvc.perform(put("/api/v1/series/glass-compass/episodes/66/like").with(sessions.as(reader)))
                .andExpect(status().isPaymentRequired());
        mvc.perform(put("/api/v1/series/glass-compass/episodes/65/like").with(sessions.guest()))
                .andExpect(status().isUnauthorized());
    }

    // ---------- helpers ----------

    private org.springframework.test.web.servlet.ResultActions saveProgress(
            UUID reader, String slug, int episode, double progress) throws Exception {
        return mvc.perform(
                put("/api/v1/series/" + slug + "/progress")
                        .with(sessions.as(reader))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"episode\":" + episode + ",\"progress\":" + progress + "}"));
    }

    private void unlock(UUID reader, String slug, int number) {
        jdbc.sql(
                        "insert into unlocks (user_id, episode_id, coins) select :u, e.id, 5"
                                + " from episodes e join series s on s.id = e.series_id"
                                + " where s.slug = :slug and e.number = :n")
                .param("u", reader)
                .param("slug", slug)
                .param("n", number)
                .update();
    }

    private long likes(String table, String slug, int number) {
        return jdbc.sql(
                        "select e.like_count from "
                                + table
                                + " e join series s on s.id = e.series_id"
                                + " where s.slug = :slug and e.number = :n")
                .param("slug", slug)
                .param("n", number)
                .query(Long.class)
                .single();
    }

    private long seriesLikes(String slug) {
        return jdbc.sql("select like_count from series where slug = :slug")
                .param("slug", slug)
                .query(Long.class)
                .single();
    }
}
