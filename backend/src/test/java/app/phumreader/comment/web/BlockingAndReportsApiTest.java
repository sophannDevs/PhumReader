package app.phumreader.comment.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import app.phumreader.user.domain.User;
import java.nio.charset.StandardCharsets;
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Blocking and report outcomes (V21-04): block / unblock / list, flagged comments, report reasons
 * and case numbers, "Your reports", and the admin actions. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class BlockingAndReportsApiTest {

    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired JsonMapper json;
    @Autowired RateLimiter limiter;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;
    UUID admin;

    @BeforeEach
    void demoAtDemoNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(DEMO_NOON);
        limiter.clear();
        sessions = new Sessions(jwt, jdbc);
        admin = sessions.newReader("Admin Boran");
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'ADMIN')")
                .param("id", admin)
                .update();
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    // ---------- blocking ----------

    @Test
    void blockingIsStoredWithTheAccountAndFlagsTheirComments() throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID author = authorOfTopComment();

        putAs(reader, "/api/v1/users/" + author + "/block").andExpect(status().isNoContent());
        putAs(reader, "/api/v1/users/" + author + "/block").andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/blocks").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userId").value(author.toString()))
                .andExpect(jsonPath("$[0].name").value("Sokha P."));

        // The thread flags the blocked person's comment, for the blocker only.
        mvc.perform(get("/api/v1/series/glass-compass/comments").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items[0].author.id").value(author.toString()))
                .andExpect(jsonPath("$.items[0].blocked").value(true))
                .andExpect(jsonPath("$.items[1].blocked").value(false));
        mvc.perform(
                        get("/api/v1/series/glass-compass/comments")
                                .with(sessions.as(sessions.newReader("Other"))))
                .andExpect(jsonPath("$.items[0].blocked").value(false));
        mvc.perform(get("/api/v1/series/glass-compass/comments"))
                .andExpect(jsonPath("$.items[0].blocked").value(false));

        mvc.perform(delete("/api/v1/users/" + author + "/block").with(sessions.as(reader)))
                .andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/users/" + author + "/block").with(sessions.as(reader)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/blocks").with(sessions.as(reader)))
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void youCannotBlockYourselfOrSomeoneWhoDoesNotExist() throws Exception {
        UUID reader = sessions.newReader("Dara");
        putAs(reader, "/api/v1/users/" + reader + "/block")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("cannot_block_self"));
        putAs(reader, "/api/v1/users/" + UUID.randomUUID() + "/block")
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/me/blocks")).andExpect(status().isUnauthorized());
    }

    @Test
    void aBlockedPersonsLikeMakesNoInboxItem() throws Exception {
        UUID author = sessions.newReader("Author");
        UUID liker = sessions.newReader("Liker");
        UUID friend = sessions.newReader("Friend");
        String comment = postComment(author, "A thought about the ending.");

        putAs(author, "/api/v1/users/" + liker + "/block").andExpect(status().isNoContent());
        putAs(liker, "/api/v1/comments/" + comment + "/like").andExpect(status().isOk());
        assertThat(notificationsFor(author)).isZero();
        putAs(friend, "/api/v1/comments/" + comment + "/like").andExpect(status().isOk());
        assertThat(notificationsFor(author)).isEqualTo(1);
    }

    // ---------- reports ----------

    @Test
    void reportReasonsAreCheckedPerTargetAndGetACaseNumber() throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID author = authorOfTopComment();
        String comment = topCommentId();

        // A series reason is not a comment reason; "other" and "copyright" need details.
        report(reader, "/api/v1/comments/" + comment + "/report", "{\"reason\":\"copyright\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.reason").exists());
        report(reader, "/api/v1/comments/" + comment + "/report", "{\"reason\":\"other\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.details").exists());
        report(
                        reader,
                        "/api/v1/comments/" + comment + "/report",
                        "{\"reason\":\"other\",\"details\":\"too short\"}")
                .andExpect(status().isBadRequest());
        report(reader, "/api/v1/series/glass-compass/report", "{\"reason\":\"spoiler\"}")
                .andExpect(status().isBadRequest());

        JsonNode first =
                body(
                        report(
                                        reader,
                                        "/api/v1/comments/" + comment + "/report",
                                        "{\"reason\":\"spam\"}")
                                .andExpect(status().isAccepted())
                                .andExpect(jsonPath("$.accusedId").value(author.toString()))
                                .andExpect(jsonPath("$.accusedName").value("Sokha P.")));
        assertThat(first.get("caseNumber").asInt()).isGreaterThanOrEqualTo(20481);

        // The same open case comes back for a second report on the same comment.
        JsonNode again =
                body(
                        report(
                                        reader,
                                        "/api/v1/comments/" + comment + "/report",
                                        "{\"reason\":\"hate\"}")
                                .andExpect(status().isAccepted()));
        assertThat(again.get("caseNumber").asInt()).isEqualTo(first.get("caseNumber").asInt());

        JsonNode series =
                body(
                        report(
                                        reader,
                                        "/api/v1/series/glass-compass/report",
                                        "{\"reason\":\"copyright\","
                                                + "\"details\":\"The original is at example.com\"}")
                                .andExpect(status().isAccepted()));
        assertThat(series.get("caseNumber").asInt()).isGreaterThan(first.get("caseNumber").asInt());

        // Nobody is offered a block on themselves.
        UUID creator =
                jdbc.sql("select creator_id from series where slug = 'glass-compass'")
                        .query(UUID.class)
                        .single();
        report(creator, "/api/v1/series/glass-compass/report", "{\"reason\":\"spam\"}")
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.accusedId").doesNotExist());
    }

    @Test
    void flowThreeCommentReportRemovedAndTheReporterSeesRemoved() throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID author = sessions.newReader("Rude Rithy");
        String comment = postComment(author, "Something nasty.");

        int caseNumber =
                body(report(
                                        reader,
                                        "/api/v1/comments/" + comment + "/report",
                                        "{\"reason\":\"harass\"}")
                                .andExpect(status().isAccepted()))
                        .get("caseNumber")
                        .asInt();
        mvc.perform(get("/api/v1/me/reports").with(sessions.as(reader)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].caseNumber").value(caseNumber))
                .andExpect(jsonPath("$[0].targetType").value("comment"))
                .andExpect(jsonPath("$[0].seriesTitle").value("Glass Compass"))
                .andExpect(jsonPath("$[0].accusedName").value("Rude Rithy"))
                .andExpect(jsonPath("$[0].reason").value("harass"))
                .andExpect(jsonPath("$[0].status").value("in_review"));

        UUID id = reportId(caseNumber);
        settle(id, "{\"action\":\"hide\",\"note\":\"Harassment\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.caseNumber").value(caseNumber))
                .andExpect(jsonPath("$.accusedName").value("Rude Rithy"))
                .andExpect(jsonPath("$.action").value("remove"));

        mvc.perform(get("/api/v1/me/reports").with(sessions.as(reader)))
                .andExpect(jsonPath("$[0].status").value("removed"));
        // Only the reporter's own cases are listed.
        mvc.perform(get("/api/v1/me/reports").with(sessions.as(author)))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/v1/series/glass-compass/comments?sort=newest"))
                .andExpect(jsonPath("$.items[?(@.id == '" + comment + "')]").isEmpty());
    }

    @Test
    void noViolationAndWarnAreRecordedAndShownToTheReporter() throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID author = sessions.newReader("Author");
        String first = postComment(author, "One.");
        String second = postComment(author, "Two.");

        int a = caseOf(reader, first, "spam");
        int b = caseOf(reader, second, "violence");
        settle(reportId(a), "{\"action\":\"dismiss\"}")
                .andExpect(jsonPath("$.status").value("dismissed"))
                .andExpect(jsonPath("$.action").value("none"));
        settle(reportId(b), "{\"action\":\"remove_warn\",\"note\":\"Warned\"}")
                .andExpect(jsonPath("$.status").value("resolved"))
                .andExpect(jsonPath("$.action").value("remove_warn"))
                .andExpect(jsonPath("$.target.status").value("hidden"));

        mvc.perform(get("/api/v1/me/reports").with(sessions.as(reader)))
                .andExpect(jsonPath("$[?(@.caseNumber == " + a + ")].status").value("no_violation"))
                .andExpect(jsonPath("$[?(@.caseNumber == " + b + ")].status").value("removed"));
        // A warning does not suspend anyone.
        assertThat(accountStatus(author)).isEqualTo("ACTIVE");
    }

    @Test
    void suspendingFromAReportBansForTheDaysAndSignInLiftsItAfterwards() throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID author = sessions.newReader("Spammer");
        String comment = postComment(author, "Buy coins here!");
        UUID id = reportId(caseOf(reader, comment, "spam"));

        settle(id, "{\"action\":\"suspend\",\"days\":3,\"note\":\"Spam\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.action").value("suspend"))
                .andExpect(jsonPath("$.target.status").value("hidden"));
        assertThat(accountStatus(author)).isEqualTo("BANNED");
        Instant until =
                jdbc.sql("select suspended_until from users where id = :id")
                        .param("id", author)
                        .query(java.time.OffsetDateTime.class)
                        .single()
                        .toInstant();
        assertThat(until).isEqualTo(DEMO_NOON.plusSeconds(3 * 86_400L));
        assertThat(
                        jdbc.sql(
                                        "select count(*) from audit_log where action = 'user.ban'"
                                                + " and target_id = :id")
                                .param("id", author.toString())
                                .query(Long.class)
                                .single())
                .isEqualTo(1);

        // The date rule itself: still suspended the day before, active from the end date.
        User banned = User.newReader("s@x.test", "S", "hash");
        banned.ban(until);
        assertThat(banned.liftSuspensionIfOver(until.minusSeconds(1))).isFalse();
        assertThat(banned.liftSuspensionIfOver(until)).isTrue();
        assertThat(banned.getSuspendedUntil()).isNull();
    }

    @Test
    void suspendNeedsAnAccountThatIsNotAnAdmin() throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID second = sessions.newReader("Second");
        String comment = postComment(second, "Hello.");
        int number = caseOf(reader, comment, "spam");

        // Days outside 1-365.
        settle(reportId(number), "{\"action\":\"suspend\",\"days\":0}")
                .andExpect(status().isBadRequest());
        settle(reportId(number), "{\"action\":\"suspend\",\"days\":400}")
                .andExpect(status().isBadRequest());

        // The accused is an admin.
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'ADMIN')")
                .param("id", second)
                .update();
        settle(reportId(number), "{\"action\":\"suspend\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("cannot_ban_admin"));

        // A report without an accused account.
        UUID orphan =
                jdbc.sql(
                                "insert into reports (reporter_id, target_type, target_id, reason)"
                                        + " values (:r, 'SERIES', gen_random_uuid(), 'spam')"
                                        + " returning id")
                        .param("r", reader)
                        .query(UUID.class)
                        .single();
        settle(orphan, "{\"action\":\"suspend\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("no_accused"));
        // Both refusals left the reports open.
        assertThat(
                        jdbc.sql(
                                        "select count(*) from reports where status = 'OPEN'"
                                                + " and reporter_id = :r")
                                .param("r", reader)
                                .query(Long.class)
                                .single())
                .isEqualTo(2);
    }

    // ---------- helpers ----------

    private ResultActions putAs(UUID user, String url) throws Exception {
        return mvc.perform(MockMvcRequestBuilders.put(url).with(sessions.as(user)));
    }

    private ResultActions report(UUID user, String url, String body) throws Exception {
        return mvc.perform(
                post(url)
                        .with(sessions.as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private ResultActions settle(UUID report, String body) throws Exception {
        return mvc.perform(
                post("/api/v1/admin/reports/" + report + "/settle")
                        .with(sessions.as(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(
                result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private String postComment(UUID user, String text) throws Exception {
        return body(mvc.perform(
                                post("/api/v1/series/glass-compass/comments")
                                        .with(sessions.as(user))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                json.writeValueAsString(
                                                        java.util.Map.of("body", text))))
                        .andExpect(status().isCreated()))
                .get("id")
                .asString();
    }

    private int caseOf(UUID reporter, String comment, String reason) throws Exception {
        return body(report(
                                reporter,
                                "/api/v1/comments/" + comment + "/report",
                                "{\"reason\":\"" + reason + "\"}")
                        .andExpect(status().isAccepted()))
                .get("caseNumber")
                .asInt();
    }

    private UUID reportId(int caseNumber) {
        return jdbc.sql("select id from reports where case_number = :n")
                .param("n", caseNumber)
                .query(UUID.class)
                .single();
    }

    private String accountStatus(UUID user) {
        return jdbc.sql("select status from users where id = :id")
                .param("id", user)
                .query(String.class)
                .single();
    }

    private long notificationsFor(UUID user) {
        return jdbc.sql("select count(*) from notifications where user_id = :u")
                .param("u", user)
                .query(Long.class)
                .single();
    }

    private String topCommentId() {
        return jdbc.sql(
                        "select c.id from comments c join series s on s.id = c.series_id"
                                + " where s.slug = 'glass-compass' and c.episode_id is null"
                                + " order by c.like_count desc limit 1")
                .query(UUID.class)
                .single()
                .toString();
    }

    private UUID authorOfTopComment() {
        return jdbc.sql("select author_id from comments where id = :id::uuid")
                .param("id", topCommentId())
                .query(UUID.class)
                .single();
    }
}
