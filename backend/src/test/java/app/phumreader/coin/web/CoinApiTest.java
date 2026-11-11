package app.phumreader.coin.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/**
 * Balance, Fast Pass unlocks and the coin ledger (plan P3-10) at the demo's "today". Every test
 * rolls back; parallel requests are in {@link CoinConcurrencyTest}.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class CoinApiTest {

    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");
    static final String EPISODE_66 = "/api/v1/series/glass-compass/episodes/66";

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;

    @BeforeEach
    void demoAtDemoNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(DEMO_NOON);
        sessions = new Sessions(jwt, jdbc);
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    @Test
    void theWalletShowsTheBalanceAndTheFirstPurchaseOffer() throws Exception {
        UUID demoReader = sessions.userId("reader@phumireader.app");
        mvc.perform(get("/api/v1/me/coins").with(sessions.as(demoReader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.balance").value(3))
                .andExpect(jsonPath("$.firstPurchaseBonus").value(true));
        mvc.perform(get("/api/v1/me/coins").with(sessions.as(sessions.newReader("Dara"))))
                .andExpect(jsonPath("$.balance").value(0));
        mvc.perform(get("/api/v1/me/coins")).andExpect(status().isUnauthorized());
    }

    @Test
    void anUnlockChargesOnceAndOpensTheEpisode() throws Exception {
        UUID reader = sessions.newReader("Dara");
        sessions.grantCoins(reader, 12);
        UUID owen = sessions.creatorId("Owen Blake");
        long earningsBefore = earnings(owen);

        unlock(reader, EPISODE_66, "key-0000001")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.episode").value(66))
                .andExpect(jsonPath("$.coins").value(5))
                .andExpect(jsonPath("$.balance").value(7))
                .andExpect(jsonPath("$.alreadyUnlocked").value(false));
        // The same request again: the same answer, nothing charged.
        unlock(reader, EPISODE_66, "key-0000001")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coins").value(5))
                .andExpect(jsonPath("$.balance").value(7));
        // A new request for the same episode: already unlocked, nothing charged.
        unlock(reader, EPISODE_66, "key-0000002")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.coins").value(0))
                .andExpect(jsonPath("$.balance").value(7))
                .andExpect(jsonPath("$.alreadyUnlocked").value(true));

        mvc.perform(get(EPISODE_66).with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewer.unlocked").value(true));
        mvc.perform(get("/api/v1/me/coins").with(sessions.as(reader)))
                .andExpect(jsonPath("$.balance").value(7));
        assertThat(sessions.walletMatchesLedger(reader)).isTrue();
        assertThat(earnings(owen)).isEqualTo(earningsBefore + 5);

        mvc.perform(get("/api/v1/me/coins/ledger").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].reason").value("unlock"))
                .andExpect(jsonPath("$.items[0].amount").value(-5))
                .andExpect(jsonPath("$.items[0].balanceAfter").value(7))
                .andExpect(jsonPath("$.items[0].episode.series").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].episode.n").value(66))
                .andExpect(jsonPath("$.items[1].reason").value("adjustment"))
                .andExpect(jsonPath("$.items[1].amount").value(12));
        mvc.perform(get("/api/v1/me/unlocked").with(sessions.as(reader)))
                .andExpect(jsonPath("$.items[0].episode.n").value(66));
    }

    @Test
    void withTooFewCoinsNothingChanges() throws Exception {
        UUID demoReader = sessions.userId("reader@phumireader.app");
        unlock(demoReader, EPISODE_66, "key-0000003")
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error.code").value("not_enough_coins"))
                .andExpect(jsonPath("$.error.price").value(5))
                .andExpect(jsonPath("$.error.freeOn").value("2026-11-12"));
        mvc.perform(get("/api/v1/me/coins").with(sessions.as(demoReader)))
                .andExpect(jsonPath("$.balance").value(3));
        mvc.perform(get(EPISODE_66).with(sessions.as(demoReader)))
                .andExpect(status().isPaymentRequired());
        assertThat(sessions.walletMatchesLedger(demoReader)).isTrue();
    }

    @Test
    void unlockRequestsAreChecked() throws Exception {
        UUID reader = sessions.newReader("Dara");
        sessions.grantCoins(reader, 20);

        unlock(reader, EPISODE_66, "key-0000004").andExpect(status().isOk());
        unlock(reader, "/api/v1/series/glass-compass/episodes/67", "key-0000004")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("idempotency_key_reused"));
        mvc.perform(post(EPISODE_66 + "/unlock").with(sessions.as(reader)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("missing_idempotency_key"));
        unlock(reader, EPISODE_66, "short")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_idempotency_key"));
        unlock(reader, "/api/v1/series/glass-compass/episodes/65", "key-0000005")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("episode_not_locked"));
        UUID owen = sessions.creatorId("Owen Blake");
        mvc.perform(
                        post(EPISODE_66 + "/unlock")
                                .with(sessions.as(owen, "READER", "CREATOR"))
                                .header("Idempotency-Key", "key-0000006"))
                .andExpect(status().isConflict());
        unlock(reader, "/api/v1/series/glass-compass/episodes/69", "key-0000007")
                .andExpect(status().isNotFound());
        mvc.perform(
                        post(EPISODE_66 + "/unlock")
                                .with(sessions.guest())
                                .header("Idempotency-Key", "key-0000008"))
                .andExpect(status().isUnauthorized());
        mvc.perform(
                        post(EPISODE_66 + "/unlock")
                                .with(sessions.withoutCsrf(reader))
                                .header("Idempotency-Key", "key-0000009"))
                .andExpect(status().isForbidden());

        // Only the first unlock was charged.
        mvc.perform(get("/api/v1/me/coins").with(sessions.as(reader)))
                .andExpect(jsonPath("$.balance").value(15));
        assertThat(sessions.walletMatchesLedger(reader)).isTrue();
    }

    // ---------- helpers ----------

    private ResultActions unlock(UUID reader, String episode, String key) throws Exception {
        return mvc.perform(
                post(episode + "/unlock").with(sessions.as(reader)).header("Idempotency-Key", key));
    }

    private long earnings(UUID creatorId) {
        return jdbc.sql(
                        "select coalesce(sum(coins), 0) from creator_earnings where creator_id = :c")
                .param("c", creatorId)
                .query(Long.class)
                .single();
    }
}
