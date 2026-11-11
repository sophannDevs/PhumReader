package app.phumreader.payment.service;

import app.phumreader.payment.domain.PaymentMethod;
import java.math.BigDecimal;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/**
 * The calls to ABA PayWay. The real one is {@link HttpPayWayGateway}; tests use an in-memory fake.
 */
public interface PayWayGateway {

    /**
     * Starts a payment.
     *
     * @param tranId the order number (PayWay allows 20 characters)
     * @param amount sent exactly as written (USD with two decimals, KHR whole riel)
     * @param currency {@code USD} or {@code KHR}
     * @param lifetimeMinutes how long PayWay accepts the payment
     */
    Checkout start(
            String tranId,
            String amount,
            String currency,
            PaymentMethod method,
            int lifetimeMinutes);

    /** PayWay's own record of a payment (never the callback's word alone). */
    Check check(String tranId);

    /**
     * What the website shows to take the payment: a QR code and app link (KHQR, ABA Pay), or a
     * signed form it posts to PayWay's hosted card page.
     */
    record Checkout(
            @Nullable String qrString,
            @Nullable String abaDeeplink,
            @Nullable String qrImage,
            @Nullable String formAction,
            @Nullable Map<String, String> formFields) {}

    /** How PayWay sees a payment. */
    enum Status {
        APPROVED,
        PENDING,
        DECLINED,
        CANCELLED,
        REFUNDED,
        NOT_FOUND
    }

    /**
     * @param paidAmount what PayWay took (for APPROVED), to compare with the order's price
     * @param currency its currency
     */
    record Check(Status status, @Nullable BigDecimal paidAmount, @Nullable String currency) {}
}
