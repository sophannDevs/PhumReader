package app.phumreader.library.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The library (plan P3-12): subscribe, follow, the reader's state on a series page, the three
 * library lists with sort and paging, and remove with undo. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class LibraryApiTest {

    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired JsonMapper json;
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

    // ---------- subscriptions ----------

    @Test
    void subscribingCountsOnceAndShowsInTheLibrary() throws Exception {
        UUID reader = sessions.newReader("Dara");
        long before = subscribers("glass-compass");

        for (int i = 0; i < 2; i++) {
            mvc.perform(put("/api/v1/series/glass-compass/subscription").with(sessions.as(reader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.subscribed").value(true))
                    .andExpect(jsonPath("$.subscribers").value(before + 1));
        }
        mvc.perform(get("/api/v1/series/glass-compass").with(sessions.as(reader)))
                .andExpect(jsonPath("$.stats.subscribers").value(before + 1));
        mvc.perform(get("/api/v1/series/glass-compass/me").with(sessions.as(reader)))
                .andExpect(jsonPath("$.subscribed").value(true));
        mvc.perform(get("/api/v1/me/subscriptions").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].series.slug").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].subscribedAt").value("2026-11-05T05:00:00Z"));

        for (int i = 0; i < 2; i++) {
            mvc.perform(
                            delete("/api/v1/series/glass-compass/subscription")
                                    .with(sessions.as(reader)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.subscribed").value(false))
                    .andExpect(jsonPath("$.subscribers").value(before));
        }
        mvc.perform(get("/api/v1/me/subscriptions").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(put("/api/v1/series/no-such-series/subscription").with(sessions.as(reader)))
                .andExpect(status().isNotFound());
    }

    @Test
    void libraryListsSortAndPage() throws Exception {
        UUID reader = sessions.newReader("Dara");
        List<String> slugs =
                List.of(
                        "sunday-sword",
                        "glass-compass",
                        "crown-of-ash",
                        "midnight-courier",
                        "tiny-dragon-cafe");
        for (String slug : slugs) {
            clock.advance(Duration.ofMinutes(1));
            mvc.perform(put("/api/v1/series/" + slug + "/subscription").with(sessions.as(reader)))
                    .andExpect(status().isOk());
        }

        assertThat(subscriptionSlugs(reader, "recent", 2))
                .containsExactly(
                        "tiny-dragon-cafe",
                        "midnight-courier",
                        "crown-of-ash",
                        "glass-compass",
                        "sunday-sword");
        // By title: Crown of Ash, Glass Compass, Midnight Courier, Sunday Sword, Tiny Dragon Café.
        assertThat(subscriptionSlugs(reader, "title", 2))
                .containsExactly(
                        "crown-of-ash",
                        "glass-compass",
                        "midnight-courier",
                        "sunday-sword",
                        "tiny-dragon-cafe");

        mvc.perform(get("/api/v1/me/subscriptions?sort=popular").with(sessions.as(reader)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.sort").value("invalid_value"));
        mvc.perform(get("/api/v1/me/subscriptions?cursor=nonsense").with(sessions.as(reader)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_cursor"));
    }

    @Test
    void removingSubscriptionsCanBeUndone() throws Exception {
        UUID reader = sessions.newReader("Dara");
        for (String slug : List.of("glass-compass", "crown-of-ash", "sunday-sword")) {
            clock.advance(Duration.ofMinutes(1));
            mvc.perform(put("/api/v1/series/" + slug + "/subscription").with(sessions.as(reader)));
        }
        long glassBefore = subscribers("glass-compass");
        String glass = seriesId("glass-compass");
        String crown = seriesId("crown-of-ash");

        String removed =
                mvc.perform(
                                post("/api/v1/me/subscriptions/remove")
                                        .with(sessions.as(reader))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"seriesIds\":[\""
                                                        + glass
                                                        + "\",\""
                                                        + crown
                                                        + "\"]}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.items.length()").value(2))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        assertThat(subscriptionSlugs(reader, "recent", 20)).containsExactly("sunday-sword");
        assertThat(subscribers("glass-compass")).isEqualTo(glassBefore - 1);

        mvc.perform(
                        post("/api/v1/me/subscriptions/restore")
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(removed))
                .andExpect(status().isNoContent());
        // Back in their original places.
        assertThat(subscriptionSlugs(reader, "recent", 20))
                .containsExactly("sunday-sword", "crown-of-ash", "glass-compass");
        assertThat(subscribers("glass-compass")).isEqualTo(glassBefore);

        mvc.perform(
                        post("/api/v1/me/subscriptions/remove")
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"seriesIds\":[]}"))
                .andExpect(status().isBadRequest());
    }

    // ---------- history ----------

    @Test
    void theDemoReadersHistoryCanBeRemovedAndRestored() throws Exception {
        UUID demoReader = sessions.userId("reader@phumireader.app");
        JsonNode history = getJson("/api/v1/me/history", demoReader);
        List<JsonNode> items = new ArrayList<>(history.get("items").values());
        assertThat(items.stream().map(i -> i.get("series").asString()))
                .containsExactly(
                        "crown-of-ash", "tiny-dragon-cafe", "letters-to-tuesday", "sunday-sword");
        assertThat(items.getFirst().get("episode").asInt()).isEqualTo(23);
        assertThat(items.getFirst().get("progress").asDouble())
                .isCloseTo(0.62, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(items.getFirst().get("lastRead").asInt()).isEqualTo(23);

        String removed =
                mvc.perform(
                                post("/api/v1/me/history/remove")
                                        .with(sessions.as(demoReader))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"seriesIds\":[\""
                                                        + seriesId("crown-of-ash")
                                                        + "\",\""
                                                        + seriesId("sunday-sword")
                                                        + "\"]}"))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.items.length()").value(2))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        assertThat(getJson("/api/v1/me/history", demoReader).get("items").size()).isEqualTo(2);

        mvc.perform(
                        post("/api/v1/me/history/restore")
                                .with(sessions.as(demoReader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(removed))
                .andExpect(status().isNoContent());
        List<JsonNode> restored =
                new ArrayList<>(getJson("/api/v1/me/history", demoReader).get("items").values());
        assertThat(restored.stream().map(i -> i.get("series").asString()))
                .containsExactly(
                        "crown-of-ash", "tiny-dragon-cafe", "letters-to-tuesday", "sunday-sword");
        assertThat(restored.getFirst().get("episode").asInt()).isEqualTo(23);

        // By title: Crown of Ash, Letters to Tuesday, Sunday Sword, Tiny Dragon Café.
        mvc.perform(get("/api/v1/me/history?sort=title&limit=3").with(sessions.as(demoReader)))
                .andExpect(jsonPath("$.items[0].series").value("crown-of-ash"))
                .andExpect(jsonPath("$.items[2].series").value("sunday-sword"))
                .andExpect(jsonPath("$.nextCursor").isString());
    }

    // ---------- unlocked ----------

    @Test
    void unlockedEpisodesAreListedAndMarkedOnTheSeriesPage() throws Exception {
        UUID reader = sessions.newReader("Dara");
        unlock(reader, "glass-compass", 67);
        clock.advance(Duration.ofMinutes(1));
        unlock(reader, "midnight-courier", 119);
        clock.advance(Duration.ofMinutes(1));
        unlock(reader, "glass-compass", 66);

        mvc.perform(get("/api/v1/me/unlocked").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].series.slug").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].episode.n").value(66))
                .andExpect(jsonPath("$.items[0].episode.access").value("fastpass"))
                .andExpect(jsonPath("$.items[1].series.slug").value("midnight-courier"))
                .andExpect(jsonPath("$.items[2].episode.n").value(67));
        mvc.perform(get("/api/v1/me/unlocked?sort=title&limit=2").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items[0].episode.n").value(66))
                .andExpect(jsonPath("$.items[1].episode.n").value(67))
                .andExpect(jsonPath("$.nextCursor").isString());
        mvc.perform(get("/api/v1/series/glass-compass/me").with(sessions.as(reader)))
                .andExpect(jsonPath("$.unlocked.length()").value(2))
                .andExpect(jsonPath("$.unlocked[0]").value(66))
                .andExpect(jsonPath("$.unlocked[1]").value(67))
                .andExpect(jsonPath("$.lastRead").value(0))
                .andExpect(jsonPath("$.lastEpisode").doesNotExist());
    }

    // ---------- follows ----------

    @Test
    void followingACreator() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String creatorId =
                getJson("/api/v1/series/glass-compass", reader).get("creatorId").asString();

        mvc.perform(put("/api/v1/creators/" + creatorId + "/follow").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(true))
                .andExpect(jsonPath("$.followers").value(1));
        mvc.perform(get("/api/v1/series/letters-to-tuesday/me").with(sessions.as(reader)))
                .andExpect(jsonPath("$.followingCreator").value(true));
        mvc.perform(get("/api/v1/me/follows").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items[0].name").value("Owen Blake"))
                .andExpect(jsonPath("$.items[0].seriesCount").value(4));

        mvc.perform(delete("/api/v1/creators/" + creatorId + "/follow").with(sessions.as(reader)))
                .andExpect(jsonPath("$.following").value(false))
                .andExpect(jsonPath("$.followers").value(0));
        mvc.perform(
                        put("/api/v1/creators/" + UUID.randomUUID() + "/follow")
                                .with(sessions.as(reader)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("creator_not_found"));
    }

    @Test
    void theLibraryNeedsASignedInReader() throws Exception {
        mvc.perform(get("/api/v1/me/history")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/series/glass-compass/me")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/series/glass-compass/subscription").with(sessions.guest()))
                .andExpect(status().isUnauthorized());
        UUID reader = sessions.newReader("Dara");
        mvc.perform(
                        put("/api/v1/series/glass-compass/subscription")
                                .with(sessions.withoutCsrf(reader)))
                .andExpect(status().isForbidden());
    }

    // ---------- helpers ----------

    private List<String> subscriptionSlugs(UUID reader, String sort, int limit) throws Exception {
        List<String> slugs = new ArrayList<>();
        String cursor = null;
        do {
            JsonNode page =
                    getJson(
                            "/api/v1/me/subscriptions?sort="
                                    + sort
                                    + "&limit="
                                    + limit
                                    + (cursor == null ? "" : "&cursor=" + cursor),
                            reader);
            page.get("items")
                    .values()
                    .forEach(i -> slugs.add(i.get("series").get("slug").asString()));
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
        } while (cursor != null);
        return slugs;
    }

    private JsonNode getJson(String url, UUID user) throws Exception {
        return json.readTree(
                mvc.perform(get(url).with(sessions.as(user)))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8));
    }

    private void unlock(UUID reader, String slug, int number) {
        jdbc.sql(
                        "insert into unlocks (user_id, episode_id, coins, created_at)"
                                + " select :u, e.id, 5, :at from episodes e"
                                + " join series s on s.id = e.series_id"
                                + " where s.slug = :slug and e.number = :n")
                .param("u", reader)
                .param("slug", slug)
                .param("n", number)
                .param("at", clock.instant().atOffset(java.time.ZoneOffset.UTC))
                .update();
    }

    private long subscribers(String slug) {
        return jdbc.sql("select subscriber_count from series where slug = :slug")
                .param("slug", slug)
                .query(Long.class)
                .single();
    }

    private String seriesId(String slug) {
        return jdbc.sql("select id from series where slug = :slug")
                .param("slug", slug)
                .query(UUID.class)
                .single()
                .toString();
    }
}
