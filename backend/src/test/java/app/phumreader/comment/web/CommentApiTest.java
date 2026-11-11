package app.phumreader.comment.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Comments (plan P3-13): seeded threads, posting, likes, deleting, the on/off switch, rate limit
 * and reports. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class CommentApiTest {

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

    @BeforeEach
    void demoAtDemoNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(DEMO_NOON);
        limiter.clear();
        sessions = new Sessions(jwt, jdbc);
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    @Test
    void theSeededSeriesThreadHasATopComment() throws Exception {
        mvc.perform(get("/api/v1/series/glass-compass/comments"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].author.name").value("Sokha P."))
                .andExpect(jsonPath("$.items[0].likes").value(412))
                .andExpect(jsonPath("$.items[0].top").value(true))
                .andExpect(jsonPath("$.items[1].likes").value(168))
                .andExpect(jsonPath("$.items[1].top").value(false))
                .andExpect(jsonPath("$.items[2].likes").value(97))
                .andExpect(jsonPath("$.items[0].liked").value(false))
                .andExpect(jsonPath("$.items[0].mine").value(false))
                .andExpect(jsonPath("$.items[0].canDelete").value(false))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());
        // Newest first: 2 h, 5 h and 1 day before noon.
        mvc.perform(get("/api/v1/series/glass-compass/comments?sort=newest"))
                .andExpect(jsonPath("$.items[0].author.name").value("Sokha P."))
                .andExpect(jsonPath("$.items[1].author.name").value("Linh T."))
                .andExpect(jsonPath("$.items[2].author.name").value("Vibol K."))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-05T03:00:00Z"));
        mvc.perform(get("/api/v1/series/glass-compass/episodes/65/comments"))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(
                        jsonPath("$.items[0].body")
                                .value("The rooftop panel is my new wallpaper."));
        mvc.perform(get("/api/v1/series/glass-compass/comments?sort=best"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void postLikeAndDeleteAComment() throws Exception {
        UUID author = sessions.newReader("Dara");
        UUID other = sessions.newReader("Mony");
        UUID owen = sessions.creatorId("Owen Blake");

        String id =
                json.readTree(
                                postComment(
                                                author,
                                                "/api/v1/series/glass-compass/episodes/65/comments",
                                                "  Best episode yet!  ")
                                        .andExpect(status().isCreated())
                                        .andExpect(jsonPath("$.body").value("Best episode yet!"))
                                        .andExpect(jsonPath("$.author.name").value("Dara"))
                                        .andExpect(jsonPath("$.likes").value(0))
                                        .andExpect(jsonPath("$.mine").value(true))
                                        .andExpect(jsonPath("$.canDelete").value(true))
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString(StandardCharsets.UTF_8))
                        .get("id")
                        .asString();
        mvc.perform(
                        get("/api/v1/series/glass-compass/episodes/65/comments?sort=newest")
                                .with(sessions.as(author)))
                .andExpect(jsonPath("$.items.length()").value(4))
                .andExpect(jsonPath("$.items[0].id").value(id))
                .andExpect(jsonPath("$.items[0].mine").value(true));
        mvc.perform(get("/api/v1/series/glass-compass/episodes/65").with(sessions.as(author)))
                .andExpect(jsonPath("$.comments").value(4));

        for (int i = 0; i < 2; i++) {
            mvc.perform(put("/api/v1/comments/" + id + "/like").with(sessions.as(other)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.liked").value(true))
                    .andExpect(jsonPath("$.likes").value(1));
        }
        mvc.perform(
                        get("/api/v1/series/glass-compass/episodes/65/comments?sort=newest")
                                .with(sessions.as(other)))
                .andExpect(jsonPath("$.items[0].liked").value(true))
                .andExpect(jsonPath("$.items[0].canDelete").value(false));

        // Another reader may not delete it; the series' creator may.
        mvc.perform(delete("/api/v1/comments/" + id).with(sessions.as(other)))
                .andExpect(status().isForbidden());
        mvc.perform(
                        get("/api/v1/series/glass-compass/episodes/65/comments")
                                .with(sessions.as(owen, "READER", "CREATOR")))
                .andExpect(jsonPath("$.items[0].canDelete").value(true));
        mvc.perform(delete("/api/v1/comments/" + id).with(sessions.as(owen, "READER", "CREATOR")))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/series/glass-compass/episodes/65/comments"))
                .andExpect(jsonPath("$.items.length()").value(3));
        mvc.perform(put("/api/v1/comments/" + id + "/like").with(sessions.as(other)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("comment_not_found"));
        mvc.perform(delete("/api/v1/comments/" + id).with(sessions.as(author)))
                .andExpect(status().isNotFound());
    }

    @Test
    void commentsAreCheckedBeforeTheyArePosted() throws Exception {
        UUID reader = sessions.newReader("Dara");
        postComment(reader, "/api/v1/series/glass-compass/comments", "   ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.body").value("blank"));
        postComment(reader, "/api/v1/series/glass-compass/comments", "x".repeat(501))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.body").value("too_long"));
        postComment(reader, "/api/v1/series/glass-compass/comments", "x".repeat(500))
                .andExpect(status().isCreated());

        // A Fast Pass episode needs an unlock first; the creator can turn comments off.
        postComment(reader, "/api/v1/series/glass-compass/episodes/66/comments", "Early!")
                .andExpect(status().isPaymentRequired());
        jdbc.sql(
                        "update episodes set comments_enabled = false where number = 65"
                                + " and series_id = (select id from series where slug = 'glass-compass')")
                .update();
        postComment(reader, "/api/v1/series/glass-compass/episodes/65/comments", "Hello")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("comments_disabled"));

        mvc.perform(
                        post("/api/v1/series/glass-compass/comments")
                                .with(sessions.guest())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"body\":\"Hi\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tenCommentsPerTenMinutes() throws Exception {
        UUID reader = sessions.newReader("Dara");
        for (int i = 1; i <= 10; i++) {
            postComment(reader, "/api/v1/series/glass-compass/comments", "Comment " + i)
                    .andExpect(status().isCreated());
        }
        postComment(reader, "/api/v1/series/glass-compass/comments", "One more")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("too_many_comments"))
                .andExpect(jsonPath("$.error.retryAfterSeconds").isNumber());

        // Paging the newest 13 comments 4 at a time: each once.
        Set<String> ids = new HashSet<>();
        List<String> order = new ArrayList<>();
        String cursor = null;
        do {
            JsonNode page =
                    json.readTree(
                            mvc.perform(
                                            get(
                                                    "/api/v1/series/glass-compass/comments?sort=newest&limit=4"
                                                            + (cursor == null
                                                                    ? ""
                                                                    : "&cursor=" + cursor)))
                                    .andExpect(status().isOk())
                                    .andReturn()
                                    .getResponse()
                                    .getContentAsString(StandardCharsets.UTF_8));
            page.get("items")
                    .values()
                    .forEach(c -> {
                        ids.add(c.get("id").asString());
                        order.add(c.get("body").asString());
                    });
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
        } while (cursor != null);
        assertThat(ids).hasSize(13);
        assertThat(order.getFirst()).startsWith("Comment ");
    }

    @Test
    void reportsGoToTheAdminQueueOncePerTarget() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String commentId =
                jdbc.sql(
                                "select c.id from comments c join series s on s.id = c.series_id"
                                        + " where s.slug = 'glass-compass' and c.episode_id is null"
                                        + " order by c.like_count desc limit 1")
                        .query(UUID.class)
                        .single()
                        .toString();

        for (int i = 0; i < 2; i++) {
            report(reader, "/api/v1/series/glass-compass/report", "{\"reason\":\"spam\"}")
                    .andExpect(status().isAccepted());
        }
        report(
                        reader,
                        "/api/v1/series/glass-compass/episodes/65/report",
                        "{\"reason\":\"violence\",\"details\":\"Page 3\"}")
                .andExpect(status().isAccepted());
        report(reader, "/api/v1/comments/" + commentId + "/report", "{\"reason\":\"harass\"}")
                .andExpect(status().isAccepted());
        assertThat(
                        jdbc.sql(
                                        "select target_type || ':' || reason from reports where reporter_id = :r"
                                                + " order by target_type")
                                .param("r", reader)
                                .query(String.class)
                                .list())
                .containsExactly("COMMENT:harass", "EPISODE:violence", "SERIES:spam");

        report(reader, "/api/v1/series/glass-compass/report", "{\"reason\":\"\"}")
                .andExpect(status().isBadRequest());
        report(reader, "/api/v1/comments/" + UUID.randomUUID() + "/report", "{\"reason\":\"spam\"}")
                .andExpect(status().isNotFound());
        report(reader, "/api/v1/series/glass-compass/episodes/99/report", "{\"reason\":\"spam\"}")
                .andExpect(status().isNotFound());
    }

    // ---------- helpers ----------

    private ResultActions postComment(UUID user, String url, String body) throws Exception {
        return mvc.perform(
                post(url)
                        .with(sessions.as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(java.util.Map.of("body", body))));
    }

    private ResultActions report(UUID user, String url, String body) throws Exception {
        return mvc.perform(
                post(url)
                        .with(sessions.as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }
}
