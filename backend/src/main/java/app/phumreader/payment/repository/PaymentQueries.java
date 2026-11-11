package app.phumreader.payment.repository;

import app.phumreader.payment.domain.OrderStatus;
import app.phumreader.payment.domain.PackTag;
import app.phumreader.payment.domain.PaymentMethod;
import java.math.BigDecimal;
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

    // ---------- refund requests (V21-06) ----------

    /** A reader's request for a refund of one order. */
    public record RefundRequestRow(
            UUID id,
            UUID orderId,
            UUID userId,
            String reason,
            String status,
            OffsetDateTime requestedAt,
            @Nullable String decisionNote,
            @Nullable Integer refundedCoins) {}

    private static final String REFUND_REQUEST =
            "select id, order_id, user_id, reason, status, requested_at, decision_note,"
                    + " refunded_coins from refund_requests";

    /** Files the request; {@code false} when this order already has one. */
    public boolean insertRefundRequest(
            UUID orderId, UUID userId, String reason, OffsetDateTime now) {
        return jdbc.sql(
                                "insert into refund_requests (order_id, user_id, reason, requested_at)"
                                        + " values (:o, :u, :r, :now) on conflict (order_id) do nothing")
                        .param("o", orderId)
                        .param("u", userId)
                        .param("r", reason)
                        .param("now", now)
                        .update()
                == 1;
    }

    public Optional<RefundRequestRow> refundRequestOf(UUID orderId) {
        return jdbc.sql(REFUND_REQUEST + " where order_id = :o")
                .param("o", orderId)
                .query((rs, n) -> refundRequest(rs))
                .optional();
    }

    public Optional<RefundRequestRow> lockRefundRequest(UUID id) {
        return jdbc.sql(REFUND_REQUEST + " where id = :id for update")
                .param("id", id)
                .query((rs, n) -> refundRequest(rs))
                .optional();
    }

    public void decideRefundRequest(
            UUID id,
            String status,
            UUID admin,
            @Nullable String note,
            @Nullable Integer coins,
            OffsetDateTime now) {
        jdbc.sql(
                        "update refund_requests set status = :s, decided_by = :a, decided_at = :now,"
                                + " decision_note = :note, refunded_coins = :coins where id = :id")
                .param("s", status)
                .param("a", admin)
                .param("now", now)
                .param("note", note, Types.VARCHAR)
                .param("coins", coins, Types.INTEGER)
                .param("id", id)
                .update();
    }

    private static RefundRequestRow refundRequest(ResultSet rs) throws SQLException {
        return new RefundRequestRow(
                rs.getObject("id", UUID.class),
                rs.getObject("order_id", UUID.class),
                rs.getObject("user_id", UUID.class),
                rs.getString("reason"),
                rs.getString("status"),
                rs.getObject("requested_at", OffsetDateTime.class),
                rs.getString("decision_note"),
                rs.getObject("refunded_coins", Integer.class));
    }

    // ---------- stuck payments (V21-06) ----------

    /** PayWay said an order was paid, but the coins were not credited. */
    public void recordStuck(
            UUID orderId,
            @Nullable BigDecimal paidAmount,
            @Nullable String currency,
            OffsetDateTime now) {
        jdbc.sql(
                        "insert into payment_stuck (order_id, kind, paid_amount, currency, found_at)"
                                + " values (:o, 'AMOUNT_MISMATCH', :amount, :cur, :now)"
                                + " on conflict (order_id) do nothing")
                .param("o", orderId)
                .param("amount", paidAmount, Types.NUMERIC)
                .param("cur", currency, Types.VARCHAR)
                .param("now", now)
                .update();
    }

    /**
     * An open stuck payment, locked until the transaction ends: the order and whether it was
     * resolved.
     */
    public record StuckRow(UUID id, UUID orderId, @Nullable OffsetDateTime resolvedAt) {}

    public Optional<StuckRow> lockStuck(UUID id) {
        return jdbc.sql(
                        "select id, order_id, resolved_at from payment_stuck where id = :id for update")
                .param("id", id)
                .query((rs, n) ->
                        new StuckRow(
                                rs.getObject("id", UUID.class),
                                rs.getObject("order_id", UUID.class),
                                rs.getObject("resolved_at", OffsetDateTime.class)))
                .optional();
    }

    public void resolveStuck(UUID id, UUID admin, @Nullable String note, OffsetDateTime now) {
        jdbc.sql(
                        "update payment_stuck set resolved_at = :now, resolved_by = :a, note = :note"
                                + " where id = :id")
                .param("now", now)
                .param("a", admin)
                .param("note", note, Types.VARCHAR)
                .param("id", id)
                .update();
    }

    /**
     * Another paid order of the same reader and pack within an hour of this one (a double charge).
     */
    public boolean looksLikeDoubleCharge(UUID orderId) {
        return jdbc.sql(
                        "select exists (select 1 from payment_orders o join payment_orders p"
                                + " on p.user_id = o.user_id and p.pack_id = o.pack_id and p.id <> o.id"
                                + " and p.status in ('PAID', 'REFUNDED')"
                                + " and abs(extract(epoch from p.paid_at - o.paid_at)) <= 3600"
                                + " where o.id = :o)")
                .param("o", orderId)
                .query(Boolean.class)
                .single();
    }

    public void markRefunded(UUID orderId, OffsetDateTime now) {
        jdbc.sql(
                        "update payment_orders set status = 'REFUNDED', refunded_at = :now,"
                                + " updated_at = :now where id = :id")
                .param("id", orderId)
                .param("now", now)
                .update();
    }

    /**
     * PayWay orders still unpaid (open, expired or failed) created since {@code since}, oldest
     * first: the ones reconciliation asks PayWay about.
     */
    public List<OrderRow> unpaidPayWayOrders(OffsetDateTime since, int limit) {
        return jdbc.sql(
                        "select "
                                + ORDER_COLUMNS
                                + " from payment_orders where provider = 'PAYWAY'"
                                + " and status in ('PENDING', 'EXPIRED', 'FAILED', 'CANCELLED')"
                                + " and created_at >= :since order by created_at limit :limit")
                .param("since", since)
                .param("limit", limit)
                .query((rs, n) -> order(rs))
                .list();
    }

    /** PayWay orders still PENDING whose time ran out. */
    public List<OrderRow> expiredPayWayOrders(OffsetDateTime now, int limit) {
        return jdbc.sql(
                        "select "
                                + ORDER_COLUMNS
                                + " from payment_orders where provider = 'PAYWAY'"
                                + " and status = 'PENDING' and expires_at <= :now"
                                + " order by expires_at limit :limit")
                .param("now", now)
                .param("limit", limit)
                .query((rs, n) -> order(rs))
                .list();
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
