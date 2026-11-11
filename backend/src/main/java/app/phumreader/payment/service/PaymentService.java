package app.phumreader.payment.service;

import app.phumreader.coin.domain.LedgerReason;
import app.phumreader.coin.service.CoinService;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.idempotency.IdempotencyKeys;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.config.AppProperties;
import app.phumreader.notification.service.NotificationInbox;
import app.phumreader.payment.domain.OrderStatus;
import app.phumreader.payment.domain.PaymentMethod;
import app.phumreader.payment.repository.PaymentQueries;
import app.phumreader.payment.repository.PaymentQueries.Key;
import app.phumreader.payment.repository.PaymentQueries.OrderRow;
import app.phumreader.payment.repository.PaymentQueries.PackRow;
import app.phumreader.payment.service.PaymentViews.CoinPack;
import app.phumreader.payment.service.PaymentViews.CoinShop;
import app.phumreader.payment.service.PaymentViews.CreatedOrder;
import app.phumreader.payment.service.PaymentViews.OrderView;
import app.phumreader.payment.service.PaymentViews.RefundRequestView;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coin packs and orders (plan P3-11). An order is PENDING for {@code
 * phumreader.payments.order-ttl}, then PAID, FAILED, CANCELLED or EXPIRED. Paying credits the
 * pack's coins, its bonus and (on the account's first paid order) the first-purchase bonus exactly
 * once, however often the confirmation arrives. Paying and refunding put an item in the buyer's
 * notifications inbox (V21-03) in the same transaction.
 *
 * <p>Until ABA PayWay keys exist, development pays orders with the simulator ({@code
 * phumreader.payments.simulator}); production refuses to start with it on.
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    static final String ORDER_SCOPE = "order";
    static final String SIMULATOR = "DEV_SIMULATOR";
    static final String PAYWAY = "PAYWAY";
    static final int ORDERS_PER_HOUR = 20;

    private final PaymentQueries queries;
    private final CoinService coins;
    private final IdempotencyKeys idempotency;
    private final RateLimiter limiter;
    private final NotificationInbox inbox;
    private final Clock clock;
    private final boolean simulator;
    private final @Nullable PayWayGateway payWay;
    private final Duration orderTtl;
    private final SecureRandom random = new SecureRandom();

    public PaymentService(
            PaymentQueries queries,
            CoinService coins,
            IdempotencyKeys idempotency,
            RateLimiter limiter,
            NotificationInbox inbox,
            Clock clock,
            AppProperties properties,
            Environment environment,
            ObjectProvider<PayWayGateway> payWayProvider) {
        this.queries = queries;
        this.coins = coins;
        this.idempotency = idempotency;
        this.limiter = limiter;
        this.inbox = inbox;
        this.clock = clock;
        this.simulator = properties.payments().simulator();
        this.orderTtl = properties.payments().orderTtl();
        this.payWay = payWayProvider.getIfAvailable();
        if (!simulator && payWay == null && environment.acceptsProfiles(Profiles.of("prod"))) {
            throw new IllegalStateException(
                    "Set phumreader.payments.payway (merchant-id, api-key, callback-url): production"
                            + " needs ABA PayWay.");
        }
        if (simulator) {
            if (environment.acceptsProfiles(Profiles.of("prod"))) {
                throw new IllegalStateException(
                        "phumreader.payments.simulator must not be on in production");
            }
            log.warn(
                    "Coin orders are paid with the dev simulator (phumreader.payments.simulator).");
        }
    }

    /** Outcome of a simulated payment. */
    public enum Outcome {
        @JsonProperty("paid")
        PAID,
        @JsonProperty("failed")
        FAILED
    }

    // ---------- shop ----------

    public CoinShop shop() {
        List<CoinPack> packs =
                queries.activePacks().stream()
                        .map(p ->
                                new CoinPack(
                                        p.id(),
                                        p.coins(),
                                        p.bonusCoins(),
                                        p.tag(),
                                        p.priceUsdCents(),
                                        p.priceKhr()))
                        .toList();
        return new CoinShop(
                packs, List.of(PaymentMethod.values()), (int) orderTtl.toMinutes(), simulator);
    }

    /** The first-purchase bonus is on offer until the account's first paid order. */
    public boolean firstPurchaseBonusAvailable(UUID userId) {
        return !queries.hasPaidOrder(userId, null);
    }

    // ---------- orders ----------

    /**
     * Creates a PENDING order for a pack. A retry with the same {@code Idempotency-Key} returns the
     * same order.
     */
    @Transactional
    public OrderView createOrder(CurrentUser user, int packId, PaymentMethod method, String key) {
        coins.lockWallet(user.id());
        String request = "order|" + packId + "|" + method;
        Optional<CreatedOrder> repeated =
                idempotency.find(user.id(), ORDER_SCOPE, key, request, CreatedOrder.class);
        if (repeated.isPresent()) {
            return view(ownOrder(user, repeated.get().orderNumber()));
        }
        PackRow pack =
                queries.activePack(packId)
                        .orElseThrow(() ->
                                ApiException.invalidField(
                                        "packId", "unknown_pack", "There is no such coin pack."));
        if (!simulator && payWay == null) {
            // ABA PayWay is wired up with its merchant keys (A4).
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "payments_unavailable",
                    "Payments are not available yet.");
        }
        Money price = simulator ? null : price(pack);
        limiter.acquire(
                "orders:" + user.id(), ORDERS_PER_HOUR, Duration.ofHours(1), "too_many_orders");
        int firstBonus = queries.hasPaidOrder(user.id(), null) ? 0 : pack.coins();
        OffsetDateTime now = now();
        OrderRow order = null;
        while (order == null) {
            order =
                    queries.insertOrder(
                                    orderNumber(),
                                    user.id(),
                                    pack,
                                    firstBonus,
                                    method,
                                    simulator ? SIMULATOR : PAYWAY,
                                    now,
                                    now.plus(orderTtl))
                            .orElse(null);
        }
        PayWayGateway.Checkout checkout = null;
        if (price != null) {
            // If PayWay refuses, the exception rolls the new order back.
            checkout =
                    payWay.start(
                            order.orderNumber(),
                            price.amount(),
                            price.currency(),
                            method,
                            (int) orderTtl.toMinutes());
        }
        idempotency.save(
                user.id(), ORDER_SCOPE, key, request, new CreatedOrder(order.orderNumber()));
        return view(order, checkout);
    }

    /** One of the reader's orders (the website polls it while the reader pays). */
    @Transactional
    public OrderView order(CurrentUser user, String orderNumber) {
        OrderRow order = ownOrder(user, orderNumber);
        if (payWay != null
                && PAYWAY.equals(order.provider())
                && order.status() == OrderStatus.PENDING
                && effectiveStatus(order) == OrderStatus.PENDING) {
            // The website polls this while the reader pays: ask PayWay too, so the payment shows
            // up even when its callback cannot reach us (local development) or got lost.
            try {
                settleFromPayWay(order.orderNumber(), false);
                order = ownOrder(user, orderNumber);
            } catch (RuntimeException e) {
                log.warn("Could not ask PayWay about {}: {}", order.orderNumber(), e.toString());
            }
        }
        return view(order);
    }

    /** Cancels an open order (the reader closed the payment). Cancelling twice changes nothing. */
    @Transactional
    public OrderView cancel(CurrentUser user, String orderNumber) {
        OrderRow order = queries.lock(ownOrder(user, orderNumber).id());
        OrderStatus status = effectiveStatus(order);
        if (status == OrderStatus.PENDING) {
            queries.setStatus(order.id(), OrderStatus.CANCELLED, now());
        } else if (status != OrderStatus.CANCELLED) {
            closeIfExpired(order, status);
            throw notPending(status);
        }
        return view(queries.lock(order.id()));
    }

    /**
     * Dev simulator: pays (or fails) the reader's order as ABA PayWay would. 404 when the simulator
     * is off.
     */
    @Transactional
    public OrderView simulate(CurrentUser user, String orderNumber, Outcome outcome) {
        if (!simulator) {
            throw ApiException.notFound("not_found", "Nothing was found at this address.");
        }
        OrderRow order = ownOrder(user, orderNumber);
        if (outcome == Outcome.PAID) {
            return confirmPaid(order.id(), "SIM-" + UUID.randomUUID());
        }
        OrderRow locked = queries.lock(order.id());
        OrderStatus status = effectiveStatus(locked);
        if (status == OrderStatus.PENDING) {
            queries.setStatus(locked.id(), OrderStatus.FAILED, now());
        } else if (status != OrderStatus.FAILED) {
            closeIfExpired(locked, status);
            throw notPending(status);
        }
        return view(queries.lock(locked.id()));
    }

    /**
     * The payment provider confirmed the payment: credits the coins once. A second confirmation of
     * a paid order changes nothing; a confirmation after the order closed is refused.
     */
    @Transactional
    public OrderView confirmPaid(UUID orderId, String providerRef) {
        return confirmPaid(orderId, providerRef, false);
    }

    /**
     * @param providerTookMoney PayWay itself says the payment was approved: credit the coins even
     *     if the order expired, failed or was cancelled meanwhile (the reader paid), unless it was
     *     already paid or refunded
     */
    private OrderView confirmPaid(UUID orderId, String providerRef, boolean providerTookMoney) {
        UUID userId =
                queries.ownerOf(orderId)
                        .orElseThrow(
                                () -> ApiException.notFound("order_not_found", "Order not found."));
        // Same lock order as unlocks and new orders: the wallet first, then the order.
        int balance = coins.lockWallet(userId);
        OrderRow order = queries.lock(orderId);
        OrderStatus status = effectiveStatus(order);
        if (status == OrderStatus.PAID || (providerTookMoney && status == OrderStatus.REFUNDED)) {
            return view(order);
        }
        if (status != OrderStatus.PENDING && !providerTookMoney) {
            closeIfExpired(order, status);
            throw notPending(status);
        }
        int firstBonus = queries.hasPaidOrder(userId, orderId) ? 0 : order.coins();
        balance =
                coins.credit(
                        userId,
                        balance,
                        order.coins(),
                        LedgerReason.PURCHASE,
                        orderId,
                        order.coins() + " coin pack");
        balance =
                coins.credit(
                        userId,
                        balance,
                        order.bonusCoins(),
                        LedgerReason.BONUS,
                        orderId,
                        "Pack bonus");
        coins.credit(
                userId, balance, firstBonus, LedgerReason.BONUS, orderId, "First purchase bonus");
        queries.markPaid(orderId, firstBonus, providerRef, now());
        inbox.orderPaid(
                userId,
                orderId,
                order.orderNumber(),
                order.coins() + order.bonusCoins() + firstBonus);
        return view(queries.lock(orderId));
    }

    /**
     * An admin refunds a paid order (plan P3-18): every coin the order credited (pack, bonus and
     * first-purchase bonus) leaves the wallet through one REFUND ledger row. Refused when the
     * reader already spent some of them. Giving the money back is done in the payment provider's
     * dashboard.
     *
     * @return the order number and the coins taken back
     */
    @Transactional
    public Refund refund(UUID orderId, String reason) {
        return refund(orderId, reason, false);
    }

    /**
     * @param partial refund only the coins still in the wallet when the reader spent some (a refund
     *     request an admin approved); still refused when none are left
     */
    private Refund refund(UUID orderId, String reason, boolean partial) {
        UUID userId =
                queries.ownerOf(orderId)
                        .orElseThrow(
                                () -> ApiException.notFound("order_not_found", "Order not found."));
        int balance = coins.lockWallet(userId);
        OrderRow order = queries.lock(orderId);
        if (order.status() != OrderStatus.PAID) {
            throw ApiException.conflict(
                    "order_not_refundable",
                    order.status() == OrderStatus.REFUNDED
                            ? "This order was already refunded."
                            : "Only a paid order can be refunded.");
        }
        int total = order.coins() + order.bonusCoins() + order.firstBonusCoins();
        if (partial && balance > 0 && balance < total) {
            total = balance;
        }
        if (balance < total || balance == 0) {
            throw ApiException.conflict(
                    "coins_spent",
                    "The reader already spent "
                            + (total - balance)
                            + " of these "
                            + total
                            + " coins, so the order cannot be refunded.");
        }
        coins.debit(
                userId,
                balance,
                total,
                LedgerReason.REFUND,
                orderId,
                "Refund " + order.orderNumber() + ": " + reason);
        queries.markRefunded(orderId, now());
        inbox.orderRefunded(userId, orderId, order.orderNumber(), total);
        return new Refund(order.orderNumber(), userId, total);
    }

    // ---------- refund requests and stuck payments (V21-06) ----------

    public static final int MIN_REASON = 10;
    public static final int MAX_REASON = 500;

    /**
     * The reader asks for a refund of their paid order. 409 {@code not_paid} (only a paid order),
     * {@code refund_requested} (one request per order); 400 {@code reason} (10-500 characters).
     */
    @Transactional
    public OrderView requestRefund(CurrentUser user, String orderNumber, String reason) {
        String text = reason == null ? "" : reason.strip();
        if (text.length() < MIN_REASON || text.length() > MAX_REASON) {
            throw ApiException.invalidField(
                    "reason",
                    text.length() < MIN_REASON ? "too_short" : "too_long",
                    "Tell us why, in " + MIN_REASON + " to " + MAX_REASON + " characters.");
        }
        OrderRow order = queries.lock(ownOrder(user, orderNumber).id());
        if (order.status() != OrderStatus.PAID) {
            throw ApiException.conflict(
                    "not_paid",
                    order.status() == OrderStatus.REFUNDED
                            ? "This order was already refunded."
                            : "Only a paid order can be refunded.");
        }
        if (!queries.insertRefundRequest(order.id(), user.id(), text, now())) {
            throw ApiException.conflict(
                    "refund_requested", "You already asked for a refund of this order.");
        }
        return view(order);
    }

    /** What an approved refund request took back. */
    public record RefundDecision(Refund refund, UUID orderId) {}

    /**
     * An admin approves a refund request: the coins still in the wallet (up to the order's coins)
     * leave through one REFUND ledger row and the order is refunded. 409 {@code request_decided},
     * {@code coins_spent} (none left).
     */
    @Transactional
    public RefundDecision approveRefundRequest(
            UUID requestId, UUID adminId, @Nullable String note) {
        var request = lockRequest(requestId);
        Refund refund = refund(request.orderId(), "Refund request approved", true);
        queries.decideRefundRequest(
                requestId, "APPROVED", adminId, blankToNull(note), refund.coins(), now());
        return new RefundDecision(refund, request.orderId());
    }

    /** An admin declines a refund request; the reason is shown to the reader on the receipt. */
    @Transactional
    public UUID declineRefundRequest(UUID requestId, UUID adminId, String reason) {
        String text = reason == null ? "" : reason.strip();
        if (text.isEmpty()) {
            throw ApiException.invalidField("reason", "required", "Write a reason for the reader.");
        }
        var request = lockRequest(requestId);
        queries.decideRefundRequest(requestId, "DECLINED", adminId, text, null, now());
        return request.orderId();
    }

    private PaymentQueries.RefundRequestRow lockRequest(UUID requestId) {
        var request =
                queries.lockRefundRequest(requestId)
                        .orElseThrow(() ->
                                ApiException.notFound(
                                        "refund_request_not_found", "No such request."));
        if (!request.status().equals("OPEN")) {
            throw ApiException.conflict(
                    "request_decided", "This request was already decided by another admin.");
        }
        return request;
    }

    /**
     * An admin adds the coins of an order PayWay says was paid but reconciliation did not credit
     * (the amount differed). Credits once; 409 {@code stuck_resolved}.
     *
     * @return the order number and the coins credited
     */
    @Transactional
    public Refund addStuckCoins(UUID stuckId, UUID adminId, @Nullable String note) {
        var stuck =
                queries.lockStuck(stuckId)
                        .orElseThrow(() ->
                                ApiException.notFound(
                                        "stuck_payment_not_found", "No such payment."));
        if (stuck.resolvedAt() != null) {
            throw ApiException.conflict(
                    "stuck_resolved", "The coins were already added by another admin.");
        }
        OrderView paid = confirmPaid(stuck.orderId(), "ADMIN-" + stuckId, true);
        queries.resolveStuck(stuckId, adminId, blankToNull(note), now());
        UUID userId = queries.ownerOf(stuck.orderId()).orElseThrow();
        return new Refund(paid.orderNumber(), userId, paid.totalCoins());
    }

    private static @Nullable String blankToNull(@Nullable String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }

    /** What a refund took back. */
    public record Refund(String orderNumber, UUID userId, int coins) {}

    /** The reader's orders, newest first (purchase history). */
    public CursorPage<OrderView> orders(
            CurrentUser user, @Nullable String cursor, @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<OrderRow> rows = queries.orders(user.id(), readKey(cursor), size + 1);
        List<OrderRow> page = rows.size() > size ? rows.subList(0, size) : rows;
        String next =
                rows.size() > size
                        ? Cursors.encode(
                                "o|"
                                        + page.getLast().createdAt().toInstant()
                                        + "|"
                                        + page.getLast().id())
                        : null;
        return new CursorPage<>(page.stream().map(this::view).toList(), next);
    }

    // ---------- ABA PayWay ----------

    /** What a PayWay callback or reconciliation did to an order. */
    public enum Settlement {
        PAID,
        STILL_OPEN,
        CLOSED,
        UNKNOWN_ORDER
    }

    /**
     * PayWay says something happened to {@code tranId}. The callback is only a nudge: this asks
     * PayWay for the payment's real state and credits the coins once if it was approved for the
     * order's price (a repeated callback changes nothing).
     *
     * @param closeExpired also store the order as EXPIRED when PayWay still shows it unpaid and its
     *     time is up
     */
    @Transactional
    public Settlement settleFromPayWay(String tranId, boolean closeExpired) {
        PayWayGateway gateway = payWay;
        if (gateway == null) {
            return Settlement.UNKNOWN_ORDER;
        }
        OrderRow found = queries.byNumber(tranId.toUpperCase(Locale.ROOT)).orElse(null);
        if (found == null || !PAYWAY.equals(found.provider())) {
            return Settlement.UNKNOWN_ORDER;
        }
        PayWayGateway.Check check = gateway.check(found.orderNumber());
        switch (check.status()) {
            case APPROVED -> {
                Money price = price(found);
                if (check.paidAmount() == null
                        || check.paidAmount().compareTo(new BigDecimal(price.amount())) != 0
                        || (check.currency() != null
                                && !check.currency().equalsIgnoreCase(price.currency()))) {
                    log.error(
                            "PayWay approved {} for {} {}, expected {} {}: not crediting",
                            found.orderNumber(),
                            check.paidAmount(),
                            check.currency(),
                            price.amount(),
                            price.currency());
                    // Paid at PayWay, no coins here: it shows in Admin > Payments > Paid but no
                    // coins.
                    queries.recordStuck(found.id(), check.paidAmount(), check.currency(), now());
                    return Settlement.CLOSED;
                }
                confirmPaid(found.id(), found.orderNumber(), true);
                return Settlement.PAID;
            }
            case PENDING, NOT_FOUND -> {
                // PayWay does not know an order until the reader tries to pay: "not found" is
                // still open, never a reason to close it.
                if (closeExpired) {
                    OrderRow order = queries.lock(found.id());
                    closeIfExpired(order, effectiveStatus(order));
                }
                return Settlement.STILL_OPEN;
            }
            case DECLINED, CANCELLED, REFUNDED -> {
                OrderRow order = queries.lock(found.id());
                OrderStatus status = effectiveStatus(order);
                if (status == OrderStatus.PENDING) {
                    boolean declined = check.status() == PayWayGateway.Status.DECLINED;
                    queries.setStatus(
                            order.id(),
                            declined ? OrderStatus.FAILED : OrderStatus.CANCELLED,
                            now());
                } else {
                    closeIfExpired(order, status);
                }
                return Settlement.CLOSED;
            }
        }
        return Settlement.CLOSED;
    }

    /** PayWay orders whose time ran out but that are still stored as open. */
    public List<String> expiredOrderNumbers() {
        return queries.expiredPayWayOrders(now(), 200).stream().map(OrderRow::orderNumber).toList();
    }

    /** Unpaid PayWay orders of the last 7 days (PayWay's status check reaches back that far). */
    public List<String> unpaidOrderNumbers() {
        return queries.unpaidPayWayOrders(now().minusDays(7), 1000).stream()
                .map(OrderRow::orderNumber)
                .toList();
    }

    private record Money(String amount, String currency) {}

    /** The price PayWay is asked for: dollars when the pack has a dollar price, else riel. */
    private static Money price(PackRow pack) {
        return price(pack.priceUsdCents(), pack.priceKhr());
    }

    private static Money price(OrderRow order) {
        return price(order.priceUsdCents(), order.priceKhr());
    }

    private static Money price(@Nullable Integer usdCents, @Nullable Integer khr) {
        if (usdCents != null) {
            return new Money(BigDecimal.valueOf(usdCents, 2).setScale(2).toPlainString(), "USD");
        }
        if (khr != null) {
            return new Money(String.valueOf(khr), "KHR");
        }
        throw new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE, "price_not_set", "This pack has no price yet.");
    }

    // ---------- helpers ----------

    private OrderRow ownOrder(CurrentUser user, String orderNumber) {
        return queries.byNumber(orderNumber.toUpperCase(Locale.ROOT))
                .filter(o -> o.userId().equals(user.id()))
                .orElseThrow(() -> ApiException.notFound("order_not_found", "Order not found."));
    }

    /**
     * An unpaid order whose time ran out counts as expired (stored as such when it is next
     * changed).
     */
    private OrderStatus effectiveStatus(OrderRow order) {
        if (order.status() == OrderStatus.PENDING
                && !clock.instant().isBefore(order.expiresAt().toInstant())) {
            return OrderStatus.EXPIRED;
        }
        return order.status();
    }

    private void closeIfExpired(OrderRow order, OrderStatus status) {
        if (status == OrderStatus.EXPIRED && order.status() == OrderStatus.PENDING) {
            queries.setStatus(order.id(), OrderStatus.EXPIRED, now());
        }
    }

    private static ApiException notPending(OrderStatus status) {
        return status == OrderStatus.EXPIRED
                ? ApiException.conflict("order_expired", "This order expired. Make a new one.")
                : ApiException.conflict(
                        "order_closed",
                        "This order is already " + status.name().toLowerCase(Locale.ROOT) + ".");
    }

    private OrderView view(OrderRow o) {
        return view(o, null);
    }

    private OrderView view(OrderRow o, PayWayGateway.@Nullable Checkout checkout) {
        RefundRequestView request =
                queries.refundRequestOf(o.id())
                        .map(r ->
                                new RefundRequestView(
                                        r.status().toLowerCase(Locale.ROOT),
                                        r.requestedAt().toInstant(),
                                        r.decisionNote(),
                                        r.refundedCoins()))
                        .orElse(null);
        return new OrderView(
                o.orderNumber(),
                effectiveStatus(o),
                o.packId(),
                o.coins(),
                o.bonusCoins(),
                o.firstBonusCoins(),
                o.coins() + o.bonusCoins() + o.firstBonusCoins(),
                o.method(),
                o.priceUsdCents(),
                o.priceKhr(),
                o.provider().toLowerCase(Locale.ROOT),
                o.createdAt().toInstant(),
                o.expiresAt().toInstant(),
                o.paidAt() == null ? null : o.paidAt().toInstant(),
                request,
                checkout);
    }

    /** "PR-" and 8 random digits. */
    private String orderNumber() {
        return "PR-%08d".formatted(random.nextInt(100_000_000));
    }

    private static @Nullable Key readKey(@Nullable String cursor) {
        String text = Cursors.decode(cursor);
        if (text == null) {
            return null;
        }
        String[] parts = text.split("\\|", -1);
        try {
            if (parts.length == 3 && parts[0].equals("o")) {
                return new Key(
                        Instant.parse(parts[1]).atOffset(ZoneOffset.UTC),
                        UUID.fromString(parts[2]));
            }
        } catch (IllegalArgumentException | DateTimeParseException ignored) {
            // falls through to the error below
        }
        throw ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }
}
