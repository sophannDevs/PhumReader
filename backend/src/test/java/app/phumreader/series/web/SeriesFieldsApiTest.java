package app.phumreader.series.web;

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
import com.jayway.jsonpath.JsonPath;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/**
 * The series and episode fields of the V2.1 forms (V21-02): second genre, age 16+, several update
 * days, release hour, the series' Fast Pass and comments switches, the break message, hiding one
 * episode and deleting a series. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class SeriesFieldsApiTest {

    /** Thursday 2026-11-05, noon in Phnom Penh. */
    static final Instant NOON = Instant.parse("2026-11-05T05:00:00Z");

    static final String SERIES = "/api/v1/creator/series";
    static final String COVER = "https://cdn.phumireader.test/covers/test.webp";

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;
    UUID creator;

    @BeforeEach
    void aCreatorAtDemoNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(NOON);
        sessions = new Sessions(jwt, jdbc);
        creator = newCreator("Mara");
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    // ================================================================ the series form

    @Test
    void everyNewFieldIsSavedAndReadBack() throws Exception {
        ResultActions created =
                mvc.perform(
                                post(SERIES)
                                        .with(me())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                body(
                                                        "Tide of Glass",
                                                        "\"secondGenre\":\"romance\","
                                                                + "\"ageRating\":\"teen16\","
                                                                + "\"updateDays\":[\"Thu\",\"Mon\"],"
                                                                + "\"releaseHour\":20,"
                                                                + "\"fastPass\":{\"on\":false,\"ahead\":2},"
                                                                + "\"commentsEnabled\":false,"
                                                                + "\"status\":\"hiatus\","
                                                                + "\"breakMessage\":\"  Back in March.  \"")))
                        .andExpect(status().isCreated());
        String id =
                JsonPath.read(
                        created.andReturn()
                                .getResponse()
                                .getContentAsString(StandardCharsets.UTF_8),
                        "$.id");
        for (ResultActions r : List.of(created, editOf(id).andExpect(status().isOk()))) {
            r.andExpect(jsonPath("$.genre").value("fantasy"))
                    .andExpect(jsonPath("$.secondGenre").value("romance"))
                    .andExpect(jsonPath("$.ageRating").value("teen16"))
                    // Week order, Monday first.
                    .andExpect(jsonPath("$.updateDays.length()").value(2))
                    .andExpect(jsonPath("$.updateDays[0]").value("Mon"))
                    .andExpect(jsonPath("$.updateDays[1]").value("Thu"))
                    .andExpect(jsonPath("$.releaseHour").value(20))
                    .andExpect(jsonPath("$.fastPass.on").value(false))
                    .andExpect(jsonPath("$.fastPass.ahead").value(2))
                    .andExpect(jsonPath("$.commentsEnabled").value(false))
                    .andExpect(jsonPath("$.status").value("hiatus"))
                    .andExpect(jsonPath("$.breakMessage").value("Back in March."));
        }

        // A full save: left-out fields take their defaults, another status drops the message.
        update(
                        id,
                        "Tide of Glass",
                        "\"secondGenre\":\"drama\",\"ageRating\":\"mature\","
                                + "\"updateDays\":[\"Sat\"],\"releaseHour\":0,"
                                + "\"fastPass\":{\"on\":true,\"ahead\":5},\"commentsEnabled\":true,"
                                + "\"status\":\"ongoing\",\"breakMessage\":\"Back in March.\"")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secondGenre").value("drama"))
                .andExpect(jsonPath("$.ageRating").value("mature"))
                .andExpect(jsonPath("$.updateDays[0]").value("Sat"))
                .andExpect(jsonPath("$.releaseHour").value(0))
                .andExpect(jsonPath("$.fastPass.on").value(true))
                .andExpect(jsonPath("$.fastPass.ahead").value(5))
                .andExpect(jsonPath("$.commentsEnabled").value(true))
                .andExpect(jsonPath("$.status").value("ongoing"))
                .andExpect(jsonPath("$.breakMessage").doesNotExist());
        update(id, "Tide of Glass", "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secondGenre").doesNotExist())
                .andExpect(jsonPath("$.ageRating").value("all"))
                .andExpect(jsonPath("$.updateDays.length()").value(0))
                .andExpect(jsonPath("$.releaseHour").doesNotExist())
                .andExpect(jsonPath("$.fastPass.on").value(true))
                .andExpect(jsonPath("$.fastPass.ahead").value(3))
                .andExpect(jsonPath("$.commentsEnabled").value(true))
                .andExpect(jsonPath("$.status").value("ongoing"));
        assertThat(
                        jdbc.sql("select break_message from series where id = :id")
                                .param("id", UUID.fromString(id))
                                .query(String.class)
                                .optional())
                .isEmpty();

        // The dashboard's list carries the new card fields too.
        mvc.perform(get(SERIES + "?q=tide").with(me()))
                .andExpect(jsonPath("$[0].series.updateDays.length()").value(0))
                .andExpect(jsonPath("$[0].series.updateDay").doesNotExist());
    }

    @Test
    void aNewSeriesHasTheDefaults() throws Exception {
        String id = create("Plain", "");
        editOf(id)
                .andExpect(jsonPath("$.secondGenre").doesNotExist())
                .andExpect(jsonPath("$.ageRating").value("all"))
                .andExpect(jsonPath("$.updateDays.length()").value(0))
                .andExpect(jsonPath("$.releaseHour").doesNotExist())
                .andExpect(jsonPath("$.fastPass.on").value(true))
                .andExpect(jsonPath("$.fastPass.ahead").value(3))
                .andExpect(jsonPath("$.commentsEnabled").value(true))
                .andExpect(jsonPath("$.breakMessage").doesNotExist());
        // A message without the hiatus status is dropped on create as well.
        String other =
                create(
                        "Not on a break",
                        "\"status\":\"completed\",\"breakMessage\":\"Back soon.\"");
        editOf(other)
                .andExpect(jsonPath("$.status").value("completed"))
                .andExpect(jsonPath("$.breakMessage").doesNotExist());
    }

    @Test
    void theNewFieldsAreChecked() throws Exception {
        String id = create("Checked", "");
        expectInvalid(id, "\"secondGenre\":\"fantasy\"", "secondGenre", "same_as_genre");
        expectInvalid(id, "\"secondGenre\":\"nope\"", "secondGenre", "unknown_genre");
        expectInvalid(
                id, "\"updateDays\":[\"Mon\",\"Thu\",\"Mon\"]", "updateDays", "duplicate_day");
        expectInvalid(
                id,
                "\"updateDays\":[\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\",\"Sun\",\"Mon\"]",
                "updateDays",
                null);
        expectInvalid(id, "\"releaseHour\":-1", "releaseHour", null);
        expectInvalid(id, "\"releaseHour\":24", "releaseHour", null);
        expectInvalid(id, "\"fastPass\":{\"on\":true,\"ahead\":0}", "fastPass.ahead", null);
        expectInvalid(id, "\"fastPass\":{\"on\":true,\"ahead\":6}", "fastPass.ahead", null);
        expectInvalid(id, "\"fastPass\":{\"on\":true}", "fastPass.ahead", null);
        expectInvalid(id, "\"fastPass\":{\"ahead\":2}", "fastPass.on", null);
        expectInvalid(
                id,
                "\"status\":\"hiatus\",\"breakMessage\":\"" + "x".repeat(121) + "\"",
                "breakMessage",
                null);
        update(id, "Checked", "\"ageRating\":\"teen17\"").andExpect(status().isBadRequest());
        update(id, "Checked", "\"updateDays\":[\"Someday\"]").andExpect(status().isBadRequest());

        // Every day of the week and the longest message are fine.
        update(
                        id,
                        "Checked",
                        "\"updateDays\":[\"Sun\",\"Sat\",\"Fri\",\"Thu\",\"Wed\",\"Tue\",\"Mon\"],"
                                + "\"status\":\"hiatus\",\"breakMessage\":\""
                                + "x".repeat(120)
                                + "\",\"releaseHour\":23")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updateDays[0]").value("Mon"))
                .andExpect(jsonPath("$.updateDays[6]").value("Sun"))
                .andExpect(jsonPath("$.breakMessage").value("x".repeat(120)));
        // The creating form is checked the same way.
        mvc.perform(
                        post(SERIES)
                                .with(me())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body("X", "\"secondGenre\":\"fantasy\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.secondGenre").value("same_as_genre"));
    }

    // ================================================================ readers

    @Test
    void readersSeeTheSecondGenreTheAgeEveryDayAndTheBreak() throws Exception {
        String id =
                create(
                        "Glass Break",
                        "\"secondGenre\":\"romance\",\"ageRating\":\"teen16\","
                                + "\"updateDays\":[\"Thu\",\"Mon\"],\"commentsEnabled\":false,"
                                + "\"status\":\"hiatus\",\"breakMessage\":\"Back in March.\"");
        approve(id);

        mvc.perform(get("/api/v1/series/glass-break"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.series.ageRating").value("teen16"))
                .andExpect(jsonPath("$.series.genre").value("Fantasy"))
                .andExpect(jsonPath("$.series.updateDay").value("Mon"))
                .andExpect(jsonPath("$.series.updateDays.length()").value(2))
                .andExpect(jsonPath("$.series.updateDays[0]").value("Mon"))
                .andExpect(jsonPath("$.series.updateDays[1]").value("Thu"))
                .andExpect(jsonPath("$.series.status").value("hiatus"))
                .andExpect(jsonPath("$.secondGenre").value("romance"))
                .andExpect(jsonPath("$.breakMessage").value("Back in March."))
                .andExpect(jsonPath("$.commentsEnabled").value(false));
        mvc.perform(get("/api/v1/series?genre=fantasy&sort=newest&limit=1"))
                .andExpect(jsonPath("$.items[0].slug").value("glass-break"))
                .andExpect(jsonPath("$.items[0].ageRating").value("teen16"))
                .andExpect(jsonPath("$.items[0].updateDays.length()").value(2));
        // Genre lists keep using the main genre only.
        mvc.perform(get("/api/v1/series?genre=romance&sort=newest&limit=50"))
                .andExpect(jsonPath("$.items[?(@.slug == 'glass-break')]").isEmpty());
    }

    @Test
    void homesDailyListsAndTheUpBadgeUseEveryUpdateDay() throws Exception {
        String twice = create("Twice a Week", "\"updateDays\":[\"Thu\",\"Mon\"]");
        String notToday = create("Not Today", "\"updateDays\":[\"Tue\",\"Sat\"]");
        for (String id : List.of(twice, notToday)) {
            approve(id);
            chapter(id, "One", "{\"mode\":\"now\"}", null).andExpect(status().isCreated());
        }
        // The most viewed series of their days.
        jdbc.sql("update series set view_count = :v where id = :id")
                .param("v", 900_000_000_000L)
                .param("id", UUID.fromString(twice))
                .update();
        jdbc.sql("update series set view_count = :v where id = :id")
                .param("v", 800_000_000_000L)
                .param("id", UUID.fromString(notToday))
                .update();

        String home = getString("/api/v1/home");
        assertThat(JsonPath.<String>read(home, "$.today")).isEqualTo("Thu");
        for (String day : List.of("Mon", "Thu")) {
            assertThat(JsonPath.<String>read(home, "$.daily." + day + "[0].slug"))
                    .as(day)
                    .isEqualTo("twice-a-week");
        }
        for (String day : List.of("Tue", "Sat")) {
            assertThat(JsonPath.<String>read(home, "$.daily." + day + "[0].slug"))
                    .as(day)
                    .isEqualTo("not-today");
        }
        for (String day : List.of("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")) {
            List<String> slugs = JsonPath.read(home, "$.daily." + day + "[*].slug");
            assertThat(slugs).as(day).hasSize(6).doesNotHaveDuplicates();
            assertThat(slugs.contains("twice-a-week"))
                    .as(day)
                    .isEqualTo(day.equals("Mon") || day.equals("Thu"));
            assertThat(slugs.contains("not-today"))
                    .as(day)
                    .isEqualTo(day.equals("Tue") || day.equals("Sat"));
        }

        // UP today (Thursday) for the series that also updates on Thursdays.
        mvc.perform(get("/api/v1/series/twice-a-week"))
                .andExpect(jsonPath("$.series.badges.up").value(true))
                .andExpect(jsonPath("$.series.updateDay").value("Mon"));
        mvc.perform(get("/api/v1/series/not-today"))
                .andExpect(jsonPath("$.series.badges.up").value(false));
        // On Saturday it is the other way round.
        clock.set(NOON.plus(Duration.ofDays(2)));
        mvc.perform(get("/api/v1/series/twice-a-week"))
                .andExpect(jsonPath("$.series.badges.up").value(false));
        mvc.perform(get("/api/v1/series/not-today"))
                .andExpect(jsonPath("$.series.badges.up").value(true));
    }

    // ================================================================ Fast Pass defaults

    @Test
    void newEpisodesTakeTheSeriesFastPassWhenAsked() throws Exception {
        // Weekly, 3 ahead: free after 21 days.
        String weekly =
                create("Weekly", "\"updateDays\":[\"Fri\"],\"fastPass\":{\"on\":true,\"ahead\":3}");
        approve(weekly);
        chapter(weekly, "One", "{\"mode\":\"now\"}", "\"useSeriesFastPass\":true")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.priceCoins").value(5))
                .andExpect(jsonPath("$.freeAfterDays").value(21))
                .andExpect(jsonPath("$.freeAt").value(NOON.plus(Duration.ofDays(21)).toString()));
        // Without the flag nothing changes: fastPass null is free, {} is 5 coins for 7 days.
        chapter(weekly, "Two", "{\"mode\":\"now\"}", "\"fastPass\":null")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.priceCoins").doesNotExist())
                .andExpect(jsonPath("$.freeAt").doesNotExist());
        chapter(weekly, "Three", "{\"mode\":\"draft\"}", "\"fastPass\":{}")
                .andExpect(jsonPath("$.priceCoins").value(5))
                .andExpect(jsonPath("$.freeAfterDays").value(7));

        // Twice a week, 3 ahead: ceil(21 / 2) = 11. No schedule, 5 ahead: 35. Daily, 1 ahead: 1.
        String twice =
                create(
                        "Twice",
                        "\"updateDays\":[\"Mon\",\"Thu\"],\"fastPass\":{\"on\":true,\"ahead\":3}");
        chapter(twice, "One", "{\"mode\":\"draft\"}", "\"useSeriesFastPass\":true")
                .andExpect(jsonPath("$.freeAfterDays").value(11));
        String loose = create("Loose", "\"fastPass\":{\"on\":true,\"ahead\":5}");
        chapter(loose, "One", "{\"mode\":\"draft\"}", "\"useSeriesFastPass\":true")
                .andExpect(jsonPath("$.freeAfterDays").value(35));
        String daily =
                create(
                        "Daily",
                        "\"updateDays\":[\"Mon\",\"Tue\",\"Wed\",\"Thu\",\"Fri\",\"Sat\",\"Sun\"],"
                                + "\"fastPass\":{\"on\":true,\"ahead\":1}");
        chapter(daily, "One", "{\"mode\":\"draft\"}", "\"useSeriesFastPass\":true")
                .andExpect(jsonPath("$.freeAfterDays").value(1));

        // Series Fast Pass off: new episodes are free.
        String off = create("Off", "\"fastPass\":{\"on\":false,\"ahead\":3}");
        chapter(off, "One", "{\"mode\":\"draft\"}", "\"useSeriesFastPass\":true")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.priceCoins").doesNotExist())
                .andExpect(jsonPath("$.freeAfterDays").doesNotExist());

        // Both at once, or on an existing episode, is refused.
        chapter(
                        weekly,
                        "Both",
                        "{\"mode\":\"draft\"}",
                        "\"useSeriesFastPass\":true,\"fastPass\":{}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.fastPass").value("not_with_series_fast_pass"));
        mvc.perform(
                        put(SERIES + "/" + weekly + "/episodes/3")
                                .with(me())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        chapterBody(
                                                "Three",
                                                "{\"mode\":\"draft\"}",
                                                "\"useSeriesFastPass\":true")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.useSeriesFastPass").value("new_episodes_only"));

        // Turning the series' Fast Pass off changes no episode that is already out.
        update(weekly, "Weekly", "\"updateDays\":[\"Fri\"],\"fastPass\":{\"on\":false,\"ahead\":3}")
                .andExpect(status().isOk());
        mvc.perform(get(SERIES + "/" + weekly + "/episodes/1").with(me()))
                .andExpect(jsonPath("$.priceCoins").value(5))
                .andExpect(jsonPath("$.freeAt").value(NOON.plus(Duration.ofDays(21)).toString()));
        mvc.perform(get("/api/v1/series/weekly/episodes/1"))
                .andExpect(status().isPaymentRequired());
    }

    // ================================================================ comments switch

    @Test
    void theSeriesCommentsSwitchClosesTheSeriesPageAndEveryEpisode() throws Exception {
        String id = create("Quiet", "\"commentsEnabled\":false");
        approve(id);
        chapter(id, "One", "{\"mode\":\"now\"}", null).andExpect(status().isCreated());
        chapter(id, "Two", "{\"mode\":\"now\"}", "\"commentsEnabled\":false")
                .andExpect(status().isCreated());
        RequestPostProcessor reader = sessions.as(sessions.newReader("Reader"));

        comment(reader, "/api/v1/series/quiet/comments")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("comments_disabled"));
        comment(reader, "/api/v1/series/quiet/episodes/1/comments")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("comments_disabled"));
        mvc.perform(get("/api/v1/series/quiet"))
                .andExpect(jsonPath("$.commentsEnabled").value(false));
        mvc.perform(get("/api/v1/series/quiet/episodes/1"))
                .andExpect(jsonPath("$.commentsEnabled").value(false));

        // Switched on again: the series page and episode 1 take comments; episode 2 keeps its own
        // switch off.
        update(id, "Quiet", "\"commentsEnabled\":true").andExpect(status().isOk());
        comment(reader, "/api/v1/series/quiet/comments").andExpect(status().isCreated());
        comment(reader, "/api/v1/series/quiet/episodes/1/comments").andExpect(status().isCreated());
        comment(reader, "/api/v1/series/quiet/episodes/2/comments")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("comments_disabled"));
        mvc.perform(get("/api/v1/series/quiet"))
                .andExpect(jsonPath("$.commentsEnabled").value(true));
        mvc.perform(get("/api/v1/series/quiet/episodes/1"))
                .andExpect(jsonPath("$.commentsEnabled").value(true));
        mvc.perform(get("/api/v1/series/quiet/episodes/2"))
                .andExpect(jsonPath("$.commentsEnabled").value(false));
        // Comments already written stay readable while the switch is off.
        update(id, "Quiet", "\"commentsEnabled\":false").andExpect(status().isOk());
        mvc.perform(get("/api/v1/series/quiet/comments"))
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    // ================================================================ hide / show one episode

    @Test
    void aHiddenEpisodeDisappearsForReadersEvenForThoseWhoUnlockedIt() throws Exception {
        String id = create("Hush", "");
        approve(id);
        chapter(id, "One", "{\"mode\":\"now\"}", null).andExpect(status().isCreated());
        chapter(id, "Two", "{\"mode\":\"now\"}", "\"fastPass\":{}").andExpect(status().isCreated());
        chapter(id, "Three", "{\"mode\":\"now\"}", null).andExpect(status().isCreated());
        UUID readerId = sessions.newReader("Reader");
        sessions.grantCoins(readerId, 10);
        RequestPostProcessor reader = sessions.as(readerId);
        mvc.perform(
                        post("/api/v1/series/hush/episodes/2/unlock")
                                .with(reader)
                                .header("Idempotency-Key", "hush-unlock-1"))
                .andExpect(status().is2xxSuccessful());
        mvc.perform(get("/api/v1/series/hush/episodes/2").with(reader)).andExpect(status().isOk());

        hide(id, 2)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.number").value(2))
                .andExpect(jsonPath("$.status").value("published"))
                .andExpect(jsonPath("$.hiddenAt").value(NOON.toString()));

        // Gone for every reader, also the one who paid for it; the numbers stay.
        mvc.perform(get("/api/v1/series/hush/episodes/2").with(reader))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("episode_not_found"));
        assertThat(numbers(getString("/api/v1/series/hush/episodes"))).containsExactly(1, 3);
        mvc.perform(get("/api/v1/series/hush"))
                .andExpect(jsonPath("$.series.totalEpisodes").value(2))
                .andExpect(jsonPath("$.series.fastPassEpisodes").value(0));
        mvc.perform(get("/api/v1/series/hush/episodes/1"))
                .andExpect(jsonPath("$.next.n").value(3))
                .andExpect(jsonPath("$.total").value(2));
        mvc.perform(get("/api/v1/series/hush/episodes/3"))
                .andExpect(jsonPath("$.previous.n").value(1));
        mvc.perform(get("/api/v1/me/unlocked").with(reader))
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(get("/api/v1/series/hush/me").with(reader))
                .andExpect(jsonPath("$.unlocked.length()").value(0));
        mvc.perform(get("/api/v1/series/hush/episodes/2/comments"))
                .andExpect(status().isNotFound());
        comment(reader, "/api/v1/series/hush/episodes/2/comments").andExpect(status().isNotFound());
        mvc.perform(
                        post("/api/v1/series/hush/episodes/2/unlock")
                                .with(reader)
                                .header("Idempotency-Key", "hush-unlock-2"))
                .andExpect(status().isNotFound());

        // The creator still sees it, marked hidden; hiding again keeps the first time.
        clock.advance(Duration.ofMinutes(5));
        hide(id, 2).andExpect(jsonPath("$.hiddenAt").value(NOON.toString()));
        String list =
                mvc.perform(get(SERIES + "/" + id + "/episodes").with(me()))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        assertThat(JsonPath.<List<String>>read(list, "$[?(@.number == 2)].hiddenAt"))
                .containsExactly(NOON.toString());
        assertThat(JsonPath.<List<Object>>read(list, "$[?(@.number == 1)].hiddenAt"))
                .containsExactly((Object) null);
        mvc.perform(get(SERIES + "/" + id + "/episodes/2").with(me()))
                .andExpect(jsonPath("$.hiddenAt").value(NOON.toString()))
                .andExpect(jsonPath("$.status").value("published"));

        // Shown again: back for everyone, the unlock still counts.
        show(id, 2).andExpect(status().isOk()).andExpect(jsonPath("$.hiddenAt").doesNotExist());
        show(id, 2).andExpect(status().isOk());
        mvc.perform(get("/api/v1/series/hush/episodes/2").with(sessions.as(readerId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewer.unlocked").value(true));
        assertThat(numbers(getString("/api/v1/series/hush/episodes"))).containsExactly(1, 2, 3);
        mvc.perform(get("/api/v1/me/unlocked").with(sessions.as(readerId)))
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void onlyPublishedEpisodesCanBeHiddenAndAnAdminsTakedownStaysSeparate() throws Exception {
        String id = create("Rules of Hiding", "");
        approve(id);
        chapter(id, "Live", "{\"mode\":\"now\"}", null).andExpect(status().isCreated());
        chapter(id, "Draft", "{\"mode\":\"draft\"}", null).andExpect(status().isCreated());
        chapter(
                        id,
                        "Later",
                        "{\"mode\":\"scheduled\",\"at\":\"" + NOON.plus(Duration.ofDays(1)) + "\"}",
                        null)
                .andExpect(status().isCreated());

        for (int n : new int[] {2, 3}) {
            hide(id, n)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("episode_not_published"));
            show(id, n)
                    .andExpect(status().isConflict())
                    .andExpect(jsonPath("$.error.code").value("episode_not_published"));
        }
        hide(id, 9).andExpect(status().isNotFound());

        // An admin takes episode 1 down: the creator can neither hide nor show it.
        UUID admin = sessions.newReader("Admin");
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'ADMIN')")
                .param("id", admin)
                .update();
        mvc.perform(
                        post("/api/v1/admin/content/episode/" + episodeId(id, 1) + "/hide")
                                .with(sessions.as(admin, "ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"Spam\"}"))
                .andExpect(status().isNoContent());
        hide(id, 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("episode_hidden"));
        show(id, 1)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("episode_hidden"));
        mvc.perform(get(SERIES + "/" + id + "/episodes/1").with(me()))
                .andExpect(jsonPath("$.status").value("hidden"))
                .andExpect(jsonPath("$.hiddenAt").doesNotExist());

        // Only the owner, and only creators.
        UUID other = newCreator("Other");
        mvc.perform(post(SERIES + "/" + id + "/episodes/1/hide").with(asCreator(other)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("not_your_series"));
        mvc.perform(
                        post(SERIES + "/" + id + "/episodes/1/show")
                                .with(sessions.as(sessions.newReader("Reader"))))
                .andExpect(status().isForbidden());
    }

    // ================================================================ delete a series

    @Test
    void aSeriesWithoutPublishedEpisodesIsDeletedForGood() throws Exception {
        String id = create("Gone Soon", "");
        cover(id);
        chapter(id, "Draft", "{\"mode\":\"draft\"}", null).andExpect(status().isCreated());
        chapter(
                        id,
                        "Later",
                        "{\"mode\":\"scheduled\",\"at\":\"" + NOON.plus(Duration.ofDays(3)) + "\"}",
                        null)
                .andExpect(status().isCreated());
        mvc.perform(post(SERIES + "/" + id + "/submit").with(me())).andExpect(status().isOk());

        // Another creator and a reader cannot.
        mvc.perform(delete(SERIES + "/" + id).with(asCreator(newCreator("Other"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("not_your_series"));
        mvc.perform(delete(SERIES + "/" + id).with(sessions.as(sessions.newReader("Reader"))))
                .andExpect(status().isForbidden());

        mvc.perform(delete(SERIES + "/" + id).with(me())).andExpect(status().isNoContent());
        mvc.perform(get(SERIES + "/" + id).with(me())).andExpect(status().isNotFound());
        mvc.perform(delete(SERIES + "/" + id).with(me())).andExpect(status().isNotFound());
        UUID seriesId = UUID.fromString(id);
        assertThat(count("select count(*) from episodes where series_id = :id", seriesId)).isZero();
        assertThat(count("select count(*) from series_reviews where series_id = :id", seriesId))
                .isZero();

        // A live series that never had an episode can go too.
        String live = create("Empty Shelf", "");
        approve(live);
        mvc.perform(get("/api/v1/series/empty-shelf")).andExpect(status().isOk());
        mvc.perform(delete(SERIES + "/" + live).with(me())).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/series/empty-shelf")).andExpect(status().isNotFound());
    }

    @Test
    void aSeriesThatEverPublishedAnEpisodeCannotBeDeleted() throws Exception {
        String published = create("Out There", "");
        approve(published);
        chapter(published, "One", "{\"mode\":\"now\"}", null).andExpect(status().isCreated());
        expectKept(published);
        // Hidden by the creator: still published once.
        hide(published, 1).andExpect(status().isOk());
        expectKept(published);

        // A scheduled episode whose time has come counts, even before the publish job ran.
        String due = create("Due", "");
        chapter(
                        due,
                        "Soon",
                        "{\"mode\":\"scheduled\",\"at\":\""
                                + NOON.plus(Duration.ofHours(1))
                                + "\"}",
                        null)
                .andExpect(status().isCreated());
        clock.advance(Duration.ofHours(2));
        expectKept(due);
        assertThat(count("select count(*) from series where id = :id", UUID.fromString(due)))
                .isEqualTo(1);
    }

    // ================================================================ helpers

    private void expectKept(String id) throws Exception {
        mvc.perform(delete(SERIES + "/" + id).with(me()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("has_published_episodes"));
        mvc.perform(get(SERIES + "/" + id).with(me())).andExpect(status().isOk());
    }

    private void expectInvalid(String id, String extra, String field, String code)
            throws Exception {
        ResultActions r =
                update(id, "Checked", extra)
                        .andExpect(status().isBadRequest())
                        .andExpect(jsonPath("$.error.fields['" + field + "']").exists());
        if (code != null) {
            r.andExpect(jsonPath("$.error.fields['" + field + "']").value(code));
        }
    }

    private UUID newCreator(String name) {
        UUID id = sessions.newReader(name);
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'CREATOR')")
                .param("id", id)
                .update();
        jdbc.sql(
                        "insert into creator_profiles (user_id, pen_name, accepted_terms_at)"
                                + " values (:id, :n, now())")
                .param("id", id)
                .param("n", name)
                .update();
        return id;
    }

    /** A fresh token each time: some tests move the clock. */
    private RequestPostProcessor me() {
        return asCreator(creator);
    }

    private RequestPostProcessor asCreator(UUID id) {
        return sessions.as(id, "READER", "CREATOR");
    }

    /** A web novel series body: the required fields plus {@code extra} JSON members. */
    private static String body(String title, String extra) {
        return ("{\"title\":\"%s\",\"type\":\"novel\",\"genre\":\"fantasy\","
                        + "\"languages\":[\"en\",\"km\"],\"summary\":\"A glass sea.\"%s}")
                .formatted(title, extra.isEmpty() ? "" : "," + extra);
    }

    private String create(String title, String extra) throws Exception {
        return JsonPath.read(
                mvc.perform(
                                post(SERIES)
                                        .with(me())
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body(title, extra)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8),
                "$.id");
    }

    private ResultActions update(String id, String title, String extra) throws Exception {
        return mvc.perform(
                put(SERIES + "/" + id)
                        .with(me())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(title, extra)));
    }

    /** The series as the edit form loads it. */
    private ResultActions editOf(String id) throws Exception {
        return mvc.perform(get(SERIES + "/" + id).with(me()));
    }

    /** The cover stands in for a finished COVER upload. */
    private void cover(String id) {
        jdbc.sql("update series set cover_url = :c where id = :id")
                .param("c", COVER)
                .param("id", UUID.fromString(id))
                .update();
    }

    /** Submitted for review and approved by an admin: the series goes live. */
    private void approve(String id) throws Exception {
        cover(id);
        mvc.perform(post(SERIES + "/" + id + "/submit").with(me())).andExpect(status().isOk());
        UUID admin = sessions.newReader("Approver");
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'ADMIN')")
                .param("id", admin)
                .update();
        mvc.perform(
                        post("/api/v1/admin/series/" + id + "/approve")
                                .with(sessions.as(admin, "ADMIN")))
                .andExpect(status().isNoContent());
    }

    private static String chapterBody(String title, String publish, String extra) {
        return ("{\"title\":\"%s\",\"publish\":%s,"
                        + "\"blocks\":[{\"type\":\"paragraph\",\"text\":\"The sea was glass.\"}]%s}")
                .formatted(title, publish, extra == null ? "" : "," + extra);
    }

    private ResultActions chapter(String seriesId, String title, String publish, String extra)
            throws Exception {
        return mvc.perform(
                post(SERIES + "/" + seriesId + "/episodes")
                        .with(me())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(chapterBody(title, publish, extra)));
    }

    private ResultActions hide(String seriesId, int n) throws Exception {
        return mvc.perform(post(SERIES + "/" + seriesId + "/episodes/" + n + "/hide").with(me()));
    }

    private ResultActions show(String seriesId, int n) throws Exception {
        return mvc.perform(post(SERIES + "/" + seriesId + "/episodes/" + n + "/show").with(me()));
    }

    private ResultActions comment(RequestPostProcessor who, String path) throws Exception {
        return mvc.perform(
                post(path)
                        .with(who)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Lovely.\"}"));
    }

    private String getString(String path) throws Exception {
        return mvc.perform(get(path))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
    }

    private static List<Integer> numbers(String page) {
        return JsonPath.read(page, "$.items[*].n");
    }

    private UUID episodeId(String seriesId, int number) {
        return jdbc.sql("select id from episodes where series_id = :s and number = :n")
                .param("s", UUID.fromString(seriesId))
                .param("n", number)
                .query(UUID.class)
                .single();
    }

    private long count(String sql, UUID id) {
        return jdbc.sql(sql).param("id", id).query(Long.class).single();
    }
}
