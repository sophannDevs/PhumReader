package app.phumreader.series.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The public catalog against the seeded demo: every number, date and badge the website showed in
 * demo mode must come back from the API on the demo's "today" (Thursday 2026-11-05, noon in Phnom
 * Penh), and move with the clock after that.
 *
 * <p>The demo is seeded once into this context's database and kept ({@link SeededDemo}): these
 * tests only read, and the one that changes data rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
class CatalogApiTest {

    /** Thursday 2026-11-05, 12:00 in Asia/Phnom_Penh. */
    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");

    private static final DateTimeFormatter DEMO_DATE =
            DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.US);
    private static final Pattern COUNT =
            Pattern.compile("^([\\d.,]+)\\s*([KMB])?$", Pattern.CASE_INSENSITIVE);
    private static final List<String> DAYS =
            List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun");

    private static @Nullable JsonNode demo;

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JsonMapper json;
    @Autowired PlatformTransactionManager transactions;

    @BeforeEach
    void demoContentAtDemoNoon() throws IOException {
        clock.set(DEMO_NOON);
        SeededDemo.ensure(seeder, jdbc, transactions);
        if (demo == null) {
            try (InputStream in = new ClassPathResource("seed/demo-data.json").getInputStream()) {
                demo = json.readTree(in);
            }
        }
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    // ---------- series ----------

    @Test
    void everySeriesCardMatchesTheDemo() throws Exception {
        for (JsonNode s : demo().get("series").values()) {
            String slug = s.get("slug").asString();
            JsonNode card = getJson("/api/v1/series/" + slug).get("series");

            assertThat(card.get("slug").asString()).isEqualTo(slug);
            assertThat(card.get("title").asString()).as(slug).isEqualTo(s.get("title").asString());
            assertThat(card.get("type").asString()).as(slug).isEqualTo(s.get("type").asString());
            assertThat(card.get("genre").asString()).as(slug).isEqualTo(s.get("genre").asString());
            assertThat(card.get("creator").asString())
                    .as(slug)
                    .isEqualTo(s.get("creator").asString());
            assertThat(card.get("cover").asString()).as(slug).isEqualTo(s.get("cover").asString());
            assertThat(card.get("views").asLong()).as(slug).isEqualTo(count(s, "views"));
            assertThat(card.get("likes").asLong()).as(slug).isEqualTo(count(s, "likes"));
            assertThat(card.get("freeEpisodes").asInt())
                    .as(slug)
                    .isEqualTo(s.get("freeEpisodes").asInt());
            assertThat(card.get("fastPassEpisodes").asInt())
                    .as(slug)
                    .isEqualTo(s.get("fastPassEpisodes").asInt());
            assertThat(card.get("totalEpisodes").asInt())
                    .as(slug)
                    .isEqualTo(s.get("totalEpisodes").asInt());
            assertThat(card.get("updateDay").asString())
                    .as(slug)
                    .isEqualTo(s.get("updateDay").asString());
            assertThat(card.get("status").asString()).as(slug).isEqualTo("ongoing");
            assertThat(card.get("ageRating").asString()).as(slug).isEqualTo("all");
            assertThat(strings(card.get("language"))).as(slug).containsExactly("en", "km");
            assertThat(card.get("badges").get("isNew").asBoolean())
                    .as(slug + " NEW")
                    .isEqualTo(s.get("badges").get("isNew").asBoolean());
            // UP: the series updates today (Thursday) and released an episode this week.
            assertThat(card.get("badges").get("up").asBoolean())
                    .as(slug + " UP")
                    .isEqualTo(s.get("updateDay").asString().equals("Thu"));
        }
    }

    @Test
    void seriesPageHasSynopsisStatsAndRelatedSeries() throws Exception {
        JsonNode page = getJson("/api/v1/series/glass-compass");

        assertThat(page.get("synopsis").asString())
                .isEqualTo(demo().get("synopsisByGenre").get("Fantasy").asString());
        // Subscribers are 4.68% of likes (1.8M); comments: 3 on the page + 3 on each of 68
        // episodes.
        assertThat(page.get("stats").get("subscribers").asLong()).isEqualTo(84_294);
        assertThat(page.get("stats").get("comments").asLong()).isEqualTo(3 + 3 * 68);
        List<JsonNode> related = list(page.get("related"));
        assertThat(related).hasSize(4);
        assertThat(related)
                .allSatisfy(r -> {
                    assertThat(r.get("genre").asString()).isEqualTo("Fantasy");
                    assertThat(r.get("slug").asString()).isNotEqualTo("glass-compass");
                });
        assertThat(page.get("creatorSeriesCount").asInt()).isEqualTo(seriesOfCreator("Owen Blake"));
    }

    @Test
    void unknownSeriesIsNotFound() throws Exception {
        mvc.perform(get("/api/v1/series/no-such-series"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("series_not_found"));
        mvc.perform(get("/api/v1/series/no-such-series/episodes"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("series_not_found"));
    }

    // ---------- episodes ----------

    @Test
    void episodeListMatchesTheDemoSample() throws Exception {
        JsonNode page = getJson("/api/v1/series/glass-compass/episodes?limit=100");
        List<JsonNode> episodes = list(page.get("items"));
        List<JsonNode> sample = list(demo().get("episodesSample").get("glass-compass"));

        assertThat(page.get("nextCursor").isNull()).isTrue();
        assertThat(episodes).hasSize(sample.size()).hasSize(68);
        for (int i = 0; i < sample.size(); i++) {
            JsonNode expected = sample.get(i);
            JsonNode actual = episodes.get(i);
            String label = "episode " + expected.get("n").asInt();
            boolean fastPass = expected.get("access").asString().equals("fastpass");

            assertThat(actual.get("n").asInt()).as(label).isEqualTo(expected.get("n").asInt());
            assertThat(actual.get("title").asString())
                    .as(label)
                    .isEqualTo(expected.get("title").asString());
            assertThat(actual.get("date").asString())
                    .as(label)
                    .isEqualTo(demoDate(expected.get("date").asString()).toString());
            assertThat(actual.get("likes").asLong()).as(label).isEqualTo(count(expected, "likes"));
            assertThat(actual.get("thumb").asString())
                    .as(label)
                    .isEqualTo(expected.get("thumb").asString());
            assertThat(actual.get("access").asString())
                    .as(label)
                    .isEqualTo(expected.get("access").asString());
            assertThat(actual.get("isUp").asBoolean())
                    .as(label)
                    .isEqualTo(expected.get("isUp").asBoolean());
            if (fastPass) {
                assertThat(actual.get("price").asInt()).as(label).isEqualTo(5);
            } else {
                assertThat(actual.get("price").isNull()).as(label).isTrue();
            }
        }
    }

    @Test
    void generatedChaptersFollowTheEpisodeRule() throws Exception {
        List<JsonNode> chapters =
                list(getJson("/api/v1/series/the-last-archivist/episodes").get("items"));
        List<String> names = strings(demo().get("chapterNames"));

        assertThat(chapters).hasSize(15);
        assertThat(chapters.getFirst().get("title").asString())
                .isEqualTo("Chapter 1: " + names.get(1 % names.size()));
        JsonNode lastFree = chapters.get(11);
        assertThat(lastFree.get("n").asInt()).isEqualTo(12);
        assertThat(lastFree.get("date").asString()).isEqualTo("2026-11-05");
        assertThat(lastFree.get("isUp").asBoolean()).isTrue();
        JsonNode firstFastPass = chapters.get(12);
        assertThat(firstFastPass.get("access").asString()).isEqualTo("fastpass");
        assertThat(firstFastPass.get("date").asString()).isEqualTo("2026-11-12");
        assertThat(firstFastPass.get("price").asInt()).isEqualTo(5);
    }

    @Test
    void episodePagesFollowTheCursorInBothOrders() throws Exception {
        assertThat(allEpisodeNumbers("oldest", 30)).containsExactlyElementsOf(range(1, 68));
        assertThat(allEpisodeNumbers("newest", 30))
                .containsExactlyElementsOf(range(1, 68).reversed());

        mvc.perform(get("/api/v1/series/glass-compass/episodes?sort=random"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.sort").value("invalid_value"));
        String oldestCursor =
                getJson("/api/v1/series/glass-compass/episodes?limit=5")
                        .get("nextCursor")
                        .asString();
        mvc.perform(get("/api/v1/series/glass-compass/episodes?sort=newest&cursor=" + oldestCursor))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_cursor"));
    }

    @Test
    void aFastPassEpisodeTurnsFreeOnItsDate() throws Exception {
        // Thursday 2026-11-12 00:00 in Phnom Penh: episode 66's free date.
        Instant freeDate = Instant.parse("2026-11-11T17:00:00Z");

        clock.set(freeDate.minusSeconds(1));
        assertThat(episode("glass-compass", 66).get("access").asString()).isEqualTo("fastpass");

        clock.set(freeDate.plusSeconds(1));
        JsonNode freed = episode("glass-compass", 66);
        assertThat(freed.get("access").asString()).isEqualTo("free");
        assertThat(freed.get("price").isNull()).isTrue();
        assertThat(freed.get("date").asString()).isEqualTo("2026-11-12");
        assertThat(freed.get("isUp").asBoolean()).isTrue();
        assertThat(episode("glass-compass", 65).get("isUp").asBoolean()).isFalse();
        assertThat(episode("glass-compass", 67).get("access").asString()).isEqualTo("fastpass");

        JsonNode card = getJson("/api/v1/series/glass-compass").get("series");
        assertThat(card.get("freeEpisodes").asInt()).isEqualTo(66);
        assertThat(card.get("fastPassEpisodes").asInt()).isEqualTo(2);
        assertThat(card.get("totalEpisodes").asInt()).isEqualTo(68);
    }

    // ---------- badges ----------

    @Test
    void badgesFollowTheCalendar() throws Exception {
        // Friday noon: Friday's series are UP, Thursday's no longer.
        clock.set(DEMO_NOON.plusSeconds(24 * 3600));
        for (JsonNode card : allSeriesCards()) {
            assertThat(card.get("badges").get("up").asBoolean())
                    .as(card.get("slug").asString())
                    .isEqualTo(card.get("updateDay").asString().equals("Fri"));
        }

        // 2026-11-22: the "new" series launched on 2026-10-22 are older than 30 days.
        clock.set(Instant.parse("2026-11-22T05:00:00Z"));
        assertThat(allSeriesCards()).noneMatch(c -> c.get("badges").get("isNew").asBoolean());

        // Thursday 2026-12-10: the last demo episode turned free on 2026-11-26, two weeks ago.
        clock.set(Instant.parse("2026-12-10T05:00:00Z"));
        assertThat(allSeriesCards()).noneMatch(c -> c.get("badges").get("up").asBoolean());
    }

    // ---------- home ----------

    @Test
    void homeFeedHasEverySection() throws Exception {
        JsonNode home = getJson("/api/v1/home");

        assertThat(home.get("today").asString()).isEqualTo("Thu");

        List<JsonNode> hero = list(home.get("hero"));
        List<JsonNode> demoHero = list(demo().get("homeHero"));
        assertThat(hero).hasSize(demoHero.size());
        for (int i = 0; i < hero.size(); i++) {
            assertThat(hero.get(i).get("series").asString())
                    .isEqualTo(demoHero.get(i).get("series").asString());
            assertThat(hero.get(i).get("tag").asString())
                    .isEqualTo(demoHero.get(i).get("tag").asString());
            assertThat(hero.get(i).get("blurb").asString())
                    .isEqualTo(demoHero.get(i).get("blurb").asString());
            assertThat(hero.get(i).get("seriesData").get("slug").asString())
                    .isEqualTo(demoHero.get(i).get("series").asString());
        }

        JsonNode daily = home.get("daily");
        assertThat(daily.propertyNames()).containsExactlyElementsOf(DAYS);
        for (String day : DAYS) {
            List<JsonNode> cards = list(daily.get(day));
            assertThat(cards).as(day).hasSize(6);
            assertThat(cards).as(day).allMatch(c -> c.get("updateDay").asString().equals(day));
            assertThat(cards)
                    .as(day + " UP")
                    .allMatch(c -> c.get("badges").get("up").asBoolean() == day.equals("Thu"));
            assertViewsNeverRise(cards);
        }

        List<JsonNode> comics = list(home.get("rankings").get("comics"));
        assertThat(comics.stream().map(r -> r.get("rank").asInt()))
                .containsExactly(1, 2, 3, 4, 5, 6, 7, 8);
        assertThat(comics.stream().map(r -> r.get("series").get("title").asString()))
                .containsExactly(
                        "Paper Tigers",
                        "Neon Monsoon",
                        "Tiny Dragon Café",
                        "The Orchard Pact",
                        "Summer Index",
                        "Ember & Co.",
                        "Captain Nobody",
                        "Salt & Thunder");
        // The demo's movement "▲ 2", "—", "▲ 5", "▼ 1", "NEW", "▲ 1", "▼ 3", "—" as previous
        // places.
        assertThat(comics.stream().map(r -> nullableInt(r.get("previousRank"))))
                .containsExactly(3, 2, 8, 3, null, 7, 4, 8);
        assertThat(list(home.get("rankings").get("novels"))).hasSize(7);

        assertThat(strings(home.get("genres")))
                .containsExactlyElementsOf(strings(demo().get("genres")));
        JsonNode byGenre = home.get("byGenre");
        for (String genre : strings(demo().get("genres"))) {
            List<JsonNode> cards = list(byGenre.get(genre));
            assertThat(cards).as(genre).hasSize(6);
            assertThat(cards).as(genre).allMatch(c -> c.get("genre").asString().equals(genre));
            assertViewsNeverRise(cards);
        }

        List<JsonNode> novels = list(home.get("novels"));
        assertThat(novels).hasSize(6).allMatch(c -> c.get("type").asString().equals("novel"));
        assertViewsNeverRise(novels);
        assertThat(list(home.get("creatorCovers")))
                .hasSize(3)
                .allMatch(c -> c.get("type").asString().equals("comic"));
    }

    @Test
    void theCatalogIsPublicEvenWithAStaleSignInCookie() throws Exception {
        mvc.perform(get("/api/v1/home").cookie(new Cookie("phumreader_at", "not-a-token")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/series/glass-compass/episodes")).andExpect(status().isOk());
    }

    // ---------- rankings and genres ----------

    @Test
    void rankingsArePagedByPlace() throws Exception {
        List<Integer> ranks = new ArrayList<>();
        String cursor = null;
        do {
            JsonNode page =
                    getJson(
                            "/api/v1/rankings?kind=comics&limit=20"
                                    + (cursor == null ? "" : "&cursor=" + cursor));
            list(page.get("items")).forEach(r -> ranks.add(r.get("rank").asInt()));
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
        } while (cursor != null);
        assertThat(ranks).containsExactlyElementsOf(range(1, 41));

        JsonNode novels = getJson("/api/v1/rankings?kind=novels");
        assertThat(list(novels.get("items"))).hasSize(7);
        assertThat(novels.get("nextCursor").isNull()).isTrue();

        mvc.perform(get("/api/v1/rankings?kind=manga"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_value"))
                .andExpect(jsonPath("$.error.fields.kind").value("invalid_value"));
    }

    @Test
    void genresListThePublishedSeriesCount() throws Exception {
        List<JsonNode> genres = list(getJson("/api/v1/genres"));
        assertThat(genres.stream().map(g -> g.get("name").asString()))
                .containsExactlyElementsOf(strings(demo().get("genres")));
        assertThat(genres.stream().map(g -> g.get("slug").asString()))
                .contains("slice-of-life", "sci-fi");
        assertThat(genres).allMatch(g -> g.get("seriesCount").asLong() == 6);

        assertThat(getJson("/api/v1/genres/slice-of-life").get("name").asString())
                .isEqualTo("Slice of life");
        mvc.perform(get("/api/v1/genres/manga"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("genre_not_found"));
    }

    @Test
    @Transactional
    void aHiddenSeriesDisappearsFromTheCatalog() throws Exception {
        jdbc.sql("update series set visibility = 'HIDDEN' where title = 'Paper Tigers'").update();
        String slug =
                jdbc.sql("select slug from series where title = 'Paper Tigers'")
                        .query(String.class)
                        .single();

        mvc.perform(get("/api/v1/series/" + slug)).andExpect(status().isNotFound());
        JsonNode first =
                list(getJson("/api/v1/rankings?kind=comics&limit=1").get("items")).getFirst();
        assertThat(first.get("rank").asInt()).isEqualTo(2);
        assertThat(
                        list(getJson("/api/v1/genres")).stream()
                                .mapToLong(g -> g.get("seriesCount").asLong())
                                .sum())
                .isEqualTo(47);
        assertThat(search("paper tigers")).isEmpty();
        assertThat(allSeriesCards()).hasSize(47);
    }

    // ---------- series lists ----------

    @Test
    void seriesListFiltersSortsAndPages() throws Exception {
        List<JsonNode> sciFi = list(getJson("/api/v1/series?genre=sci-fi").get("items"));
        assertThat(sciFi).hasSize(6).allMatch(c -> c.get("genre").asString().equals("Sci-fi"));
        assertViewsNeverRise(sciFi);

        List<JsonNode> novels = list(getJson("/api/v1/series?type=novel").get("items"));
        assertThat(novels).hasSize(7).allMatch(c -> c.get("type").asString().equals("novel"));

        // Popular, 5 at a time: every series once, views never rising.
        List<JsonNode> popular = seriesPages("popular", 5);
        assertThat(popular).hasSize(48);
        assertThat(popular.stream().map(c -> c.get("id").asString()).distinct()).hasSize(48);
        assertViewsNeverRise(popular);

        // Newest: the 16 series launched on 2026-10-22 (NEW) come first.
        List<JsonNode> newest = seriesPages("newest", 7);
        assertThat(newest).hasSize(48);
        assertThat(newest.stream().map(c -> c.get("id").asString()).distinct()).hasSize(48);
        assertThat(newest.subList(0, 16)).allMatch(c -> c.get("badges").get("isNew").asBoolean());
        assertThat(newest.subList(16, 48)).noneMatch(c -> c.get("badges").get("isNew").asBoolean());

        mvc.perform(get("/api/v1/series?genre=manga"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.genre").value("unknown_genre"));
        mvc.perform(get("/api/v1/series?type=manga"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.type").value("invalid_value"));
        mvc.perform(get("/api/v1/series?cursor=not-a-cursor"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_cursor"));
        String popularCursor = getJson("/api/v1/series?limit=2").get("nextCursor").asString();
        mvc.perform(get("/api/v1/series?sort=newest&cursor=" + popularCursor))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_cursor"));
    }

    // ---------- search ----------

    @Test
    void searchMatchesTitleCreatorAndGenre() throws Exception {
        List<JsonNode> popular = list(getJson("/api/v1/search").get("items"));
        assertThat(popular).hasSize(6);
        assertThat(popular.getFirst().get("views").asLong()).isEqualTo(48_000_000);
        assertViewsNeverRise(popular);

        // Surrounding spaces and case do not matter; titles that start with the text come first.
        assertThat(search(" glass ").getFirst().get("title").asString()).isEqualTo("Glass Compass");
        assertThat(search("SREYLEAK").stream().map(c -> c.get("title").asString()))
                .containsExactlyInAnyOrder(
                        "The Orchard Pact", "Ember & Co.", "Pocket Seasons", "Volt & Vale");
        assertThat(search("sci-fi"))
                .hasSize(6)
                .allMatch(c -> c.get("genre").asString().equals("Sci-fi"));
        assertThat(list(getJson("/api/v1/search?q=a&limit=2").get("items"))).hasSize(2);
        assertThat(search("zzzz")).isEmpty();

        mvc.perform(get("/api/v1/search").param("q", "x".repeat(101)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("validation_failed"));
    }

    @Test
    void searchFiltersByTypeGenreAndStatusAndSorts() throws Exception {
        List<JsonNode> novels = list(getJson("/api/v1/search?type=novel&limit=20").get("items"));
        assertThat(novels).hasSize(7).allMatch(c -> c.get("type").asString().equals("novel"));

        List<JsonNode> sciFiComics =
                list(getJson("/api/v1/search?type=comic&genre=sci-fi&limit=20").get("items"));
        assertThat(sciFiComics)
                .isNotEmpty()
                .allMatch(c -> c.get("genre").asString().equals("Sci-fi"))
                .allMatch(c -> c.get("type").asString().equals("comic"));

        // A text query inside a filter.
        assertThat(list(getJson("/api/v1/search?q=glass&type=novel").get("items"))).isEmpty();
        assertThat(list(getJson("/api/v1/search?q=glass&type=comic").get("items"))).isNotEmpty();

        assertViewsNeverRise(
                list(getJson("/api/v1/search?genre=sci-fi&sort=popular&limit=20").get("items")));
        assertThat(list(getJson("/api/v1/search?status=completed").get("items"))).isEmpty();
        assertThat(list(getJson("/api/v1/search?status=ongoing&limit=3").get("items"))).hasSize(3);
        assertThat(list(getJson("/api/v1/search?sort=newest&limit=5").get("items"))).hasSize(5);

        for (String bad : List.of("type=audio", "status=gone", "sort=random")) {
            mvc.perform(get("/api/v1/search?" + bad))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("invalid_value"));
        }
    }

    @Test
    void suggestionsAreTitles() throws Exception {
        List<String> glass = titles(getJson("/api/v1/search/suggestions?q=glas"));
        assertThat(glass).contains("Glass Compass").doesNotHaveDuplicates();

        assertThat(titles(getJson("/api/v1/search/suggestions"))).hasSize(6);
        assertThat(titles(getJson("/api/v1/search/suggestions?q=zzzz"))).isEmpty();
    }

    // ---------- helpers ----------

    private List<String> titles(JsonNode suggestions) {
        return list(suggestions.get("items")).stream().map(JsonNode::asString).toList();
    }

    private JsonNode getJson(String url) throws Exception {
        String body =
                mvc.perform(get(url))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(body);
    }

    private List<JsonNode> search(String query) throws Exception {
        String body =
                mvc.perform(get("/api/v1/search").param("q", query))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        return list(json.readTree(body).get("items"));
    }

    private JsonNode episode(String slug, int n) throws Exception {
        return list(getJson("/api/v1/series/" + slug + "/episodes?limit=100").get("items")).stream()
                .filter(e -> e.get("n").asInt() == n)
                .findFirst()
                .orElseThrow();
    }

    private List<Integer> allEpisodeNumbers(String sort, int limit) throws Exception {
        List<Integer> numbers = new ArrayList<>();
        String cursor = null;
        do {
            JsonNode page =
                    getJson(
                            "/api/v1/series/glass-compass/episodes?sort="
                                    + sort
                                    + "&limit="
                                    + limit
                                    + (cursor == null ? "" : "&cursor=" + cursor));
            list(page.get("items")).forEach(e -> numbers.add(e.get("n").asInt()));
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
        } while (cursor != null);
        return numbers;
    }

    private List<JsonNode> seriesPages(String sort, int limit) throws Exception {
        List<JsonNode> cards = new ArrayList<>();
        Set<String> cursors = new HashSet<>();
        String cursor = null;
        do {
            JsonNode page =
                    getJson(
                            "/api/v1/series?sort="
                                    + sort
                                    + "&limit="
                                    + limit
                                    + (cursor == null ? "" : "&cursor=" + cursor));
            cards.addAll(list(page.get("items")));
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
            assertThat(cursor == null || cursors.add(cursor)).as("cursor repeats").isTrue();
        } while (cursor != null);
        return cards;
    }

    private List<JsonNode> allSeriesCards() throws Exception {
        return list(getJson("/api/v1/series?limit=100").get("items"));
    }

    private int seriesOfCreator(String creator) {
        return (int)
                list(demo().get("series")).stream()
                        .filter(s -> s.get("creator").asString().equals(creator))
                        .count();
    }

    private static void assertViewsNeverRise(List<JsonNode> cards) {
        for (int i = 1; i < cards.size(); i++) {
            assertThat(cards.get(i).get("views").asLong())
                    .isLessThanOrEqualTo(cards.get(i - 1).get("views").asLong());
        }
    }

    private static JsonNode demo() {
        assertThat(demo).isNotNull();
        return demo;
    }

    private static List<JsonNode> list(JsonNode array) {
        return new ArrayList<>(array.values());
    }

    private static List<String> strings(JsonNode array) {
        return list(array).stream().map(JsonNode::asString).toList();
    }

    private static @Nullable Integer nullableInt(JsonNode node) {
        return node.isNull() ? null : node.asInt();
    }

    private static List<Integer> range(int from, int to) {
        List<Integer> numbers = new ArrayList<>();
        for (int i = from; i <= to; i++) {
            numbers.add(i);
        }
        return numbers;
    }

    /** "Nov 5, 2026" → 2026-11-05. */
    private static LocalDate demoDate(String text) {
        return LocalDate.parse(text, DEMO_DATE);
    }

    /** The website's parseCount: "1.6M" → 1600000. */
    private static long count(JsonNode node, String field) {
        Matcher m = COUNT.matcher(node.get(field).asString().trim());
        assertThat(m.matches()).as(field).isTrue();
        BigDecimal value = new BigDecimal(m.group(1).replace(",", ""));
        long unit =
                switch (m.group(2) == null ? "" : m.group(2).toUpperCase(Locale.ROOT)) {
                    case "K" -> 1_000;
                    case "M" -> 1_000_000;
                    case "B" -> 1_000_000_000;
                    default -> 1;
                };
        return value.multiply(BigDecimal.valueOf(unit)).longValueExact();
    }
}
