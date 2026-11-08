package app.phumreader.payment.service;

import app.phumreader.payment.domain.OrderStatus;
import app.phumreader.payment.domain.PackTag;
import app.phumreader.payment.domain.PaymentMethod;
import java.time.Instant;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What the payment endpoints return (plan P3-11). */
public final class PaymentViews {

    private PaymentViews() {}

    /**
     * The Coins page: packs and ways to pay.
     *
     * @param orderExpiryMinutes how long an order (a KHQR code) can be paid
     * @param simulator dev only: orders are paid with {@code POST /coins/orders/{number}/simulate}
     *     instead of ABA PayWay
     */
    public record CoinShop(
            List<CoinPack> packs,
            List<PaymentMethod> methods,
            int orderExpiryMinutes,
            boolean simulator) {}

    /**
     * A coin pack. Prices are null until they are set (A2); the website shows its placeholders.
     *
     * @param bonus extra coins that come with the pack
     */
    public record CoinPack(
            int id,
            int coins,
            int bonus,
            @Nullable PackTag tag,
            @Nullable Integer priceUsdCents,
            @Nullable Integer priceKhr) {}

    /**
     * A coin order.
     *
     * @param orderNumber "PR-" and 8 digits, shown to the reader
     * @param status an unpaid order whose time ran out is {@code expired}
     * @param coins the pack's coins
     * @param bonusCoins the pack bonus
     * @param firstBonusCoins the first-purchase bonus: expected while the order is open, credited
     *     once it is paid
     * @param totalCoins coins + bonus + first-purchase bonus
     * @param provider {@code dev_simulator} in development, {@code payway} in production
     * @param checkout how to take the payment (QR code and app link, or the signed card-page form);
     *     only in the answer that creates a PayWay order
     */
    public record OrderView(
            String orderNumber,
            OrderStatus status,
            int packId,
            int coins,
            int bonusCoins,
            int firstBonusCoins,
            int totalCoins,
            PaymentMethod method,
            @Nullable Integer priceUsdCents,
            @Nullable Integer priceKhr,
            String provider,
            Instant createdAt,
            Instant expiresAt,
            @Nullable Instant paidAt,
            PayWayGateway.@Nullable Checkout checkout) {}

    /** Stored for an order's Idempotency-Key: the order it created. */
    public record CreatedOrder(String orderNumber) {}
}
