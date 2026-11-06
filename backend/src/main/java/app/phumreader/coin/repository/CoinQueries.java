package app.phumreader.coin.repository;

import app.phumreader.coin.domain.LedgerReason;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Wallets, the append-only coin ledger, unlocks and creator earnings (plain SQL). A wallet's
 * balance always equals the sum of its ledger rows: both change in the same transaction, with the
 * wallet row locked.
 */
@Repository
public class CoinQueries {

    /** A ledger row with what it was for. */
    public record LedgerRow(
            long id,
            int amount,
            int balanceAfter,
            LedgerReason reason,
            @Nullable String note,
            OffsetDateTime createdAt,
            @Nullable String orderNumber,
            @Nullable String seriesSlug,
            @Nullable String seriesTitle,
            @Nullable Integer episode) {}

    private final JdbcClient jdbc;

    public CoinQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- wallet ----------

    public int balance(UUID userId) {
        return jdbc.sql("select coalesce((select balance from coin_wallets where user_id = :u), 0)")
                .param("u", userId)
                .query(Integer.class)
                .single();
    }

    /**
     * Locks the user's wallet row until the transaction ends (creating an empty wallet first) and
     * returns its balance. Every balance change goes through here, so changes of one user never
     * overlap.
     */
    public int lockWallet(UUID userId, OffsetDateTime now) {
        jdbc.sql(
                        "insert into coin_wallets (user_id, balance, updated_at)"
                                + " values (:u, 0, :now) on conflict do nothing")
                .param("u", userId)
                .param("now", now)
                .update();
        return jdbc.sql("select balance from coin_wallets where user_id = :u for update")
                .param("u", userId)
                .query(Integer.class)
                .single();
    }

    public void setBalance(UUID userId, int balance, OffsetDateTime now) {
        jdbc.sql("update coin_wallets set balance = :b, updated_at = :now where user_id = :u")
                .param("u", userId)
                .param("b", balance)
                .param("now", now)
                .update();
    }

    // ---------- ledger ----------

    public void appendLedger(
            UUID userId,
            int amount,
            int balanceAfter,
            LedgerReason reason,
            @Nullable UUID orderId,
            @Nullable UUID unlockId,
            @Nullable String note,
            OffsetDateTime now) {
        jdbc.sql(
                        "insert into coin_ledger (user_id, amount, balance_after, reason, order_id,"
                                + " unlock_id, note, created_at)"
                                + " values (:u, :amount, :after, :reason, :order, :unlock, :note, :now)")
                .param("u", userId)
                .param("amount", amount)
                .param("after", balanceAfter)
                .param("reason", reason.name())
                .param("order", orderId, Types.OTHER)
                .param("unlock", unlockId, Types.OTHER)
                .param("note", note, Types.VARCHAR)
                .param("now", now)
                .update();
    }

    /**
     * The user's ledger, newest first; pass the last id of the previous page as {@code beforeId}.
     */
    public List<LedgerRow> ledger(UUID userId, @Nullable Long beforeId, int limit) {
        String sql =
                "select l.id, l.amount, l.balance_after, l.reason, l.note, l.created_at,"
                        + " o.order_number, s.slug, s.title, e.number"
                        + " from coin_ledger l"
                        + " left join payment_orders o on o.id = l.order_id"
                        + " left join unlocks u on u.id = l.unlock_id"
                        + " left join episodes e on e.id = u.episode_id"
                        + " left join series s on s.id = e.series_id"
                        + " where l.user_id = :u"
                        + (beforeId == null ? "" : " and l.id < :before")
                        + " order by l.id desc limit :limit";
        JdbcClient.StatementSpec spec = jdbc.sql(sql).param("u", userId).param("limit", limit);
        if (beforeId != null) {
            spec = spec.param("before", beforeId);
        }
        return spec.query((rs, n) ->
                        new LedgerRow(
                                rs.getLong("id"),
                                rs.getInt("amount"),
                                rs.getInt("balance_after"),
                                LedgerReason.valueOf(rs.getString("reason")),
                                rs.getString("note"),
                                rs.getObject("created_at", OffsetDateTime.class),
                                rs.getString("order_number"),
                                rs.getString("slug"),
                                rs.getString("title"),
                                rs.getObject("number", Integer.class)))
                .list();
    }

    // ---------- unlocks ----------

    public boolean hasUnlock(UUID userId, UUID episodeId) {
        return jdbc.sql(
                        "select exists(select 1 from unlocks where user_id = :u"
                                + " and episode_id = :e)")
                .param("u", userId)
                .param("e", episodeId)
                .query(Boolean.class)
                .single();
    }

    public UUID insertUnlock(UUID userId, UUID episodeId, int coins, OffsetDateTime now) {
        return jdbc.sql(
                        "insert into unlocks (user_id, episode_id, coins, created_at)"
                                + " values (:u, :e, :coins, :now) returning id")
                .param("u", userId)
                .param("e", episodeId)
                .param("coins", coins)
                .param("now", now)
                .query(UUID.class)
                .single();
    }

    /** What the creator earned from an unlock (A7: payouts come later). */
    public void insertEarning(
            UUID creatorId, UUID unlockId, UUID episodeId, int coins, OffsetDateTime now) {
        jdbc.sql(
                        "insert into creator_earnings (creator_id, unlock_id, episode_id, coins,"
                                + " created_at) values (:c, :unlock, :e, :coins, :now)")
                .param("c", creatorId)
                .param("unlock", unlockId)
                .param("e", episodeId)
                .param("coins", coins)
                .param("now", now)
                .update();
    }
}
