package app.phumreader.support;

import app.phumreader.seed.DemoSeeder;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Seeds the demo content once per test database and keeps it (committed in its own transaction,
 * even when called from a test that rolls back). Tests that change data must roll back
 * ({@code @Transactional}), so every test sees the same demo.
 */
public final class SeededDemo {

    private SeededDemo() {}

    public static void ensure(
            DemoSeeder seeder, JdbcClient jdbc, PlatformTransactionManager transactions) {
        TransactionTemplate separate = new TransactionTemplate(transactions);
        separate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        separate.executeWithoutResult(status -> {
            if (jdbc.sql("select count(*) from series").query(Long.class).single() == 0) {
                seeder.seed();
            }
        });
    }
}
