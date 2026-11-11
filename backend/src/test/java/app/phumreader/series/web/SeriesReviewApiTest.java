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
import java.time.OffsetDateTime;
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
 * The series review workflow (V21-01): a creator submits, an admin approves, asks for changes or
 * rejects, the creator marks the changes fixed and resubmits. Only an approved series goes live;
 * every decision is audited. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class SeriesReviewApiTest {

    static final Instant NOON = Instant.parse("2026-11-05T05:00:00Z");
    static final String SERIES = "/api/v1/creator/series";
    static final String ADMIN = "/api/v1/admin";

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;
    UUID creator;
    UUID admin;

    @BeforeEach
    void aCreatorAndAnAdminAtDemoNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(NOON);
        sessions = new Sessions(jwt, jdbc);
        creator = newCreator("Mara");
        admin = sessions.newReader("Admin Boran");
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'ADMIN')")
                .param("id", admin)
                .update();
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    // ================================================================ key flow 4

    @Test
    void aNewSeriesGoesLiveOnlyAfterAnAdminApprovesIt() throws Exception {
        String id = series("Tide of Glass", "A glass sea.", true);
        mvc.perform(get(SERIES + "/" + id).with(me()))
                .andExpect(jsonPath("$.visibility").value("draft"))
                .andExpect(jsonPath("$.review").doesNotExist());

        // Publishing straight away is no longer possible.
        mvc.perform(post(SERIES + "/" + id + "/publish").with(me()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("review_required"));

        submit(id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("review"))
                .andExpect(jsonPath("$.review.submittedAt").value("2026-11-05T05:00:00Z"))
                .andExpect(jsonPath("$.review.decision").doesNotExist())
                .andExpect(jsonPath("$.review.note").doesNotExist())
                .andExpect(jsonPath("$.review.items.length()").value(0));
        submit(id)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("already_in_review"));
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isNotFound());

        // The admin asks for two changes.
        clock.advance(Duration.ofHours(2));
        decide(
                        id,
                        "request-changes",
                        "{\"items\":[\"cover\",\"contact\"],\"note\":\" Use your own art. \"}")
                .andExpect(status().isNoContent());
        mvc.perform(get(SERIES + "/" + id).with(me()))
                .andExpect(jsonPath("$.visibility").value("changes"))
                .andExpect(jsonPath("$.review.submittedAt").value("2026-11-05T05:00:00Z"))
                .andExpect(jsonPath("$.review.decision").value("changes"))
                .andExpect(jsonPath("$.review.note").value("Use your own art."))
                .andExpect(jsonPath("$.review.items.length()").value(2))
                .andExpect(jsonPath("$.review.items[0].item").value("contact"))
                .andExpect(jsonPath("$.review.items[0].fixed").value(false))
                .andExpect(jsonPath("$.review.items[1].item").value("cover"))
                .andExpect(jsonPath("$.review.items[1].fixed").value(false));
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isNotFound());

        // Resubmitting needs every change marked fixed.
        submit(id)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("changes_not_fixed"));
        fix(id, "contact").andExpect(status().isOk());
        submit(id)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("changes_not_fixed"));
        fix(id, "cover")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.items[0].fixed").value(true))
                .andExpect(jsonPath("$.review.items[1].fixed").value(true));

        clock.advance(Duration.ofHours(1));
        submit(id)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("review"))
                .andExpect(jsonPath("$.review.submittedAt").value("2026-11-05T08:00:00Z"))
                .andExpect(jsonPath("$.review.decision").doesNotExist())
                .andExpect(jsonPath("$.review.items.length()").value(0));
        assertThat(count("select count(*) from series_reviews where series_id = '" + id + "'"))
                .isEqualTo(2);

        // Approval puts it live and sets the launch date.
        clock.advance(Duration.ofHours(1));
        decide(id, "approve", "").andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isOk());
        mvc.perform(get(SERIES + "/" + id).with(me()))
                .andExpect(jsonPath("$.visibility").value("published"))
                .andExpect(jsonPath("$.review.decision").value("approved"))
                .andExpect(jsonPath("$.review.submittedAt").value("2026-11-05T08:00:00Z"));
        assertThat(launchedAt(id)).isEqualTo(NOON.plus(Duration.ofHours(4)));

        // A second decision (another admin, a double click) is refused.
        decide(id, "approve", "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("not_in_review"));
        decide(id, "reject", "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("not_in_review"));

        // Now the creator uploads episodes as before (an episode of a live series).
        mvc.perform(
                        post(SERIES + "/" + id + "/episodes")
                                .with(me())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"title\":\"One\",\"publish\":{\"mode\":\"draft\"}}"))
                .andExpect(status().isCreated());
    }

    @Test
    void submittingNeedsASummaryAndACover() throws Exception {
        String noCover = series("No Cover Yet", "A summary.", false);
        submit(noCover)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.coverUploadId").value("required"));
        String noSummary = series("No Summary Yet", "", true);
        submit(noSummary)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.summary").value("required"));
        assertThat(count("select count(*) from series_reviews")).isZero();

        // Another creator's series, an unknown one, a reader without the role.
        UUID other = newCreator("Other");
        mvc.perform(post(SERIES + "/" + noCover + "/submit").with(sessions.as(other, "CREATOR")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("not_your_series"));
        mvc.perform(post(SERIES + "/" + UUID.randomUUID() + "/submit").with(me()))
                .andExpect(status().isNotFound());
        mvc.perform(
                        post(SERIES + "/" + noCover + "/submit")
                                .with(sessions.as(sessions.newReader("Reader"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void aSeriesApprovedBeforeGoesLiveAgainWithoutAReview() throws Exception {
        String id = series("Mango Rain", "Rain in the orchard.", true);
        submit(id).andExpect(status().isOk());
        decide(id, "approve", "").andExpect(status().isNoContent());
        submit(id)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("already_published"));

        clock.advance(Duration.ofDays(1));
        mvc.perform(post(SERIES + "/" + id + "/unpublish").with(me()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("draft"));
        mvc.perform(get("/api/v1/series/mango-rain")).andExpect(status().isNotFound());
        mvc.perform(post(SERIES + "/" + id + "/publish").with(me()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("published"));
        mvc.perform(get("/api/v1/series/mango-rain")).andExpect(status().isOk());
        // The launch date stays the first one.
        assertThat(launchedAt(id)).isEqualTo(NOON);

        // Publishing again still needs a summary.
        mvc.perform(post(SERIES + "/" + id + "/unpublish").with(me())).andExpect(status().isOk());
        jdbc.sql("update series set summary = '' where id = :id")
                .param("id", UUID.fromString(id))
                .update();
        mvc.perform(post(SERIES + "/" + id + "/publish").with(me()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.summary").value("required"));
    }

    @Test
    void markingFixedNeedsChangesThatWereRequested() throws Exception {
        String id = series("Mango Rain", "Rain in the orchard.", true);
        fix(id, "title")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("no_changes_requested"));
        submit(id).andExpect(status().isOk());
        fix(id, "title")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("no_changes_requested"));
        // While it waits, the creator can neither publish nor take it off.
        mvc.perform(post(SERIES + "/" + id + "/publish").with(me()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("already_in_review"));
        mvc.perform(post(SERIES + "/" + id + "/unpublish").with(me()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("already_in_review"));

        decide(id, "request-changes", "{\"items\":[\"title\",\"age\"]}")
                .andExpect(status().isNoContent());
        mvc.perform(post(SERIES + "/" + id + "/publish").with(me()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("changes_requested"));
        mvc.perform(post(SERIES + "/" + id + "/unpublish").with(me()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("changes_requested"));

        fix(id, "cover")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("item_not_requested"));
        fix(id, "watermark")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_item"));
        fix(id, "title")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.items[0].item").value("title"))
                .andExpect(jsonPath("$.review.items[0].fixed").value(true))
                .andExpect(jsonPath("$.review.items[1].item").value("age"))
                .andExpect(jsonPath("$.review.items[1].fixed").value(false));
        // Marking it again keeps the first time; undo clears it.
        clock.advance(Duration.ofMinutes(5));
        fix(id, "title").andExpect(status().isOk());
        assertThat(fixedAt(id, "title")).isEqualTo(NOON);
        mvc.perform(delete(SERIES + "/" + id + "/review/items/title").with(me()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.review.items[0].fixed").value(false));
        assertThat(fixedAt(id, "title")).isNull();
        mvc.perform(delete(SERIES + "/" + id + "/review/items/cover").with(me()))
                .andExpect(status().isNotFound());

        // Only the owner marks.
        UUID other = newCreator("Other");
        mvc.perform(
                        put(SERIES + "/" + id + "/review/items/title")
                                .with(sessions.as(other, "READER", "CREATOR")))
                .andExpect(status().isForbidden());

        // The list rows carry the review too, and filter by the new states.
        mvc.perform(get(SERIES + "?visibility=changes").with(me()))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].visibility").value("changes"))
                .andExpect(jsonPath("$[0].review.decision").value("changes"))
                .andExpect(jsonPath("$[0].review.items.length()").value(2));
        mvc.perform(get(SERIES + "?visibility=review").with(me()))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/v1/creator/dashboard").with(me()))
                .andExpect(jsonPath("$.series[0].review.items[1].item").value("age"));
    }

    // ================================================================ admin queue

    @Test
    void theQueueListsSeriesInReviewOldestFirstWithTheAutomaticChecks() throws Exception {
        String flagged =
                series("Glass Compass Returns", "Follow @mara_draws or call 012 345 678.", true);
        String clean = series("Tide of Glass", "A glass sea.", true);
        series("Still a Draft", "Not submitted.", true);
        submit(flagged).andExpect(status().isOk());
        clock.advance(Duration.ofHours(1));
        submit(clean).andExpect(status().isOk());
        episode(flagged, "One");
        episode(flagged, "Two");

        String first =
                mvc.perform(get(ADMIN + "/series-review?limit=1").with(asAdmin()))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.items.length()").value(1))
                        .andExpect(jsonPath("$.items[0].id").value(flagged))
                        .andExpect(jsonPath("$.items[0].slug").value("glass-compass-returns"))
                        .andExpect(jsonPath("$.items[0].title").value("Glass Compass Returns"))
                        .andExpect(jsonPath("$.items[0].creator").value("Mara"))
                        .andExpect(jsonPath("$.items[0].type").value("comic"))
                        .andExpect(jsonPath("$.items[0].genre").value("fantasy"))
                        .andExpect(jsonPath("$.items[0].ageRating").value("teen"))
                        .andExpect(jsonPath("$.items[0].languages[0]").value("en"))
                        .andExpect(jsonPath("$.items[0].languages[1]").value("km"))
                        .andExpect(jsonPath("$.items[0].episodeCount").value(2))
                        .andExpect(jsonPath("$.items[0].coverUrl").value(COVER))
                        .andExpect(
                                jsonPath("$.items[0].summary")
                                        .value("Follow @mara_draws or call 012 345 678."))
                        .andExpect(jsonPath("$.items[0].submittedAt").value("2026-11-05T05:00:00Z"))
                        .andExpect(jsonPath("$.items[0].flags.length()").value(2))
                        .andExpect(jsonPath("$.items[0].flags[0].kind").value("contact"))
                        .andExpect(jsonPath("$.items[0].flags[0].detail").value("@mara_draws"))
                        .andExpect(jsonPath("$.items[0].flags[1].kind").value("similar"))
                        .andExpect(jsonPath("$.items[0].flags[1].detail").value("Glass Compass"))
                        .andExpect(jsonPath("$.nextCursor").isString())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        String cursor = JsonPath.read(first, "$.nextCursor");
        mvc.perform(get(ADMIN + "/series-review?limit=1&cursor=" + cursor).with(asAdmin()))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(clean))
                .andExpect(jsonPath("$.items[0].submittedAt").value("2026-11-05T06:00:00Z"))
                .andExpect(jsonPath("$.items[0].episodeCount").value(0))
                .andExpect(jsonPath("$.items[0].flags.length()").value(0))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());
        mvc.perform(get(ADMIN + "/series-review?cursor=nonsense").with(asAdmin()))
                .andExpect(status().isBadRequest());

        // A decided series leaves the queue.
        decide(flagged, "request-changes", "{\"items\":[\"contact\"]}")
                .andExpect(status().isNoContent());
        mvc.perform(get(ADMIN + "/series-review").with(asAdmin()))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(clean));
        // The admin content list knows the new states.
        mvc.perform(get(ADMIN + "/content?type=series&status=changes").with(asAdmin()))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].status").value("changes"));
    }

    @Test
    void theOverviewCountsTheSeriesWaitingForReview() throws Exception {
        mvc.perform(get(ADMIN + "/overview").with(asAdmin()))
                .andExpect(jsonPath("$.seriesInReview").value(0))
                .andExpect(jsonPath("$.oldestReviewAt").doesNotExist());
        String a = series("Tide of Glass", "A glass sea.", true);
        String b = series("Mango Rain", "Rain in the orchard.", true);
        submit(a).andExpect(status().isOk());
        clock.advance(Duration.ofMinutes(30));
        submit(b).andExpect(status().isOk());

        mvc.perform(get(ADMIN + "/overview").with(asAdmin()))
                .andExpect(jsonPath("$.seriesInReview").value(2))
                .andExpect(jsonPath("$.oldestReviewAt").value("2026-11-05T05:00:00Z"));
        decide(a, "approve", "").andExpect(status().isNoContent());
        mvc.perform(get(ADMIN + "/overview").with(asAdmin()))
                .andExpect(jsonPath("$.seriesInReview").value(1))
                .andExpect(jsonPath("$.oldestReviewAt").value("2026-11-05T05:30:00Z"));
    }

    // ================================================================ decisions

    @Test
    void decisionsAreCheckedAndOnlyForAdmins() throws Exception {
        String id = series("Tide of Glass", "A glass sea.", true);
        // Not submitted yet; an unknown series.
        decide(id, "approve", "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("not_in_review"));
        decide(UUID.randomUUID().toString(), "approve", "")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("series_not_found"));
        submit(id).andExpect(status().isOk());

        // 1-5 different known items and a note of at most 300 characters.
        decide(id, "request-changes", "{\"items\":[]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.items").exists());
        decide(
                        id,
                        "request-changes",
                        "{\"items\":[\"contact\",\"cover\",\"title\",\"age\",\"images\",\"cover\"]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.items").exists());
        decide(id, "request-changes", "{\"items\":[\"cover\",\"cover\"]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("duplicate_item"));
        decide(id, "request-changes", "{\"items\":[\"watermark\"]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("malformed_request"));
        decide(id, "request-changes", "{\"note\":\"Why?\"}").andExpect(status().isBadRequest());
        String tooLong = "x".repeat(301);
        decide(id, "request-changes", "{\"items\":[\"cover\"],\"note\":\"" + tooLong + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.note").exists());
        decide(id, "reject", "{\"note\":\"" + tooLong + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.note").exists());

        // Readers, creators and visitors are kept out.
        UUID reader = sessions.newReader("Reader");
        for (RequestPostProcessor who :
                List.of(sessions.as(reader), sessions.as(creator, "READER", "CREATOR"))) {
            mvc.perform(get(ADMIN + "/series-review").with(who)).andExpect(status().isForbidden());
            for (String action : List.of("approve", "reject")) {
                mvc.perform(post(ADMIN + "/series/" + id + "/" + action).with(who))
                        .andExpect(status().isForbidden());
            }
            mvc.perform(
                            post(ADMIN + "/series/" + id + "/request-changes")
                                    .with(who)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"items\":[\"cover\"]}"))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get(ADMIN + "/series-review").with(sessions.guest()))
                .andExpect(status().isUnauthorized());

        assertThat(count("select count(*) from audit_log")).isZero();
        mvc.perform(get(SERIES + "/" + id).with(me()))
                .andExpect(jsonPath("$.visibility").value("review"));
    }

    @Test
    void aRejectedSeriesGoesBackToADraftAndEveryDecisionIsAudited() throws Exception {
        String id = series("Tide of Glass", "A glass sea.", true);
        submit(id).andExpect(status().isOk());
        decide(id, "reject", "{\"note\":\"Not a fit for PhumiReader.\"}")
                .andExpect(status().isNoContent());
        mvc.perform(get(SERIES + "/" + id).with(me()))
                .andExpect(jsonPath("$.visibility").value("draft"))
                .andExpect(jsonPath("$.review.decision").value("rejected"))
                .andExpect(jsonPath("$.review.note").value("Not a fit for PhumiReader."))
                .andExpect(jsonPath("$.review.items.length()").value(0));
        decide(id, "reject", "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("not_in_review"));
        mvc.perform(get("/api/v1/series/tide-of-glass")).andExpect(status().isNotFound());

        // The creator may try again; this time changes, then approval.
        submit(id).andExpect(status().isOk());
        decide(id, "request-changes", "{\"items\":[\"images\"],\"note\":\"Sharper panels.\"}")
                .andExpect(status().isNoContent());
        fix(id, "images").andExpect(status().isOk());
        submit(id).andExpect(status().isOk());
        decide(id, "approve", "").andExpect(status().isNoContent());

        assertThat(
                        jdbc.sql(
                                        "select action || ' ' || target_type || ' ' || target_id"
                                                + " || ' ' || actor_id from audit_log order by id")
                                .query(String.class)
                                .list())
                .containsExactly(
                        "series.reject SERIES " + id + " " + admin,
                        "series.changes SERIES " + id + " " + admin,
                        "series.approve SERIES " + id + " " + admin);
        mvc.perform(get(ADMIN + "/audit?action=series.").with(asAdmin()))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].action").value("series.approve"))
                .andExpect(jsonPath("$.items[0].details.title").value("Tide of Glass"))
                .andExpect(jsonPath("$.items[1].action").value("series.changes"))
                .andExpect(jsonPath("$.items[1].details.title").value("Tide of Glass"))
                .andExpect(jsonPath("$.items[1].details.items[0]").value("images"))
                .andExpect(jsonPath("$.items[1].details.note").value("Sharper panels."))
                .andExpect(jsonPath("$.items[2].action").value("series.reject"))
                .andExpect(jsonPath("$.items[2].details.note").value("Not a fit for PhumiReader."));
        assertThat(count("select count(*) from series_reviews where decided_by = '" + admin + "'"))
                .isEqualTo(3);
    }

    // ================================================================ helpers

    static final String COVER = "https://cdn.phumireader.test/covers/test.webp";

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

    /** A draft comic (teen, en + km); the cover stands in for a finished COVER upload. */
    private String series(String title, String summary, boolean cover) throws Exception {
        String body =
                ("{\"title\":\"%s\",\"type\":\"comic\",\"genre\":\"fantasy\",\"languages\":[\"en\",\"km\"],"
                                + "\"summary\":\"%s\",\"ageRating\":\"teen\",\"updateDay\":\"Fri\"}")
                        .formatted(title, summary);
        String id =
                JsonPath.read(
                        mvc.perform(
                                        post(SERIES)
                                                .with(me())
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(body))
                                .andExpect(status().isCreated())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(StandardCharsets.UTF_8),
                        "$.id");
        if (cover) {
            jdbc.sql("update series set cover_url = :c where id = :id")
                    .param("c", COVER)
                    .param("id", UUID.fromString(id))
                    .update();
        }
        return id;
    }

    private void episode(String seriesId, String title) throws Exception {
        mvc.perform(
                        post(SERIES + "/" + seriesId + "/episodes")
                                .with(me())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"title\":\"%s\",\"publish\":{\"mode\":\"draft\"}}"
                                                .formatted(title)))
                .andExpect(status().isCreated());
    }

    private ResultActions submit(String id) throws Exception {
        return mvc.perform(post(SERIES + "/" + id + "/submit").with(me()));
    }

    private ResultActions fix(String id, String item) throws Exception {
        return mvc.perform(put(SERIES + "/" + id + "/review/items/" + item).with(me()));
    }

    /** A fresh token each time: the tests move the clock past the 15-minute access token. */
    private RequestPostProcessor me() {
        return sessions.as(creator, "READER", "CREATOR");
    }

    private RequestPostProcessor asAdmin() {
        return sessions.as(admin, "ADMIN");
    }

    private ResultActions decide(String id, String action, String body) throws Exception {
        var request = post(ADMIN + "/series/" + id + "/" + action).with(asAdmin());
        if (!body.isEmpty()) {
            request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(request);
    }

    private Instant launchedAt(String id) {
        return jdbc.sql("select launched_at from series where id = :id")
                .param("id", UUID.fromString(id))
                .query(OffsetDateTime.class)
                .single()
                .toInstant();
    }

    private Instant fixedAt(String id, String item) {
        OffsetDateTime at =
                jdbc.sql(
                                "select i.fixed_at from series_review_items i"
                                        + " join series_reviews r on r.id = i.review_id"
                                        + " where r.series_id = :id and i.item = :item"
                                        + " order by r.id desc limit 1")
                        .param("id", UUID.fromString(id))
                        .param("item", item)
                        .query((rs, n) -> rs.getObject("fixed_at", OffsetDateTime.class))
                        .list()
                        .getFirst();
        return at == null ? null : at.toInstant();
    }

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }
}
