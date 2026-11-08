package app.phumreader.payment.repository;

import app.phumreader.payment.domain.OrderStatus;
import app.phumreader.payment.domain.PackTag;
import app.phumreader.payment.domain.PaymentMethod;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Coin packs and payment orders (plain SQL). */
@Repository
public class PaymentQueries {

    /** A coin pack; prices stay null until they are set (A2). */
    public record PackRow(
            int id,
            int coins,
            int bonusCoins,
            @Nullable PackTag tag,
            @Nullable Integer priceUsdCents,
            @Nullable Integer priceKhr) {}

    public record OrderRow(
            UUID id,
            String orderNumber,
            UUID userId,
            int packId,
            int coins,
            int bonusCoins,
            int firstBonusCoins,
            PaymentMethod method,
            OrderStatus status,
            @Nullable Integer priceUsdCents,
            @Nullable Integer priceKhr,
            String provider,
            OffsetDateTime createdAt,
            OffsetDateTime expiresAt,
            @Nullable OffsetDateTime paidAt) {}

    /** Where the previous page of orders ended. */
    public record Key(OffsetDateTime createdAt, UUID id) {}

    private static final String ORDER_COLUMNS =
            "id, order_number, user_id, pack_id, coins, bonus_coins, first_bonus_coins, method,"
                    + " status, price_usd_cents, price_khr, provider, created_at, expires_at,"
                    + " paid_at";

    private final JdbcClient jdbc;

    public PaymentQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- packs ----------

    public List<PackRow> activePacks() {
        return jdbc.sql(
                        "select id, coins, bonus_coins, tag, price_usd_cents, price_khr"
                                + " from coin_packs where active order by position")
                .query((rs, n) -> pack(rs))
                .list();
    }

    public Optional<PackRow> activePack(int id) {
        return jdbc.sql(
                        "select id, coins, bonus_coins, tag, price_usd_cents, price_khr"
                                + " from coin_packs where active and id = :id")
                .param("id", id)
                .query((rs, n) -> pack(rs))
                .optional();
    }

    // ---------- orders ----------

    /** Creates a PENDING order; empty when the order number is already taken (pick another). */
    public Optional<OrderRow> insertOrder(
            String orderNumber,
            UUID userId,
            PackRow pack,
            int firstBonusCoins,
            PaymentMethod method,
            String provider,
            OffsetDateTime now,
            OffsetDateTime expiresAt) {
        return jdbc.sql(
                        "insert into payment_orders (order_number, user_id, pack_id, coins,"
                                + " bonus_coins, first_bonus_coins, method, status,"
                                + " price_usd_cents, price_khr, provider, expires_at, created_at,"
                                + " updated_at) values (:number, :u, :pack, :coins, :bonus, :first,"
                                + " :method, 'PENDING', :usd, :khr, :provider, :expires, :now, :now)"
                                + " on conflict (order_number) do nothing returning "
                                + ORDER_COLUMNS)
                .param("number", orderNumber)
                .param("u", userId)
                .param("pack", pack.id())
                .param("coins", pack.coins())
                .param("bonus", pack.bonusCoins())
                .param("first", firstBonusCoins)
                .param("method", method.name())
                .param("usd", pack.priceUsdCents(), Types.INTEGER)
                .param("khr", pack.priceKhr(), Types.INTEGER)
                .param("provider", provider)
                .param("expires", expiresAt)
                .param("now", now)
                .query((rs, n) -> order(rs))
                .optional();
    }

    public Optional<OrderRow> byNumber(String orderNumber) {
        return jdbc.sql("select " + ORDER_COLUMNS + " from payment_orders where order_number = :n")
                .param("n", orderNumber)
                .query((rs, n) -> order(rs))
                .optional();
    }

    public Optional<UUID> ownerOf(UUID orderId) {
        return jdbc.sql("select user_id from payment_orders where id = :id")
                .param("id", orderId)
                .query(UUID.class)
                .optional();
    }

    /** The order, locked until the transaction ends. */
    public OrderRow lock(UUID orderId) {
        return jdbc.sql(
                        "select "
                                + ORDER_COLUMNS
                                + " from payment_orders where id = :id for update")
                .param("id", orderId)
                .query((rs, n) -> order(rs))
                .single();
    }

    public void setStatus(UUID orderId, OrderStatus status, OffsetDateTime now) {
        jdbc.sql("update payment_orders set status = :s, updated_at = :now where id = :id")
                .param("id", orderId)
                .param("s", status.name())
                .param("now", now)
                .update();
    }

    public void markPaid(
            UUID orderId, int firstBonusCoins, String providerRef, OffsetDateTime now) {
        jdbc.sql(
                        "update payment_orders set status = 'PAID', first_bonus_coins = :first,"
                                + " provider_ref = :ref, paid_at = :now, updated_at = :now"
                                + " where id = :id")
                .param("id", orderId)
                .param("first", firstBonusCoins)
                .param("ref", providerRef)
                .param("now", now)
                .update();
    }

    public void markRefunded(UUID orderId, OffsetDateTime now) {
        jdbc.sql(
                        "update payment_orders set status = 'REFUNDED', refunded_at = :now,"
                                + " updated_at = :now where id = :id")
                .param("id", orderId)
                .param("now", now)
                .update();
    }

    /** Whether the user has a paid order other than {@code exceptOrderId}. */
    public boolean hasPaidOrder(UUID userId, @Nullable UUID exceptOrderId) {
        return jdbc.sql(
                        "select exists(select 1 from payment_orders where user_id = :u"
                                + " and status in ('PAID', 'REFUNDED') and id is distinct from :except)")
                .param("u", userId)
                .param("except", exceptOrderId, Types.OTHER)
                .query(Boolean.class)
                .single();
    }

    /** The user's orders, newest first. */
    public List<OrderRow> orders(UUID userId, @Nullable Key after, int limit) {
        String sql =
                "select "
                        + ORDER_COLUMNS
                        + " from payment_orders where user_id = :u"
                        + (after == null ? "" : " and (created_at, id) < (:t, :id)")
                        + " order by created_at desc, id desc limit :limit";
        JdbcClient.StatementSpec spec = jdbc.sql(sql).param("u", userId).param("limit", limit);
        if (after != null) {
            spec = spec.param("t", after.createdAt()).param("id", after.id());
        }
        return spec.query((rs, n) -> order(rs)).list();
    }

    // ---------- mapping ----------

    private static PackRow pack(ResultSet rs) throws SQLException {
        String tag = rs.getString("tag");
        return new PackRow(
                rs.getInt("id"),
                rs.getInt("coins"),
                rs.getInt("bonus_coins"),
                tag == null ? null : PackTag.valueOf(tag),
                rs.getObject("price_usd_cents", Integer.class),
                rs.getObject("price_khr", Integer.class));
    }

    private static OrderRow order(ResultSet rs) throws SQLException {
        return new OrderRow(
                rs.getObject("id", UUID.class),
                rs.getString("order_number"),
                rs.getObject("user_id", UUID.class),
                rs.getInt("pack_id"),
                rs.getInt("coins"),
                rs.getInt("bonus_coins"),
                rs.getInt("first_bonus_coins"),
                PaymentMethod.valueOf(rs.getString("method")),
                OrderStatus.valueOf(rs.getString("status")),
                rs.getObject("price_usd_cents", Integer.class),
                rs.getObject("price_khr", Integer.class),
                rs.getString("provider"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("expires_at", OffsetDateTime.class),
                rs.getObject("paid_at", OffsetDateTime.class));
    }
}
