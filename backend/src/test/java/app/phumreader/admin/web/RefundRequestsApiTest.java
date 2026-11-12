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
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Refund requests (V21-06): the reader asks from the receipt, an admin sees what can be refunded
 * and approves (the coins leave once) or declines with a reason. Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class RefundRequestsApiTest {

    static final Instant NOON = Instant.parse("2026-11-05T05:00:00Z");
    static final String ADMIN = "/api/v1/admin";
    static final String REASON = "I bought the wrong pack by mistake.";

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

    // ---------- the reader ----------

    @Test
    void aReaderAsksForARefundOfTheirPaidOrderOnce() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = paidOrder(reader, 2, "refund-key-0001");

        ask(reader, number, "{\"reason\":\"too short\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.reason").value("too_short"));
        ask(reader, number, "{\"reason\":\"" + "x".repeat(501) + "\"}")
                .andExpect(status().isBadRequest());
        ask(sessions.newReader("Other"), number, "{\"reason\":\"" + REASON + "\"}")
                .andExpect(status().isNotFound());

        ask(reader, number, "{\"reason\":\"" + REASON + "\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundRequest.status").value("open"))
                .andExpect(jsonPath("$.refundRequest.note").doesNotExist());
        ask(reader, number, "{\"reason\":\"" + REASON + "\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("refund_requested"));
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.refundRequest.status").value("open"));
    }

    @Test
    void onlyAPaidOrderCanBeRefunded() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = createOrder(reader, 2, "refund-key-0002");
        ask(reader, number, "{\"reason\":\"" + REASON + "\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("not_paid"));
    }

    // ---------- the admin ----------

    @Test
    void approvingTakesTheCoinsBackOnceAndTellsTheReader() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = paidOrder(reader, 2, "refund-key-0003");
        int total = balance(reader);
        assertThat(total).isGreaterThan(0);
        ask(reader, number, "{\"reason\":\"" + REASON + "\"}").andExpect(status().isOk());

        String id = requestId(number);
        mvc.perform(get(ADMIN + "/refund-requests?status=open").with(sessions.as(admin, "ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].order.orderNumber").value(number))
                .andExpect(jsonPath("$.items[0].order.coins").value(total))
                .andExpect(jsonPath("$.items[0].reason").value(REASON))
                .andExpect(jsonPath("$.items[0].eligibility.kind").value("unused"))
                .andExpect(jsonPath("$.items[0].eligibility.unused").value(total))
                .andExpect(jsonPath("$.items[0].eligibility.duplicate").value(false));

        decide(id, "approve", "{\"note\":\"Refunded in PayWay\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("approved"))
                .andExpect(jsonPath("$.refundedCoins").value(total))
                .andExpect(jsonPath("$.decidedBy").value("Admin Boran"));
        assertThat(balance(reader)).isZero();
        assertThat(orderStatus(number)).isEqualTo("REFUNDED");
        // Once: a second decision and a direct refund are refused, the ledger has one REFUND row.
        decide(id, "approve", "{}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("request_decided"));
        decide(id, "decline", "{\"reason\":\"No\"}").andExpect(status().isConflict());
        assertThat(
                        jdbc.sql(
                                        "select count(*) from coin_ledger where reason = 'REFUND'"
                                                + " and user_id = :u")
                                .param("u", reader)
                                .query(Long.class)
                                .single())
                .isEqualTo(1);
        assertThat(
                        jdbc.sql(
                                        "select sum(amount) from coin_ledger where reason = 'REFUND'"
                                                + " and user_id = :u")
                                .param("u", reader)
                                .query(Long.class)
                                .single())
                .isEqualTo(-total);

        // The reader sees it on the receipt and in the inbox; the audit log has it.
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("refunded"))
                .andExpect(jsonPath("$.refundRequest.status").value("approved"))
                .andExpect(jsonPath("$.refundRequest.refundedCoins").value(total));
        assertThat(
                        jdbc.sql(
                                        "select count(*) from notifications where user_id = :u"
                                                + " and type = 'order_refunded'")
                                .param("u", reader)
                                .query(Long.class)
                                .single())
                .isEqualTo(1);
        mvc.perform(get(ADMIN + "/audit?action=refund.approve").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1));
        mvc.perform(get(ADMIN + "/refund-requests?status=open").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(0));
    }

    @Test
    void whenSomeCoinsAreSpentOnlyTheUnusedOnesAreRefunded() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = paidOrder(reader, 2, "refund-key-0004");
        int total = balance(reader);
        // The reader spent 10 coins (the wallet is what is left).
        jdbc.sql("update coin_wallets set balance = balance - 10 where user_id = :u")
                .param("u", reader)
                .update();
        ask(reader, number, "{\"reason\":\"" + REASON + "\"}").andExpect(status().isOk());
        String id = requestId(number);

        mvc.perform(get(ADMIN + "/refund-requests").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items[0].eligibility.kind").value("partial"))
                .andExpect(jsonPath("$.items[0].eligibility.spent").value(10))
                .andExpect(jsonPath("$.items[0].eligibility.unused").value(total - 10));
        decide(id, "approve", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refundedCoins").value(total - 10));
        assertThat(balance(reader)).isZero();
    }

    @Test
    void withNoCoinsLeftOnlyDeclineWorksAndTheReaderSeesTheReason() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = paidOrder(reader, 2, "refund-key-0005");
        jdbc.sql("update coin_wallets set balance = 0 where user_id = :u")
                .param("u", reader)
                .update();
        ask(reader, number, "{\"reason\":\"" + REASON + "\"}").andExpect(status().isOk());
        String id = requestId(number);

        mvc.perform(get(ADMIN + "/refund-requests").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items[0].eligibility.kind").value("spent"));
        decide(id, "approve", "{}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("coins_spent"));
        // A refusal that rolled back leaves the request open.
        decide(id, "decline", "{\"reason\":\" \"}").andExpect(status().isBadRequest());
        decide(id, "decline", "{\"reason\":\"You already read the episodes.\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("declined"))
                .andExpect(jsonPath("$.note").value("You already read the episodes."));
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("paid"))
                .andExpect(jsonPath("$.refundRequest.status").value("declined"))
                .andExpect(
                        jsonPath("$.refundRequest.note").value("You already read the episodes."));
        mvc.perform(
                        get(ADMIN + "/refund-requests?status=declined")
                                .with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void aDoubleChargeIsFlagged() throws Exception {
        UUID reader = sessions.newReader("Dara");
        paidOrder(reader, 2, "refund-key-0006");
        String second = paidOrder(reader, 2, "refund-key-0007");
        ask(reader, second, "{\"reason\":\"I was charged twice for it.\"}")
                .andExpect(status().isOk());
        mvc.perform(get(ADMIN + "/refund-requests").with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items[0].eligibility.duplicate").value(true));
    }

    @Test
    void theOverviewCountsTheOpenRequestsAndStuckPaymentsLikeTheQueues() throws Exception {
        JsonNode before = adminJson("/overview");
        UUID reader = sessions.newReader("Dara");
        String first = paidOrder(reader, 2, "refund-key-0008");
        String second = paidOrder(reader, 2, "refund-key-0009");
        ask(reader, first, "{\"reason\":\"" + REASON + "\"}").andExpect(status().isOk());
        ask(reader, second, "{\"reason\":\"" + REASON + "\"}").andExpect(status().isOk());
        // PayWay took a different amount than the order: "paid but no coins".
        String pending = createOrder(reader, 2, "refund-key-0010");
        UUID stuck =
                jdbc.sql(
                                "insert into payment_stuck (order_id, kind, paid_amount, currency)"
                                        + " select id, 'AMOUNT_MISMATCH', 1.00, 'USD'"
                                        + " from payment_orders where order_number = :n"
                                        + " returning id")
                        .param("n", pending)
                        .query(UUID.class)
                        .single();

        JsonNode after = adminJson("/overview");
        long requests = after.get("openRefundRequests").asLong();
        long stuckPayments = after.get("openStuckPayments").asLong();
        assertThat(requests).isEqualTo(before.get("openRefundRequests").asLong() + 2);
        assertThat(stuckPayments).isEqualTo(before.get("openStuckPayments").asLong() + 1);
        // The same rows the open queues list.
        assertThat(adminJson("/refund-requests?status=open&limit=100").get("items").size())
                .isEqualTo(requests);
        assertThat(adminJson("/stuck-payments?status=open&limit=100").get("items").size())
                .isEqualTo(stuckPayments);

        // Decided requests and resolved payments leave the counts.
        decide(requestId(first), "decline", "{\"reason\":\"The coins were used.\"}")
                .andExpect(status().isOk());
        mvc.perform(
                        post(ADMIN + "/stuck-payments/" + stuck + "/add-coins")
                                .with(sessions.as(admin, "ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isOk());
        JsonNode settled = adminJson("/overview");
        assertThat(settled.get("openRefundRequests").asLong()).isEqualTo(requests - 1);
        assertThat(settled.get("openStuckPayments").asLong()).isEqualTo(stuckPayments - 1);
    }

    @Test
    void onlyAdminsSeeTheQueues() throws Exception {
        UUID reader = sessions.newReader("Dara");
        for (String path : new String[] {"/refund-requests", "/stuck-payments"}) {
            mvc.perform(get(ADMIN + path).with(sessions.as(reader)))
                    .andExpect(status().isForbidden());
            mvc.perform(get(ADMIN + path).with(sessions.as(admin, "ADMIN")))
                    .andExpect(status().isOk());
        }
        mvc.perform(
                        post(ADMIN + "/stuck-payments/" + UUID.randomUUID() + "/add-coins")
                                .with(sessions.as(admin, "ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isNotFound());
        decide(UUID.randomUUID().toString(), "approve", "{}").andExpect(status().isNotFound());
    }

    // ---------- helpers ----------

    private ResultActions ask(UUID user, String number, String body) throws Exception {
        return mvc.perform(
                post("/api/v1/coins/orders/" + number + "/refund-request")
                        .with(sessions.as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private ResultActions decide(String id, String what, String body) throws Exception {
        return mvc.perform(
                post(ADMIN + "/refund-requests/" + id + "/" + what)
                        .with(sessions.as(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private JsonNode adminJson(String path) throws Exception {
        return json.readTree(
                mvc.perform(get(ADMIN + path).with(sessions.as(admin, "ADMIN")))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse()
                        .getContentAsString(StandardCharsets.UTF_8));
    }

    private String requestId(String number) {
        return jdbc.sql(
                        "select r.id from refund_requests r join payment_orders o on o.id = r.order_id"
                                + " where o.order_number = :n")
                .param("n", number)
                .query(UUID.class)
                .single()
                .toString();
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

    private String orderStatus(String number) {
        return jdbc.sql("select status from payment_orders where order_number = :n")
                .param("n", number)
                .query(String.class)
                .single();
    }
}
