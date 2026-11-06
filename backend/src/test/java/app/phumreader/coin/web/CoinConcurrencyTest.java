package app.phumreader.coin.web;

import static org.assertj.core.api.Assertions.assertThat;

import app.phumreader.auth.service.JwtService;
import app.phumreader.coin.service.CoinService;
import app.phumreader.coin.service.CoinViews.UnlockResult;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.payment.domain.PaymentMethod;
import app.phumreader.payment.service.PaymentService;
import app.phumreader.payment.service.PaymentViews.OrderView;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Parallel requests against real transactions (plan P3-10 / P3-11 "done when"): 50 unlocks with the
 * same key charge once, the balance never goes below zero, and a payment confirmed many times at
 * once is credited once.
 *
 * <p>Not rolled back (each request commits): every test uses a new reader. The ledger is
 * append-only, so these rows stay in the test database.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
class CoinConcurrencyTest {

    static final Instant DEMO_NOON = Instant.parse("2026-11-05T05:00:00Z");
    static final int THREADS = 50;

    @Autowired CoinService coins;
    @Autowired PaymentService payments;
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
    void fiftyUnlocksWithTheSameKeyChargeOnce() throws Exception {
        UUID id = sessions.newReader("Parallel");
        sessions.grantCoins(id, 12);
        CurrentUser reader = new CurrentUser(id, Set.of("READER"));

        List<UnlockResult> results =
                inParallel(() -> coins.unlock(reader, "glass-compass", 66, "same-key-1234"));

        assertThat(results).hasSize(THREADS).allMatch(r -> r.coins() == 5 && r.balance() == 7);
        assertThat(coins.balance(id)).isEqualTo(7);
        assertThat(count("select count(*) from unlocks where user_id = :u", id)).isEqualTo(1);
        assertThat(
                        count(
                                "select count(*) from coin_ledger where user_id = :u and reason = 'UNLOCK'",
                                id))
                .isEqualTo(1);
        assertThat(sessions.walletMatchesLedger(id)).isTrue();
    }

    @Test
    void theBalanceNeverGoesBelowZero() throws Exception {
        UUID id = sessions.newReader("Parallel");
        sessions.grantCoins(id, 12);
        CurrentUser reader = new CurrentUser(id, Set.of("READER"));

        // 50 requests with their own keys for three 5-coin episodes, with coins for two.
        List<Object> outcomes = new ArrayList<>();
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Object>> futures = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            int episode = 66 + i % 3;
            String key = "own-key-" + i + "-" + UUID.randomUUID();
            futures.add(
                    pool.submit(() -> {
                        start.await();
                        try {
                            return coins.unlock(reader, "glass-compass", episode, key);
                        } catch (RuntimeException ex) {
                            return ex.getClass().getSimpleName();
                        }
                    }));
        }
        start.countDown();
        for (Future<Object> f : futures) {
            outcomes.add(f.get());
        }
        pool.shutdown();

        assertThat(coins.balance(id)).isEqualTo(2);
        assertThat(count("select count(*) from unlocks where user_id = :u", id)).isEqualTo(2);
        assertThat(outcomes).contains("LockedException");
        assertThat(
                        count(
                                "select count(*) from coin_ledger where user_id = :u"
                                        + " and balance_after < 0",
                                id))
                .isZero();
        assertThat(sessions.walletMatchesLedger(id)).isTrue();
    }

    @Test
    void aPaymentConfirmedManyTimesIsCreditedOnce() throws Exception {
        UUID id = sessions.newReader("Parallel");
        CurrentUser reader = new CurrentUser(id, Set.of("READER"));
        OrderView order = payments.createOrder(reader, 4, PaymentMethod.KHQR, "order-key-1234");
        UUID orderId =
                jdbc.sql("select id from payment_orders where order_number = :n")
                        .param("n", order.orderNumber())
                        .query(UUID.class)
                        .single();

        List<OrderView> results = inParallel(() -> payments.confirmPaid(orderId, "WEBHOOK-1"));

        // 120 coins + 20 pack bonus + 120 first-purchase bonus, once.
        assertThat(results).allMatch(r -> r.totalCoins() == 260);
        assertThat(coins.balance(id)).isEqualTo(260);
        assertThat(count("select count(*) from coin_ledger where user_id = :u", id)).isEqualTo(3);
        assertThat(sessions.walletMatchesLedger(id)).isTrue();
    }

    private <T> List<T> inParallel(Callable<T> task) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<T>> futures = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            futures.add(
                    pool.submit(() -> {
                        start.await();
                        return task.call();
                    }));
        }
        start.countDown();
        List<T> results = new ArrayList<>();
        for (Future<T> f : futures) {
            results.add(f.get());
        }
        pool.shutdown();
        return results;
    }

    private long count(String sql, UUID userId) {
        return jdbc.sql(sql).param("u", userId).query(Long.class).single();
    }
}
