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
import com.fasterxml.jackson.annotation.JsonProperty;
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
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coin packs and orders (plan P3-11). An order is PENDING for {@code
 * phumreader.payments.order-ttl}, then PAID, FAILED, CANCELLED or EXPIRED. Paying credits the
 * pack's coins, its bonus and (on the account's first paid order) the first-purchase bonus exactly
 * once, however often the confirmation arrives.
 *
 * <p>Until ABA PayWay keys exist, development pays orders with the simulator ({@code
 * phumreader.payments.simulator}); production refuses to start with it on.
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    static final String ORDER_SCOPE = "order";
    static final String SIMULATOR = "DEV_SIMULATOR";
    static final int ORDERS_PER_HOUR = 20;

    private final PaymentQueries queries;
    private final CoinService coins;
    private final IdempotencyKeys idempotency;
    private final RateLimiter limiter;
    private final Clock clock;
    private final boolean simulator;
    private final Duration orderTtl;
    private final SecureRandom random = new SecureRandom();

    public PaymentService(
            PaymentQueries queries,
            CoinService coins,
            IdempotencyKeys idempotency,
            RateLimiter limiter,
            Clock clock,
            AppProperties properties,
            Environment environment) {
        this.queries = queries;
        this.coins = coins;
        this.idempotency = idempotency;
        this.limiter = limiter;
        this.clock = clock;
        this.simulator = properties.payments().simulator();
        this.orderTtl = properties.payments().orderTtl();
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
        if (!simulator) {
            // ABA PayWay is wired up with its merchant keys (A4).
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "payments_unavailable",
                    "Payments are not available yet.");
        }
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
                                    SIMULATOR,
                                    now,
                                    now.plus(orderTtl))
                            .orElse(null);
        }
        idempotency.save(
                user.id(), ORDER_SCOPE, key, request, new CreatedOrder(order.orderNumber()));
        return view(order);
    }

    /** One of the reader's orders (the website polls it while the reader pays). */
    public OrderView order(CurrentUser user, String orderNumber) {
        return view(ownOrder(user, orderNumber));
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
        UUID userId =
                queries.ownerOf(orderId)
                        .orElseThrow(
                                () -> ApiException.notFound("order_not_found", "Order not found."));
        // Same lock order as unlocks and new orders: the wallet first, then the order.
        int balance = coins.lockWallet(userId);
        OrderRow order = queries.lock(orderId);
        OrderStatus status = effectiveStatus(order);
        if (status == OrderStatus.PAID) {
            return view(order);
        }
        if (status != OrderStatus.PENDING) {
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
        return view(queries.lock(orderId));
    }

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
                o.paidAt() == null ? null : o.paidAt().toInstant());
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
