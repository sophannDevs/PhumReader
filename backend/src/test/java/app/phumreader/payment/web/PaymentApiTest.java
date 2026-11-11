package app.phumreader.payment.web;

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
import java.time.Duration;
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
 * Coin packs, orders with the dev payment simulator, the first-purchase bonus and purchase history
 * (plan P3-11). Every test rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class PaymentApiTest {

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
    void theShopListsThePacksAndWaysToPay() throws Exception {
        mvc.perform(get("/api/v1/coins/packs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.packs.length()").value(5))
                .andExpect(jsonPath("$.packs[0].coins").value(10))
                .andExpect(jsonPath("$.packs[0].bonus").value(0))
                .andExpect(jsonPath("$.packs[0].tag").doesNotExist())
                .andExpect(jsonPath("$.packs[3].coins").value(120))
                .andExpect(jsonPath("$.packs[3].bonus").value(20))
                .andExpect(jsonPath("$.packs[3].tag").value("popular"))
                .andExpect(jsonPath("$.packs[4].tag").value("best_value"))
                .andExpect(jsonPath("$.packs[4].priceUsdCents").doesNotExist())
                .andExpect(jsonPath("$.methods[0]").value("khqr"))
                .andExpect(jsonPath("$.methods[1]").value("aba"))
                .andExpect(jsonPath("$.methods[2]").value("card"))
                .andExpect(jsonPath("$.orderExpiryMinutes").value(10))
                .andExpect(jsonPath("$.simulator").value(true));
    }

    @Test
    void theFirstPaidOrderDoublesTheCoinsOnce() throws Exception {
        UUID reader = sessions.newReader("Dara");

        String number =
                orderNumber(
                        createOrder(reader, 4, "khqr", "order-key-0001")
                                .andExpect(status().isCreated())
                                .andExpect(
                                        jsonPath("$.orderNumber")
                                                .value(
                                                        org.hamcrest.Matchers.matchesPattern(
                                                                "PR-\\d{8}")))
                                .andExpect(jsonPath("$.status").value("pending"))
                                .andExpect(jsonPath("$.coins").value(120))
                                .andExpect(jsonPath("$.bonusCoins").value(20))
                                .andExpect(jsonPath("$.firstBonusCoins").value(120))
                                .andExpect(jsonPath("$.totalCoins").value(260))
                                .andExpect(jsonPath("$.method").value("khqr"))
                                .andExpect(jsonPath("$.provider").value("dev_simulator"))
                                .andExpect(jsonPath("$.expiresAt").value("2026-11-05T05:10:00Z")));
        // A retry with the same key returns the same order.
        createOrder(reader, 4, "khqr", "order-key-0001")
                .andExpect(jsonPath("$.orderNumber").value(number));
        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("pending"));

        for (int i = 0; i < 2; i++) {
            simulate(reader, number, "paid")
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("paid"))
                    .andExpect(jsonPath("$.paidAt").value("2026-11-05T05:00:00Z"))
                    .andExpect(jsonPath("$.totalCoins").value(260));
        }
        mvc.perform(get("/api/v1/me/coins").with(sessions.as(reader)))
                .andExpect(jsonPath("$.balance").value(260))
                .andExpect(jsonPath("$.firstPurchaseBonus").value(false));
        mvc.perform(get("/api/v1/me/coins/ledger").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].note").value("First purchase bonus"))
                .andExpect(jsonPath("$.items[0].amount").value(120))
                .andExpect(jsonPath("$.items[0].orderNumber").value(number))
                .andExpect(jsonPath("$.items[1].note").value("Pack bonus"))
                .andExpect(jsonPath("$.items[2].reason").value("purchase"));

        // The second order has no first-purchase bonus.
        String second =
                orderNumber(
                        createOrder(reader, 1, "card", "order-key-0002")
                                .andExpect(jsonPath("$.firstBonusCoins").value(0))
                                .andExpect(jsonPath("$.totalCoins").value(10)));
        simulate(reader, second, "paid").andExpect(jsonPath("$.status").value("paid"));
        mvc.perform(get("/api/v1/me/coins").with(sessions.as(reader)))
                .andExpect(jsonPath("$.balance").value(270));
        assertThat(sessions.walletMatchesLedger(reader)).isTrue();
    }

    @Test
    void twoOpenOrdersShareOneFirstPurchaseBonus() throws Exception {
        UUID reader = sessions.newReader("Dara");
        String a =
                orderNumber(
                        createOrder(reader, 2, "khqr", "order-key-0003")
                                .andExpect(jsonPath("$.firstBonusCoins").value(30)));
        String b =
                orderNumber(
                        createOrder(reader, 1, "aba", "order-key-0004")
                                .andExpect(jsonPath("$.firstBonusCoins").value(10)));

        simulate(reader, b, "paid").andExpect(jsonPath("$.firstBonusCoins").value(10));
        simulate(reader, a, "paid")
                .andExpect(jsonPath("$.firstBonusCoins").value(0))
                .andExpect(jsonPath("$.totalCoins").value(33));
        // 10 + 10 first bonus, then 30 + 3 bonus.
        mvc.perform(get("/api/v1/me/coins").with(sessions.as(reader)))
                .andExpect(jsonPath("$.balance").value(53));
    }

    @Test
    void failedCancelledAndExpiredOrdersCreditNothing() throws Exception {
        UUID reader = sessions.newReader("Dara");

        String failed = orderNumber(createOrder(reader, 2, "card", "order-key-0005"));
        simulate(reader, failed, "failed").andExpect(jsonPath("$.status").value("failed"));
        simulate(reader, failed, "paid")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("order_closed"));

        String cancelled = orderNumber(createOrder(reader, 2, "khqr", "order-key-0006"));
        for (int i = 0; i < 2; i++) {
            cancel(reader, cancelled)
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("cancelled"));
        }

        clock.advance(Duration.ofMinutes(1));
        String expired = orderNumber(createOrder(reader, 3, "khqr", "order-key-0007"));
        clock.advance(Duration.ofMinutes(10));
        mvc.perform(get("/api/v1/coins/orders/" + expired).with(sessions.as(reader)))
                .andExpect(jsonPath("$.status").value("expired"));
        simulate(reader, expired, "paid")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("order_expired"));
        cancel(reader, expired).andExpect(status().isConflict());

        mvc.perform(get("/api/v1/me/coins").with(sessions.as(reader)))
                .andExpect(jsonPath("$.balance").value(0))
                .andExpect(jsonPath("$.firstPurchaseBonus").value(true));
        mvc.perform(get("/api/v1/me/coins/orders").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].orderNumber").value(expired))
                .andExpect(jsonPath("$.items[0].status").value("expired"))
                .andExpect(
                        jsonPath("$.items[1].status")
                                .value(org.hamcrest.Matchers.oneOf("failed", "cancelled")));
        mvc.perform(get("/api/v1/me/coins/orders?limit=2").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.nextCursor").isString());
    }

    @Test
    void ordersAreCheckedAndPrivate() throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID other = sessions.newReader("Mony");
        String number = orderNumber(createOrder(reader, 1, "khqr", "order-key-0008"));

        mvc.perform(get("/api/v1/coins/orders/" + number).with(sessions.as(other)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("order_not_found"));
        simulate(other, number, "paid").andExpect(status().isNotFound());
        createOrder(reader, 99, "khqr", "order-key-0009")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.packId").value("unknown_pack"));
        createOrder(reader, 1, "bitcoin", "order-key-0010").andExpect(status().isBadRequest());
        createOrder(reader, 2, "khqr", "order-key-0008")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("idempotency_key_reused"));
        mvc.perform(
                        post("/api/v1/coins/orders")
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"packId\":1,\"method\":\"khqr\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("missing_idempotency_key"));
        mvc.perform(
                        post("/api/v1/coins/orders")
                                .with(sessions.guest())
                                .header("Idempotency-Key", "order-key-0011")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"packId\":1,\"method\":\"khqr\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theDemoFlowBuyTenCoinsThenUnlock() throws Exception {
        // Spec flow 3: the demo reader has 3 coins, buys the 10 pack (+10 first bonus), unlocks.
        UUID demoReader = sessions.userId("reader@phumireader.app");
        mvc.perform(
                        post("/api/v1/series/glass-compass/episodes/66/unlock")
                                .with(sessions.as(demoReader))
                                .header("Idempotency-Key", "unlock-key-0001"))
                .andExpect(status().isPaymentRequired());

        String number = orderNumber(createOrder(demoReader, 1, "khqr", "order-key-0012"));
        simulate(demoReader, number, "paid").andExpect(jsonPath("$.totalCoins").value(20));
        mvc.perform(
                        post("/api/v1/series/glass-compass/episodes/66/unlock")
                                .with(sessions.as(demoReader))
                                .header("Idempotency-Key", "unlock-key-0002"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(18));
        mvc.perform(get("/api/v1/series/glass-compass/episodes/66").with(sessions.as(demoReader)))
                .andExpect(status().isOk());
        assertThat(sessions.walletMatchesLedger(demoReader)).isTrue();
    }

    // ---------- helpers ----------

    private ResultActions createOrder(UUID user, int packId, String method, String key)
            throws Exception {
        return mvc.perform(
                post("/api/v1/coins/orders")
                        .with(sessions.as(user))
                        .header("Idempotency-Key", key)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"packId\":" + packId + ",\"method\":\"" + method + "\"}"));
    }

    private ResultActions simulate(UUID user, String number, String outcome) throws Exception {
        return mvc.perform(
                post("/api/v1/coins/orders/" + number + "/simulate")
                        .with(sessions.as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"outcome\":\"" + outcome + "\"}"));
    }

    private ResultActions cancel(UUID user, String number) throws Exception {
        return mvc.perform(
                post("/api/v1/coins/orders/" + number + "/cancel").with(sessions.as(user)));
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
