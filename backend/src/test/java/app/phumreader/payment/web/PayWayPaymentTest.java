package app.phumreader.payment.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.payment.domain.PaymentMethod;
import app.phumreader.payment.service.PayWayGateway;
import app.phumreader.payment.service.PayWaySigner;
import app.phumreader.payment.service.PaymentReconciler;
import app.phumreader.payment.service.PaymentService;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Paying with ABA PayWay (plan P3-11), against an in-memory PayWay: the signed callback, coins
 * credited once however often it arrives, an expired order, a late payment and reconciliation.
 */
@IntegrationTest
@Import({AuthTestConfig.class, PayWayPaymentTest.FakePayWayConfig.class})
@TestPropertySource(
        properties = {
            "phumreader.payments.simulator=false",
            "phumreader.payments.payway.api-key=test-api-key"
        })
@Transactional
class PayWayPaymentTest {

    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");
    static final String KEY = "test-api-key";

    /** PayWay's side: what each payment looks like to a status check. */
    static class FakePayWay implements PayWayGateway {
        final Map<String, Check> payments = new HashMap<>();
        final List<String> started = new java.util.ArrayList<>();
        String lastAmount;
        String lastCurrency;

        @Override
        public Checkout start(
                String tranId,
                String amount,
                String currency,
                PaymentMethod method,
                int lifetimeMinutes) {
            started.add(tranId);
            lastAmount = amount;
            lastCurrency = currency;
            return method == PaymentMethod.CARD
                    ? new Checkout(
                            null,
                            null,
                            null,
                            "https://pay.test/purchase",
                            Map.of("tran_id", tranId))
                    : new Checkout(
                            "000201-qr",
                            "abamobilebank://pay",
                            "data:image/png;base64,AAAA",
                            null,
                            null);
        }

        @Override
        public Check check(String tranId) {
            return payments.getOrDefault(tranId, new Check(Status.NOT_FOUND, null, null));
        }

        void approve(String tranId, String amount, String currency) {
            payments.put(tranId, new Check(Status.APPROVED, new BigDecimal(amount), currency));
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FakePayWayConfig {
        @Bean
        FakePayWay fakePayWay() {
            return new FakePayWay();
        }
    }

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired JsonMapper json;
    @Autowired RateLimiter limiter;
    @Autowired PlatformTransactionManager transactions;
    @Autowired FakePayWay payWay;
    @Autowired PaymentService payments;
    @Autowired PaymentReconciler reconciler;

    Sessions sessions;

    @BeforeEach
    void setUp() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(DEMO_NOON);
        limiter.clear();
        sessions = new Sessions(jwt, jdbc);
        payWay.payments.clear();
        payWay.started.clear();
        // Pack 2 (30 coins) costs $2.50 for these tests; prices are set in the admin (A2).
        jdbc.sql("update coin_packs set price_usd_cents = 250 where id = 2").update();
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    @Test
    void anOrderStartsAPayWayPaymentAndTheSignedCallbackCreditsCoinsOnce() throws Exception {
        UUID reader = sessions.newReader("Dara");
        ResultActions created =
                createOrder(reader, 2, "khqr", "payway-key-0001")
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.provider").value("payway"))
                        .andExpect(jsonPath("$.status").value("pending"))
                        .andExpect(jsonPath("$.checkout.qrString").value("000201-qr"))
                        .andExpect(jsonPath("$.checkout.abaDeeplink").value("abamobilebank://pay"));
        String number = orderNumber(created);
        assertThat(payWay.lastAmount).isEqualTo("2.50");
        assertThat(payWay.lastCurrency).isEqualTo("USD");

        // Not paid yet (PayWay does not know the order): a callback changes nothing and the order
        // stays open.
        callback(number, true).andExpect(status().isOk());
        assertThat(balance(reader)).isZero();
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("pending"));

        payWay.approve(number, "2.50", "USD");
        for (int i = 0; i < 2; i++) { // PayWay delivers the callback twice
            callback(number, true).andExpect(status().isOk());
        }
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("paid"))
                .andExpect(jsonPath("$.checkout").doesNotExist());
        // 30 + 3 bonus + 30 first purchase bonus.
        assertThat(balance(reader)).isEqualTo(63);
        assertThat(sessions.walletMatchesLedger(reader)).isTrue();
    }

    @Test
    void aCallbackWithAWrongOrMissingSignatureIsRefused() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = orderNumber(createOrder(reader, 2, "aba", "payway-key-0002"));
        payWay.approve(number, "2.50", "USD");

        callback(number, false).andExpect(status().isUnauthorized());
        mvc.perform(
                        post("/api/v1/payments/payway/callback")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(callbackBody(number)))
                .andExpect(status().isUnauthorized());
        assertThat(balance(reader)).isZero();
    }

    @Test
    void aPaymentOfTheWrongAmountCreditsNothing() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = orderNumber(createOrder(reader, 2, "khqr", "payway-key-0003"));
        payWay.approve(number, "0.50", "USD");

        callback(number, true).andExpect(status().isOk());
        assertThat(balance(reader)).isZero();
    }

    @Test
    void anUnknownOrderIsAcknowledgedAndIgnored() throws Exception {
        callback("PR-00000000", true).andExpect(status().isOk());
    }

    @Test
    void anOrderPastItsTimeShowsAsExpiredAndTheSweepStoresIt() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = orderNumber(createOrder(reader, 2, "khqr", "payway-key-0004"));
        payWay.payments.put(
                number, new PayWayGateway.Check(PayWayGateway.Status.PENDING, null, null));

        clock.advance(Duration.ofMinutes(11));
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("expired"));
        assertThat(reconciler.run(payments.expiredOrderNumbers(), true)).isZero();
        assertThat(
                        jdbc.sql("select status from payment_orders where order_number = :n")
                                .param("n", number)
                                .query(String.class)
                                .single())
                .isEqualTo("EXPIRED");
        assertThat(balance(reader)).isZero();
    }

    @Test
    void aPaymentThatArrivesAfterExpiryIsStillCreditedByReconciliation() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String number = orderNumber(createOrder(reader, 2, "khqr", "payway-key-0005"));
        clock.advance(Duration.ofMinutes(11));
        reconciler.run(payments.expiredOrderNumbers(), true);
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("expired"));

        payWay.approve(number, "2.50", "USD"); // the callback was lost; PayWay took the money
        assertThat(reconciler.run(payments.unpaidOrderNumbers(), false)).isEqualTo(1);
        assertThat(reconciler.run(payments.unpaidOrderNumbers(), false)).isZero();
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("paid"));
        assertThat(balance(reader)).isEqualTo(63);
    }

    @Test
    void aPaymentWithTheWrongAmountIsNotCreditedAndShowsAsStuckUntilAnAdminAddsTheCoins()
            throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID admin = sessions.newReader("Admin Boran");
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'ADMIN')")
                .param("id", admin)
                .update();
        String number = orderNumber(createOrder(reader, 2, "khqr", "payway-key-0009"));
        payWay.approve(number, "1.00", "USD"); // PayWay took $1.00, the order is $2.50

        assertThat(reconciler.run(payments.unpaidOrderNumbers(), false)).isZero();
        reconciler.run(payments.unpaidOrderNumbers(), false); // finding it again adds nothing
        assertThat(balance(reader)).isZero();

        String body =
                mvc.perform(
                                get("/api/v1/admin/stuck-payments?status=open")
                                        .with(sessions.as(admin, "ADMIN")))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.items.length()").value(1))
                        .andExpect(jsonPath("$.items[0].order.orderNumber").value(number))
                        .andExpect(jsonPath("$.items[0].order.coins").value(63))
                        .andExpect(jsonPath("$.items[0].paidAmount").value(1.0))
                        .andExpect(jsonPath("$.items[0].currency").value("USD"))
                        .andExpect(jsonPath("$.items[0].status").value("open"))
                        .andReturn()
                        .getResponse()
                        .getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        String id = json.readTree(body).get("items").get(0).get("id").asString();

        mvc.perform(
                        post("/api/v1/admin/stuck-payments/" + id + "/add-coins")
                                .with(sessions.as(admin, "ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"note\":\"Checked in PayWay: $1.00 paid, pack at half price\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("resolved"))
                .andExpect(jsonPath("$.resolvedBy").value("Admin Boran"));
        assertThat(balance(reader)).isEqualTo(63);
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("paid"));
        // Once only.
        mvc.perform(
                        post("/api/v1/admin/stuck-payments/" + id + "/add-coins")
                                .with(sessions.as(admin, "ADMIN"))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("stuck_resolved"));
        assertThat(balance(reader)).isEqualTo(63);
        mvc.perform(
                        get("/api/v1/admin/stuck-payments?status=open")
                                .with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(0));
        mvc.perform(
                        get("/api/v1/admin/audit?action=order.add_coins")
                                .with(sessions.as(admin, "ADMIN")))
                .andExpect(jsonPath("$.items.length()").value(1));
    }

    @Test
    void aPackWithoutAPriceCannotBeBought() throws Exception {
        UUID reader = sessions.newReader("Dara");
        createOrder(reader, 1, "khqr", "payway-key-0006")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error.code").value("price_not_set"));
        assertThat(payWay.started).isEmpty();
    }

    @Test
    void theCardMethodReturnsAFormForPayWaysHostedPage() throws Exception {
        UUID reader = sessions.newReader("Dara");
        createOrder(reader, 2, "card", "payway-key-0007")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.checkout.formAction").value("https://pay.test/purchase"))
                .andExpect(jsonPath("$.checkout.formFields.tran_id").exists());
    }

    @Test
    void signaturesFollowTheDocumentedRecipe() {
        // Base64(HMAC-SHA512(data, key)), computed independently with openssl.
        assertThat(PayWaySigner.sign("abc", "key"))
                .isEqualTo(
                        "OSaiB8jEKwxBeSy9PhoaqvX3olcE9i38k5xJh9184GAAnFuxwkRzVbMhbxC1N+mvp7ZKTlORsNYxFy0Hk54Ieg==");
    }

    // ---------- helpers ----------

    private ResultActions callback(String number, boolean signed) throws Exception {
        String body = callbackBody(number);
        var request =
                post("/api/v1/payments/payway/callback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body);
        if (signed) {
            request =
                    request.header(
                            "X-PAYWAY-HMAC-SHA512",
                            PayWaySigner.sign(PayWaySigner.callbackData(json.readTree(body)), KEY));
        } else {
            request = request.header("X-PAYWAY-HMAC-SHA512", "bm90LXRoZS1zaWduYXR1cmU=");
        }
        return mvc.perform(request);
    }

    private static String callbackBody(String number) {
        return "{\"tran_id\":\""
                + number
                + "\",\"status\":\"0\",\"apv\":\"123456\","
                + "\"payment_amount\":2.5,\"payment_type\":\"KHQR\"}";
    }

    private int balance(UUID reader) {
        return jdbc.sql("select balance from coin_wallets where user_id = :u")
                .param("u", reader)
                .query(Integer.class)
                .optional()
                .orElse(0);
    }

    private ResultActions createOrder(UUID user, int packId, String method, String key)
            throws Exception {
        return mvc.perform(
                post("/api/v1/coins/orders")
                        .with(sessions.as(user))
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"packId\":" + packId + ",\"method\":\"" + method + "\"}"));
    }

    private String orderNumber(ResultActions created) throws Exception {
        return json.readTree(
                        created.andReturn()
                                .getResponse()
                                .getContentAsString(StandardCharsets.UTF_8))
                .get("orderNumber")
                .asString();
    }
}
