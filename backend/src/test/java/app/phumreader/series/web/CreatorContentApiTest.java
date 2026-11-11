package app.phumreader.series.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.media.service.ObjectStore;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.series.service.CreatorContentService;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import com.jayway.jsonpath.JsonPath;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.imageio.ImageIO;
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
 * Creators write series and episodes (plan P3-14): drafts, publishing, Fast Pass, scheduling, the
 * A19 limits and ownership. Images go through the real upload endpoints into an in-memory store.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class CreatorContentApiTest {

    static final Instant NOON = Instant.parse("2026-11-05T05:00:00Z");
    static final String SERIES = "/api/v1/creator/series";
    static final String UPLOADS = "/api/v1/creator/uploads";

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired ObjectStore store;
    @Autowired CreatorContentService content;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;
    UUID creator;
    RequestPostProcessor me;

    @BeforeEach
    void aCreatorAtDemoNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(NOON);
        sessions = new Sessions(jwt, jdbc);
        creator = newCreator("Mara");
        me = sessions.as(creator, "READER", "CREATOR");
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    // ================================================================ series

    @Test
    void aDraftSeriesIsInvisibleUntilApprovedAndSlugsAreUnique() throws Exception {
        String cover = upload("COVER", 600, 800);
        String id = createSeries("Tide of Glass", "comic", cover);

        mvc.perform(get(SERIES + "/" + id).with(me))
                .andExpect(jsonPath("$.slug").value("tide-of-glass"))
                .andExpect(jsonPath("$.visibility").value("draft"))
                .andExpect(jsonPath("$.type").value("comic"))
                .andExpect(jsonPath("$.genre").value("fantasy"))
                .andExpect(jsonPath("$.tags.length()").value(2))
                .andExpect(jsonPath("$.tags[0]").value("glass"))
                .andExpect(jsonPath("$.coverUrl").exists());
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isNotFound());

        // The same title again gets -2.
        String second = createSeries("Tide of Glass", "novel", null);
        mvc.perform(get(SERIES + "/" + second).with(me))
                .andExpect(jsonPath("$.slug").value("tide-of-glass-2"));

        // A new series goes live through a review (V21-01), not by publishing.
        mvc.perform(post(SERIES + "/" + id + "/publish").with(me))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("review_required"));
        mvc.perform(post(SERIES + "/" + id + "/submit").with(me))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("review"));
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isNotFound());
        approve(id);
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isOk());

        mvc.perform(post(SERIES + "/" + id + "/unpublish").with(me)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isNotFound());
        // Approved once, it goes live again without a new review.
        mvc.perform(post(SERIES + "/" + id + "/publish").with(me))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("published"));
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isOk());
    }

    @Test
    void submittingForReviewNeedsASummaryAndACover() throws Exception {
        String noCover = createSeries("No Cover", "comic", null);
        mvc.perform(post(SERIES + "/" + noCover + "/submit").with(me))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.coverUploadId").value("required"));

        String body =
                seriesJson("No Summary", "comic", upload("COVER", 600, 800))
                        .replace("\"A glass sea.\"", "\"\"");
        String noSummary =
                idOf(
                        mvc.perform(
                                post(SERIES)
                                        .with(me)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(body)));
        mvc.perform(post(SERIES + "/" + noSummary + "/submit").with(me))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.summary").value("required"));
    }

    @Test
    void theRulesOfASeries() throws Exception {
        String id = createSeries("Rules", "comic", null);
        // Unknown genre.
        mvc.perform(
                        post(SERIES)
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("X", "comic", null).replace("fantasy", "nope")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.genre").value("unknown_genre"));
        // Type missing on create, changed on edit.
        mvc.perform(
                        post(SERIES)
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("X", null, null)))
                .andExpect(status().isBadRequest());
        mvc.perform(
                        put(SERIES + "/" + id)
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("Rules", "novel", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.type").value("type_fixed"));
        // Blank title, bad language, a COVER upload used as a banner.
        mvc.perform(
                        post(SERIES)
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson(" ", "comic", null)))
                .andExpect(status().isBadRequest());
        mvc.perform(
                        post(SERIES)
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        seriesJson("X", "comic", null).replace("\"en\"", "\"fr\"")))
                .andExpect(status().isBadRequest());
        String cover = upload("COVER", 600, 800);
        mvc.perform(
                        put(SERIES + "/" + id)
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        seriesJson("Rules", null, null)
                                                .replace(
                                                        "\"bannerUploadId\":null",
                                                        "\"bannerUploadId\":\"" + cover + "\"")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.bannerUploadId").value("upload_invalid"));
        // Edit keeps the cover when none is sent, and the list filters.
        mvc.perform(
                        put(SERIES + "/" + id)
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("Rules 2", null, cover)))
                .andExpect(status().isOk());
        mvc.perform(
                        put(SERIES + "/" + id)
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("Rules 3", null, null)))
                .andExpect(jsonPath("$.title").value("Rules 3"))
                .andExpect(jsonPath("$.coverUrl").exists());
        mvc.perform(get(SERIES + "?q=rules").with(me)).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get(SERIES + "?q=zzz").with(me)).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(SERIES + "?visibility=published").with(me))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get(SERIES + "?visibility=nope").with(me)).andExpect(status().isBadRequest());
        mvc.perform(get(SERIES + "?visibility=draft").with(me))
                .andExpect(jsonPath("$.length()").value(1));
    }

    // ================================================================ comic episodes

    @Test
    void publishingAnEpisodeRaisesTheEpisodeCountAndNumbersFollow() throws Exception {
        String id = livingSeries("Counting", "comic");
        mvc.perform(get(SERIES + "?q=counting").with(me))
                .andExpect(jsonPath("$[0].series.totalEpisodes").value(0));

        String p1 = upload("PANEL", 800, 1200);
        String p2 = upload("PANEL", 900, 1300);
        episode(id, comic("One", "{\"mode\":\"now\"}", null, p1, p2))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.number").value(1))
                .andExpect(jsonPath("$.status").value("published"))
                .andExpect(jsonPath("$.panels.length()").value(2))
                .andExpect(jsonPath("$.panels[0].uploadId").value(p1))
                .andExpect(jsonPath("$.panels[1].uploadId").value(p2))
                .andExpect(jsonPath("$.priceCoins").doesNotExist());
        episode(id, comic("Two", "{\"mode\":\"now\"}", null, p1))
                .andExpect(jsonPath("$.number").value(2));

        mvc.perform(get(SERIES + "?q=counting").with(me))
                .andExpect(jsonPath("$[0].series.totalEpisodes").value(2));
        mvc.perform(get("/api/v1/series/counting/episodes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.panels.length()").value(2));

        // A taken number is refused; a free one is used.
        episode(
                        id,
                        comic("Dup", "{\"mode\":\"now\"}", null, p1)
                                .replace("\"number\":null", "\"number\":2"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.number").value("number_taken"));
        episode(
                        id,
                        comic("Ten", "{\"mode\":\"now\"}", null, p1)
                                .replace("\"number\":null", "\"number\":10"))
                .andExpect(jsonPath("$.number").value(10));
    }

    @Test
    void aDraftReopensWithItsPanelsAndCanBeReordered() throws Exception {
        String id = livingSeries("Reopen", "comic");
        String a = upload("PANEL", 800, 1000);
        String b = upload("PANEL", 800, 1100);
        String c = upload("PANEL", 800, 1200);
        // A draft may have no panels yet.
        episode(id, comic("Draft", "{\"mode\":\"draft\"}", null))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.panels.length()").value(0));
        mvc.perform(
                        put(SERIES + "/" + id + "/episodes/1")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(comic("Draft", "{\"mode\":\"draft\"}", null, a, b, c)))
                .andExpect(status().isOk());
        mvc.perform(
                        put(SERIES + "/" + id + "/episodes/1")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(comic("Draft", "{\"mode\":\"draft\"}", null, c, a)))
                .andExpect(status().isOk());

        String order =
                mvc.perform(get(SERIES + "/" + id + "/episodes/1").with(me))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        assertThat(JsonPath.<List<String>>read(order, "$.panels[*].uploadId"))
                .containsExactly(c, a);
        // Drafts are not public.
        mvc.perform(get("/api/v1/series/reopen/episodes/1")).andExpect(status().isNotFound());
        // Publishing needs panels; the draft can be deleted, a live episode cannot.
        mvc.perform(
                        put(SERIES + "/" + id + "/episodes/1")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(comic("Draft", "{\"mode\":\"now\"}", null)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.imageUploadIds").value("required"));
        mvc.perform(delete(SERIES + "/" + id + "/episodes/1").with(me))
                .andExpect(status().isNoContent());
        mvc.perform(get(SERIES + "/" + id + "/episodes/1").with(me))
                .andExpect(status().isNotFound());

        episode(id, comic("Live", "{\"mode\":\"now\"}", null, a)).andExpect(status().isCreated());
        mvc.perform(delete(SERIES + "/" + id + "/episodes/1").with(me))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("episode_published"));
        // A live episode cannot go back to a draft.
        mvc.perform(
                        put(SERIES + "/" + id + "/episodes/1")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(comic("Live", "{\"mode\":\"draft\"}", null, a)))
                .andExpect(status().isConflict());
    }

    @Test
    void anEpisodeIsAnnouncedOnceWhenItGoesLive() throws Exception {
        String id = livingSeries("Announced", "comic");
        String a = upload("PANEL", 800, 1200);
        assertThat(notices()).isZero();

        // A draft is not announced; the step to live is, once.
        episode(id, comic("Soon", "{\"mode\":\"draft\"}", null, a)).andExpect(status().isCreated());
        assertThat(notices()).isZero();
        mvc.perform(
                        put(SERIES + "/" + id + "/episodes/1")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(comic("Soon", "{\"mode\":\"now\"}", null, a)))
                .andExpect(status().isOk());
        assertThat(notices()).isEqualTo(1);

        // Saving the live episode again does not announce it again.
        mvc.perform(
                        put(SERIES + "/" + id + "/episodes/1")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(comic("Soon, edited", "{\"mode\":\"now\"}", null, a)))
                .andExpect(status().isOk());
        assertThat(notices()).isEqualTo(1);

        // A new episode published at once is announced.
        episode(id, comic("Two", "{\"mode\":\"now\"}", null, a)).andExpect(status().isCreated());
        assertThat(notices()).isEqualTo(2);
    }

    @Test
    void aScheduledEpisodeIsAnnouncedWhenItsTimeComes() throws Exception {
        String id = livingSeries("Scheduled notice", "comic");
        String a = upload("PANEL", 800, 1200);
        java.time.Instant at = clock.instant().plusSeconds(3_600);
        episode(id, comic("Later", "{\"mode\":\"scheduled\",\"at\":\"" + at + "\"}", null, a))
                .andExpect(status().isCreated());
        assertThat(notices()).isZero();

        clock.set(at.plusSeconds(30));
        assertThat(content.publishDueEpisodes()).isEqualTo(1);
        assertThat(notices()).isEqualTo(1);
        assertThat(content.publishDueEpisodes()).isZero();
        assertThat(notices()).isEqualTo(1);
    }

    private long notices() {
        return jdbc.sql("select count(*) from outbox_events where topic = 'NOTIFICATION'")
                .query(Long.class)
                .single();
    }

    @Test
    void editingKeepsTheThumbnailUnlessANewOneIsSent() throws Exception {
        String id = livingSeries("Thumbs", "comic");
        String panel = upload("PANEL", 800, 800);
        String thumb = upload("THUMBNAIL", 400, 400);
        String body =
                "{\"title\":\"One\",\"publish\":{\"mode\":\"draft\"},\"imageUploadIds\":[\""
                        + panel
                        + "\"],\"thumbnailUploadId\":\"%s\"}";
        mvc.perform(
                        post(SERIES + "/" + id + "/episodes")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body.formatted(thumb)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.thumbnailUrl").exists());
        mvc.perform(
                        put(SERIES + "/" + id + "/episodes/1")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"One again\",\"publish\":{\"mode\":\"draft\"},"
                                                + "\"imageUploadIds\":[\""
                                                + panel
                                                + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("One again"))
                .andExpect(jsonPath("$.thumbnailUrl").exists());
    }

    @Test
    void anEpisodeIsLimitedTo100ImagesAnd200Mb() throws Exception {
        String id = livingSeries("Limits", "comic");
        String one = upload("PANEL", 800, 800);
        String[] many = new String[101];
        java.util.Arrays.fill(many, one);
        episode(id, comic("Too many", "{\"mode\":\"now\"}", null, many))
                .andExpect(status().isBadRequest());

        String big1 = upload("PANEL", 800, 800);
        String big2 = upload("PANEL", 800, 800);
        jdbc.sql("update media_uploads set declared_size = :n where id in (:a, :b)")
                .param("n", 150L * 1024 * 1024)
                .param("a", UUID.fromString(big1))
                .param("b", UUID.fromString(big2))
                .update();
        episode(id, comic("Too big", "{\"mode\":\"now\"}", null, big1, big2))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.imageUploadIds").value("episode_too_large"));
        // Another creator's upload cannot be used.
        UUID other = newCreator("Other");
        String foreign = uploadAs(sessions.as(other, "READER", "CREATOR"), "PANEL", 800, 800);
        episode(id, comic("Stolen", "{\"mode\":\"now\"}", null, foreign))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.imageUploadIds").value("upload_invalid"));
    }

    // ================================================================ Fast Pass and scheduling

    @Test
    void fastPassLocksTheEpisodeUntilItIsFree() throws Exception {
        String id = livingSeries("Fast", "comic");
        String p = upload("PANEL", 800, 1000);
        // Defaults: 5 coins, free after 7 days.
        episode(id, comic("Paid", "{\"mode\":\"now\"}", "{}", p))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.priceCoins").value(5))
                .andExpect(jsonPath("$.freeAfterDays").value(7))
                .andExpect(jsonPath("$.freeAt").value("2026-11-12T05:00:00Z"));
        UUID reader = sessions.newReader("Reader");
        mvc.perform(get("/api/v1/series/fast/episodes/1").with(sessions.as(reader)))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error.price").value(5));
        // The creator reads their own Fast Pass episode.
        mvc.perform(get("/api/v1/series/fast/episodes/1").with(me)).andExpect(status().isOk());
        clock.set(NOON.plusSeconds(7 * 86_400 + 1));
        me = sessions.as(creator, "READER", "CREATOR"); // the old token has expired
        mvc.perform(get("/api/v1/series/fast/episodes/1").with(sessions.as(reader)))
                .andExpect(status().isOk());

        // Price 3 to 10 and free after 1 to 90 days.
        for (String bad :
                new String[] {
                    "{\"priceCoins\":2}",
                    "{\"priceCoins\":11}",
                    "{\"freeAfterDays\":0}",
                    "{\"freeAfterDays\":91}"
                }) {
            episode(id, comic("Bad", "{\"mode\":\"now\"}", bad, p))
                    .andExpect(status().isBadRequest());
        }
        episode(
                        id,
                        comic(
                                "Custom",
                                "{\"mode\":\"now\"}",
                                "{\"priceCoins\":10,\"freeAfterDays\":30}",
                                p))
                .andExpect(jsonPath("$.priceCoins").value(10))
                .andExpect(jsonPath("$.freeAfterDays").value(30));
    }

    @Test
    void aScheduledEpisodeGoesLiveWhenItsTimeComes() throws Exception {
        String id = livingSeries("Later", "comic");
        String p = upload("PANEL", 800, 1000);
        Instant at = NOON.plusSeconds(3600);
        String when = "{\"mode\":\"scheduled\",\"at\":\"" + at + "\"}";

        episode(
                        id,
                        comic(
                                "Soon",
                                "{\"mode\":\"scheduled\",\"at\":\"" + NOON.minusSeconds(60) + "\"}",
                                null,
                                p))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields['publish.at']").value("schedule_in_past"));
        episode(id, comic("Soon", "{\"mode\":\"scheduled\"}", null, p))
                .andExpect(status().isBadRequest());
        episode(id, comic("Soon", when, "{}", p))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("scheduled"))
                .andExpect(jsonPath("$.publishedAt").value(at.toString()))
                .andExpect(jsonPath("$.freeAt").value(at.plusSeconds(7 * 86_400).toString()));
        mvc.perform(get("/api/v1/series/later/episodes/1")).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/series/later/episodes"))
                .andExpect(jsonPath("$.items.length()").value(0));

        // Before the time nothing happens.
        clock.set(at.minusSeconds(1));
        assertThat(content.publishDueEpisodes()).isZero();
        clock.set(at.plusSeconds(30));
        assertThat(content.publishDueEpisodes()).isEqualTo(1);
        assertThat(content.publishDueEpisodes()).isZero();

        me = sessions.as(creator, "READER", "CREATOR"); // the old token has expired
        mvc.perform(get(SERIES + "/" + id + "/episodes/1").with(me))
                .andExpect(jsonPath("$.status").value("published"));
        mvc.perform(
                        get("/api/v1/series/later/episodes/1")
                                .with(sessions.as(creator, "READER", "CREATOR")))
                .andExpect(status().isOk());
    }

    // ================================================================ novels

    @Test
    void aChapterIsStoredAsBlocksWithAWordCount() throws Exception {
        String id = livingSeries("Words", "novel");
        String blocks =
                "[{\"type\":\"heading\",\"text\":\"Chapter **One**\"},{\"type\":\"paragraph\",\"text\":\"The sea was *glass*.\"},{\"type\":\"scene-break\"},"
                        + "{\"type\":\"quote\",\"text\":\"  Hold on.  \"},{\"type\":\"paragraph\",\"text\":\"   \"}]";
        mvc.perform(
                        post(SERIES + "/" + id + "/episodes")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(chapter("Chapter one", "{\"mode\":\"now\"}", blocks)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wordCount").value(8))
                .andExpect(jsonPath("$.blocks.length()").value(4))
                .andExpect(jsonPath("$.blocks[0].type").value("heading"))
                .andExpect(jsonPath("$.blocks[2].type").value("scene-break"))
                .andExpect(jsonPath("$.blocks[3].text").value("Hold on."));
        // Readers get the heading and the marks as written.
        mvc.perform(get("/api/v1/series/words/episodes/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.blocks.length()").value(4))
                .andExpect(jsonPath("$.blocks[0].type").value("heading"))
                .andExpect(jsonPath("$.blocks[0].text").value("Chapter **One**"))
                .andExpect(jsonPath("$.blocks[1].text").value("The sea was *glass*."));

        // Publishing an empty chapter, panels on a novel and text on a comic are refused.
        mvc.perform(
                        post(SERIES + "/" + id + "/episodes")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(chapter("Empty", "{\"mode\":\"now\"}", "[]")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.blocks").value("required"));
        mvc.perform(
                        post(SERIES + "/" + id + "/episodes")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(chapter("Draft", "{\"mode\":\"draft\"}", "[]")))
                .andExpect(status().isCreated());
        mvc.perform(
                        post(SERIES + "/" + id + "/episodes")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        comic(
                                                "Panels",
                                                "{\"mode\":\"draft\"}",
                                                null,
                                                upload("PANEL", 800, 800))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.imageUploadIds").value("not_for_novels"));
        String comicId = livingSeries("Picture", "comic");
        mvc.perform(
                        post(SERIES + "/" + comicId + "/episodes")
                                .with(me)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(chapter("Text", "{\"mode\":\"draft\"}", blocks)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.blocks").value("not_for_comics"));
    }

    // ================================================================ who may write

    @Test
    void onlyTheOwnerWritesAndOnlyCreatorsWrite() throws Exception {
        String id = livingSeries("Mine", "comic");
        String p = upload("PANEL", 800, 800);
        UUID other = newCreator("Other");
        RequestPostProcessor them = sessions.as(other, "READER", "CREATOR");

        mvc.perform(
                        put(SERIES + "/" + id)
                                .with(them)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("Hijacked", null, null)))
                .andExpect(status().isForbidden());
        mvc.perform(post(SERIES + "/" + id + "/publish").with(them))
                .andExpect(status().isForbidden());
        mvc.perform(post(SERIES + "/" + id + "/submit").with(them))
                .andExpect(status().isForbidden());
        mvc.perform(post(SERIES + "/" + id + "/unpublish").with(them))
                .andExpect(status().isForbidden());
        mvc.perform(get(SERIES + "/" + id + "/episodes").with(them))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post(SERIES + "/" + id + "/episodes")
                                .with(them)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(comic("X", "{\"mode\":\"draft\"}", null)))
                .andExpect(status().isForbidden());
        mvc.perform(delete(SERIES + "/" + id + "/episodes/1").with(them))
                .andExpect(status().isForbidden());
        mvc.perform(get(SERIES + "/" + UUID.randomUUID() + "/episodes").with(me))
                .andExpect(status().isNotFound());

        // A reader (no CREATOR role) and a signed-out visitor.
        UUID reader = sessions.newReader("Reader");
        mvc.perform(
                        post(SERIES)
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("X", "comic", null)))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post(SERIES)
                                .with(sessions.guest())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("X", "comic", null)))
                .andExpect(status().isUnauthorized());
        // A CREATOR role in the token without the terms accepted is not enough.
        mvc.perform(
                        post(SERIES)
                                .with(sessions.as(reader, "READER", "CREATOR"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(seriesJson("X", "comic", null)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("not_a_creator"));
        assertThat(p).isNotBlank();
    }

    // ================================================================ helpers

    private UUID newCreator(String name) {
        UUID id = sessions.newReader(name);
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'CREATOR')")
                .param("id", id)
                .update();
        jdbc.sql(
                        "insert into creator_profiles (user_id, pen_name, accepted_terms_at) values (:id, :n, now())")
                .param("id", id)
                .param("n", name)
                .update();
        return id;
    }

    /** A published series with a cover and a summary: submitted for review and approved. */
    private String livingSeries(String title, String type) throws Exception {
        String id = createSeries(title, type, upload("COVER", 600, 800));
        mvc.perform(post(SERIES + "/" + id + "/submit").with(me)).andExpect(status().isOk());
        approve(id);
        return id;
    }

    /** An admin approves the series in review (V21-01): it goes live. */
    private void approve(String seriesId) throws Exception {
        UUID admin = sessions.newReader("Admin");
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'ADMIN')")
                .param("id", admin)
                .update();
        mvc.perform(
                        post("/api/v1/admin/series/" + seriesId + "/approve")
                                .with(sessions.as(admin, "ADMIN")))
                .andExpect(status().isNoContent());
    }

    private String createSeries(String title, String type, String coverUploadId) throws Exception {
        return idOf(
                mvc.perform(
                                post(SERIES)
                                        .with(me)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(seriesJson(title, type, coverUploadId)))
                        .andExpect(status().isCreated()));
    }

    private static String seriesJson(String title, String type, String coverUploadId) {
        return "{\"title\":\"%s\",\"type\":%s,\"genre\":\"fantasy\",\"languages\":[\"en\"],\"summary\":\"A glass sea.\","
                        .formatted(title, type == null ? "null" : "\"" + type + "\"")
                + "\"ageRating\":\"all\",\"updateDay\":\"Fri\",\"status\":\"ongoing\",\"tags\":[\"Sea\",\"sea\",\"glass\"],"
                + "\"coverUploadId\":"
                + (coverUploadId == null ? "null" : "\"" + coverUploadId + "\"")
                + ",\"bannerUploadId\":null}";
    }

    private ResultActions episode(String seriesId, String body) throws Exception {
        return mvc.perform(
                post(SERIES + "/" + seriesId + "/episodes")
                        .with(me)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private static String comic(String title, String publish, String fastPass, String... uploads) {
        return "{\"title\":\"%s\",\"number\":null,\"fastPass\":%s,\"publish\":%s,\"imageUploadIds\":[%s]}"
                .formatted(
                        title,
                        fastPass == null ? "null" : fastPass,
                        publish,
                        java.util.Arrays.stream(uploads)
                                .map(u -> "\"" + u + "\"")
                                .collect(Collectors.joining(",")));
    }

    private static String chapter(String title, String publish, String blocks) {
        return "{\"title\":\"%s\",\"publish\":%s,\"blocks\":%s}".formatted(title, publish, blocks);
    }

    private static String idOf(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id");
    }

    private String upload(String kind, int width, int height) throws Exception {
        return uploadAs(me, kind, width, height);
    }

    /** Runs the real upload flow: ticket, "PUT" into the memory store, complete. */
    private String uploadAs(RequestPostProcessor who, String kind, int width, int height)
            throws Exception {
        byte[] data = png(width, height);
        String body =
                mvc.perform(
                                post(UPLOADS)
                                        .with(who)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"kind\":\"%s\",\"contentType\":\"image/png\",\"size\":%d}"
                                                        .formatted(kind, data.length)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String id = JsonPath.read(body, "$.id");
        store.put("uploads/" + kind.toLowerCase() + "/" + id + "/original", data, "image/png");
        mvc.perform(post(UPLOADS + "/" + id + "/complete").with(who)).andExpect(status().isOk());
        return id;
    }

    private static byte[] png(int width, int height) throws IOException {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(0, 220, 100));
        g.fillRect(0, 0, width, height);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }
}
