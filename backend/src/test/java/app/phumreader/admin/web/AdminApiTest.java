package app.phumreader.admin.web;

import static org.assertj.core.api.Assertions.assertThat;
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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * The admin API (plan P3-18): only ADMIN gets in, and every action leaves an audit row with who,
 * what and when. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class AdminApiTest {

    static final Instant NOON = Instant.parse("2026-11-05T05:00:00Z");
    static final String ADMIN = "/api/v1/admin";

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
    void anAdmin() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(NOON);
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

    // ---------- who may come in ----------

    @Test
    void onlyAdminsMayUseTheAdminApi() throws Exception {
        UUID reader = sessions.newReader("Reader");
        UUID creator = sessions.newReader("Creator");
        for (String path :
                new String[] {
                    "/overview", "/users", "/content?type=series", "/reports", "/orders", "/audit"
                }) {
            mvc.perform(get(ADMIN + path).with(sessions.guest()))
                    .andExpect(status().isUnauthorized());
            mvc.perform(get(ADMIN + path).with(sessions.as(reader)))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.error.code").exists());
            mvc.perform(get(ADMIN + path).with(sessions.as(creator, "CREATOR")))
                    .andExpect(status().isForbidden());
            mvc.perform(get(ADMIN + path).with(sessions.as(admin, "ADMIN")))
                    .andExpect(status().isOk());
        }
        mvc.perform(
                        post(ADMIN + "/users/" + reader + "/ban")
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"reason\":\"x\"}"))
                .andExpect(status().isForbidden());
        assertThat(count("select count(*) from audit_log")).isZero();
    }

    // ---------- users ----------

    @Test
    void banningSuspendsTheAccountAndSignsItOut() throws Exception {
        UUID target = sessions.newReader("Troll");
        jdbc.sql(
                        "insert into refresh_tokens (user_id, family_id, token_hash, expires_at)"
                                + " values (:u, gen_random_uuid(), 'hash-1', now() + interval '1 day')")
                .param("u", target)
                .update();

        mvc.perform(get(ADMIN + "/users?q=troll").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].status").value("active"))
                .andExpect(jsonPath("$.items[0].roles[0]").value("READER"));

        act("/users/" + target + "/ban", "{\"reason\":\"Harassment\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("banned"));
        assertThat(
                        count(
                                "select count(*) from refresh_tokens where user_id = '"
                                        + target
                                        + "' and revoked_at is null"))
                .isZero();
        act("/users/" + target + "/ban", "{\"reason\":\"Again\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("already_banned"));
        mvc.perform(get(ADMIN + "/users?status=banned").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1));

        act("/users/" + target + "/unban", "")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("active"));
        act("/users/" + target + "/unban", "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("not_banned"));

        // An admin cannot be suspended, a missing user is 404, a reason is required.
        act("/users/" + admin + "/ban", "{\"reason\":\"oops\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("cannot_ban_admin"));
        act("/users/" + UUID.randomUUID() + "/ban", "{\"reason\":\"x\"}")
                .andExpect(status().isNotFound());
        act("/users/" + target + "/ban", "{\"reason\":\"\"}").andExpect(status().isBadRequest());

        assertThat(
                        jdbc.sql("select action from audit_log where target_id = :t order by id")
                                .param("t", target.toString())
                                .query(String.class)
                                .list())
                .containsExactly("user.ban", "user.unban");
    }

    // ---------- content and reports ----------

    @Test
    void hidingContentTakesItDownAndResolvesItsReports() throws Exception {
        UUID reporter = sessions.newReader("Reporter");
        UUID series = id("select id from series where slug = 'glass-compass'");
        report(reporter, "SERIES", series);

        mvc.perform(get(ADMIN + "/reports?status=open").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].target.type").value("series"))
                .andExpect(jsonPath("$.items[0].target.status").value("published"))
                .andExpect(jsonPath("$.items[0].target.seriesSlug").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].reporter").value("Reporter"));
        mvc.perform(get(ADMIN + "/overview").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.openReports").value(1));

        mvc.perform(get("/api/v1/series/glass-compass")).andExpect(status().isOk());
        act("/content/series/" + series + "/hide", "{\"reason\":\"Copyright\"}")
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/series/glass-compass")).andExpect(status().isNotFound());
        act("/content/series/" + series + "/hide", "{\"reason\":\"Again\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("not_hideable"));
        assertThat(count("select count(*) from reports where status = 'OPEN'")).isZero();
        mvc.perform(
                        get(ADMIN + "/content?type=series&status=hidden")
                                .with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].title").value("Glass Compass"));

        act("/content/series/" + series + "/restore", "").andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/series/glass-compass")).andExpect(status().isOk());
        act("/content/series/" + series + "/restore", "")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("not_hidden"));

        assertThat(jdbc.sql("select action from audit_log order by id").query(String.class).list())
                .containsExactly("content.hide", "report.resolve", "content.restore");
    }

    @Test
    void anEpisodeAndACommentCanBeHidden() throws Exception {
        UUID episode =
                id(
                        "select e.id from episodes e join series s on s.id = e.series_id"
                                + " where s.slug = 'glass-compass' and e.number = 65");
        UUID comment =
                id(
                        "select c.id from comments c join series s on s.id = c.series_id"
                                + " where s.slug = 'glass-compass' and c.episode_id is null"
                                + " order by c.like_count desc limit 1");

        mvc.perform(get("/api/v1/series/glass-compass/comments"))
                .andExpect(jsonPath("$.items.length()").value(3));
        act("/content/comment/" + comment + "/hide", "{\"reason\":\"Abuse\"}")
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/series/glass-compass/comments"))
                .andExpect(jsonPath("$.items.length()").value(2));

        act("/content/episode/" + episode + "/hide", "{\"reason\":\"Violence\"}")
                .andExpect(status().isNoContent());
        assertThat(
                        count(
                                "select count(*) from episodes where id = '"
                                        + episode
                                        + "' and status = 'HIDDEN'"))
                .isEqualTo(1);
        mvc.perform(get("/api/v1/series/glass-compass/episodes/65"))
                .andExpect(status().isNotFound());
        act("/content/episode/" + episode + "/restore", "").andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/series/glass-compass/episodes/65")).andExpect(status().isOk());

        act("/content/video/" + episode + "/hide", "{\"reason\":\"x\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_type"));
        act("/content/episode/" + UUID.randomUUID() + "/hide", "{\"reason\":\"x\"}")
                .andExpect(status().isNotFound());
    }

    @Test
    void aCreatorCannotEditOrPublishAgainWhatAnAdminHid() throws Exception {
        UUID series = id("select id from series where slug = 'glass-compass'");
        UUID episode =
                id(
                        "select e.id from episodes e where e.series_id = '"
                                + series
                                + "' and e.number = 65");
        UUID creator = id("select creator_id from series where id = '" + series + "'");
        act("/content/episode/" + episode + "/hide", "{\"reason\":\"Violence\"}")
                .andExpect(status().isNoContent());
        act("/content/series/" + series + "/hide", "{\"reason\":\"Copyright\"}")
                .andExpect(status().isNoContent());

        mvc.perform(
                        post("/api/v1/creator/series/" + series + "/publish")
                                .with(sessions.as(creator, "CREATOR")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("hidden_by_admin"));
        mvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete(
                                        "/api/v1/creator/series/" + series + "/episodes/65")
                                .with(sessions.as(creator, "CREATOR")))
                .andExpect(status().isConflict());
        assertThat(
                        count(
                                "select count(*) from episodes where id = '"
                                        + episode
                                        + "' and status = 'HIDDEN'"))
                .isEqualTo(1);
    }

    @Test
    void aReportCanBeDismissedResolvedOrUsedToHide() throws Exception {
        UUID reporter = sessions.newReader("Reporter");
        UUID other = sessions.newReader("Other");
        UUID series = id("select id from series where slug = 'glass-compass'");
        UUID comment =
                id(
                        "select c.id from comments c join series s on s.id = c.series_id"
                                + " where s.slug = 'glass-compass' and c.episode_id is null"
                                + " order by c.like_count desc limit 1");

        UUID spam = report(reporter, "SERIES", series);
        act("/reports/" + spam + "/settle", "{\"action\":\"dismiss\",\"note\":\"Fine\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("dismissed"))
                .andExpect(jsonPath("$.resolvedBy").value("Admin Boran"))
                .andExpect(jsonPath("$.note").value("Fine"));
        act("/reports/" + spam + "/settle", "{\"action\":\"resolve\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("report_closed"));

        // Two readers report the same comment; hiding through one settles both.
        UUID first = report(reporter, "COMMENT", comment);
        UUID second = report(other, "COMMENT", comment);
        act("/reports/" + first + "/settle", "{\"action\":\"hide\",\"note\":\"Rude\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("resolved"))
                .andExpect(jsonPath("$.target.status").value("hidden"));
        mvc.perform(get(ADMIN + "/reports?status=open").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(get(ADMIN + "/reports?status=resolved").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(2));
        assertThat(second).isNotNull();

        UUID again = report(reporter, "SERIES", series);
        act("/reports/" + again + "/settle", "{\"action\":\"resolve\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("resolved"));
        act("/reports/" + UUID.randomUUID() + "/settle", "{\"action\":\"resolve\"}")
                .andExpect(status().isNotFound());
        act("/reports/" + again + "/settle", "{\"action\":\"nuke\"}")
                .andExpect(status().isBadRequest());
    }

    // ---------- orders ----------

    @Test
    void refundingAPaidOrderTakesItsCoinsBackThroughTheLedger() throws Exception {
        UUID reader = sessions.newReader("Buyer");
        String number = paidOrder(reader, 4, "refund-key-0001");
        assertThat(balance(reader)).isEqualTo(260);

        String orderId =
                mvc.perform(get(ADMIN + "/orders?q=" + number).with(sessions.as(admin, "ADMIN")))
                        .andExpect(jsonPath("$.items.length()").value(1))
                        .andExpect(jsonPath("$.items[0].status").value("paid"))
                        .andExpect(jsonPath("$.items[0].refundable").value(true))
                        .andExpect(jsonPath("$.items[0].coins").value(260))
                        .andExpect(jsonPath("$.items[0].displayName").value("Buyer"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        String id = json.readTree(orderId).get("items").get(0).get("id").asString();

        act("/orders/" + id + "/refund", "{\"reason\":\"Charged twice\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundedCoins").value(260))
                .andExpect(jsonPath("$.order.status").value("refunded"))
                .andExpect(jsonPath("$.order.refundable").value(false))
                .andExpect(jsonPath("$.order.refundedAt").value("2026-11-05T05:00:00Z"));
        assertThat(balance(reader)).isZero();
        assertThat(sessions.walletMatchesLedger(reader)).isTrue();
        assertThat(
                        jdbc.sql(
                                        "select amount || ':' || reason || ':' || note from coin_ledger"
                                                + " where user_id = :u and reason = 'REFUND'")
                                .param("u", reader)
                                .query(String.class)
                                .single())
                .isEqualTo("-260:REFUND:Refund " + number + ": Charged twice");

        act("/orders/" + id + "/refund", "{\"reason\":\"Again\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("order_not_refundable"));
        assertThat(balance(reader)).isZero();
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("refunded"));

        // The first-purchase bonus is not given a second time.
        String second = paidOrder(reader, 4, "refund-key-0002");
        mvc.perform(get("/api/v1/coins/orders/" + second).with(sessions.as(reader)))
                .andExpect(jsonPath("$.firstBonusCoins").value(0));
        assertThat(balance(reader)).isEqualTo(140);

        assertThat(
                        jdbc.sql(
                                        "select details->>'coins' from audit_log"
                                                + " where action = 'order.refund'")
                                .query(String.class)
                                .single())
                .isEqualTo("260");
    }

    @Test
    void anOrderWhoseCoinsWereSpentCannotBeRefunded() throws Exception {
        UUID reader = sessions.newReader("Spender");
        String number = paidOrder(reader, 1, "spend-key-0001");
        UUID order = id("select id from payment_orders where order_number = '" + number + "'");
        int total = balance(reader);
        // The reader spends coins elsewhere (an adjustment row stands in for an unlock).
        jdbc.sql("update coin_wallets set balance = balance - 5 where user_id = :u")
                .param("u", reader)
                .update();
        jdbc.sql(
                        "insert into coin_ledger (user_id, amount, balance_after, reason, note)"
                                + " values (:u, -5, :b, 'ADJUSTMENT', 'Spent')")
                .param("u", reader)
                .param("b", total - 5)
                .update();

        act("/orders/" + order + "/refund", "{\"reason\":\"Please\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("coins_spent"));
        assertThat(balance(reader)).isEqualTo(total - 5);
        assertThat(count("select count(*) from audit_log")).isZero();

        // Orders that were never paid cannot be refunded either.
        String pending = createOrder(reader, 1, "spend-key-0002");
        UUID pendingId = id("select id from payment_orders where order_number = '" + pending + "'");
        act("/orders/" + pendingId + "/refund", "{\"reason\":\"x\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("order_not_refundable"));
        act("/orders/" + UUID.randomUUID() + "/refund", "{\"reason\":\"x\"}")
                .andExpect(status().isNotFound());
    }

    // ---------- audit log ----------

    @Test
    void everyActionLeavesAnAuditRowAndTheLogCannotBeChanged() throws Exception {
        UUID target = sessions.newReader("Troll");
        act("/users/" + target + "/ban", "{\"reason\":\"Spam\"}").andExpect(status().isOk());

        mvc.perform(get(ADMIN + "/audit").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].action").value("user.ban"))
                .andExpect(jsonPath("$.items[0].actorId").value(admin.toString()))
                .andExpect(jsonPath("$.items[0].actorName").value("Admin Boran"))
                .andExpect(jsonPath("$.items[0].targetType").value("USER"))
                .andExpect(jsonPath("$.items[0].targetId").value(target.toString()))
                .andExpect(jsonPath("$.items[0].details.reason").value("Spam"))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-05T05:00:00Z"));

        mvc.perform(get(ADMIN + "/audit?action=order.").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(
                        get(ADMIN + "/audit?action=user.&actor=" + admin)
                                .with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1));

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () -> jdbc.sql("update audit_log set action = 'x'").update())
                .hasMessageContaining("append-only");
    }

    @Test
    void listsPageWithACursor() throws Exception {
        for (int i = 0; i < 3; i++) {
            sessions.newReader("Extra " + i);
        }
        String body =
                mvc.perform(get(ADMIN + "/users?limit=2").with(sessions.as(admin, "ADMIN")))
                        .andExpect(jsonPath("$.items.length()").value(2))
                        .andExpect(jsonPath("$.nextCursor").isString())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        String cursor = json.readTree(body).get("nextCursor").asString();
        mvc.perform(
                        get(ADMIN + "/users?limit=2&cursor=" + cursor)
                                .with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(2));
        mvc.perform(get(ADMIN + "/users?cursor=nonsense").with(sessions.as(admin, "ADMIN")))
                .andExpect(status().isBadRequest());
    }

    // ---------- helpers ----------

    private ResultActions act(String path, String body) throws Exception {
        return mvc.perform(
                post(ADMIN + path)
                        .with(sessions.as(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private UUID report(UUID reporter, String type, UUID target) {
        return jdbc.sql(
                        "insert into reports (reporter_id, target_type, target_id, reason)"
                                + " values (:r, :type, :t, 'spam') returning id")
                .param("r", reporter)
                .param("type", type)
                .param("t", target)
                .query(UUID.class)
                .single();
    }

    private String createOrder(UUID user, int pack, String key) throws Exception {
        String body =
                mvc.perform(
                                post("/api/v1/coins/orders")
                                        .with(sessions.as(user))
                                        .header("Idempotency-Key", key)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"packId\":" + pack + ",\"method\":\"khqr\"}"))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8);
        return json.readTree(body).get("orderNumber").asString();
    }

    private String paidOrder(UUID user, int pack, String key) throws Exception {
        String number = createOrder(user, pack, key);
        mvc.perform(
                        post("/api/v1/coins/orders/" + number + "/simulate")
                                .with(sessions.as(user))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"outcome\":\"paid\"}"))
                .andExpect(status().isOk());
        return number;
    }

    private int balance(UUID user) {
        return jdbc.sql("select coalesce((select balance from coin_wallets where user_id = :u), 0)")
                .param("u", user)
                .query(Integer.class)
                .single();
    }

    private UUID id(String sql) {
        return jdbc.sql(sql).query(UUID.class).single();
    }

    private long count(String sql) {
        return jdbc.sql(sql).query(Long.class).single();
    }
}
