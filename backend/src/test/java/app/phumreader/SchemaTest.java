package app.phumreader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.phumreader.support.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** The rules the database itself enforces (V1__init.sql). Each test rolls back. */
@IntegrationTest
@Transactional
class SchemaTest {

    @Autowired JdbcTemplate jdbc;

    @Test
    void everyTableHasRowLevelSecurity() {
        assertThat(
                        jdbc.queryForList(
                                "select c.relname from pg_class c join pg_namespace n on n.oid ="
                                        + " c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'flyway_schema_history'"
                                        + " and not c.relrowsecurity",
                                String.class))
                .as("tables in public without row level security")
                .isEmpty();
        assertThat(
                        jdbc.queryForObject(
                                "select count(*) from pg_tables where schemaname = 'public'",
                                Integer.class))
                .isGreaterThan(30);
    }

    @Test
    void coinLedgerIsAppendOnly() {
        UUID user = user();
        jdbc.update(
                "insert into coin_ledger (user_id, amount, balance_after, reason) values (?, 3, 3,"
                        + " 'BONUS')",
                user);
        assertThatThrownBy(() -> jdbc.update("update coin_ledger set amount = 300"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("append-only");
    }

    @Test
    void walletBalanceCannotGoBelowZero() {
        UUID user = user();
        assertThatThrownBy(() ->
                        jdbc.update(
                                "insert into coin_wallets (user_id, balance) values (?, -1)", user))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void anOrderIsCreditedOnlyOnce() {
        UUID user = user();
        jdbc.update("insert into coin_packs (id, coins, position) values (1, 10, 1)");
        UUID order = UUID.randomUUID();
        jdbc.update(
                "insert into payment_orders (id, order_number, user_id, pack_id, coins, method,"
                        + " provider, expires_at) values (?, 'PR-00000001', ?, 1, 10, 'KHQR', 'TEST',"
                        + " now() + interval '10 minutes')",
                order,
                user);
        String credit =
                "insert into coin_ledger (user_id, amount, balance_after, reason, order_id)"
                        + " values (?, 10, 10, 'PURCHASE', ?)";
        jdbc.update(credit, user, order);
        assertThatThrownBy(() -> jdbc.update(credit, user, order))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void fastPassNeedsBothAPriceAndAFreeDate() {
        UUID creator = user();
        jdbc.update(
                "insert into creator_profiles (user_id, pen_name, accepted_terms_at) values (?, 'Test',"
                        + " now())",
                creator);
        jdbc.update(
                "insert into genres (id, slug, name, position) values (1, 'drama', 'Drama', 1)");
        UUID series = UUID.randomUUID();
        jdbc.update(
                "insert into series (id, slug, creator_id, type, title, genre_id) values (?, 'test',"
                        + " ?, 'COMIC', 'Test', 1)",
                series,
                creator);
        assertThatThrownBy(() ->
                        jdbc.update(
                                "insert into episodes (series_id, number, title, price_coins)"
                                        + " values (?, 1, 'Episode 1', 5)",
                                series))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("episodes_fast_pass_check");
    }

    private UUID user() {
        UUID id = UUID.randomUUID();
        jdbc.update(
                "insert into users (id, email, display_name) values (?, ?, 'Test')",
                id,
                id + "@test.invalid");
        return id;
    }
}
