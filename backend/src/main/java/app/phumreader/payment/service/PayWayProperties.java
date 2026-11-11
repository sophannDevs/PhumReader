package app.phumreader.payment.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * ABA PayWay merchant settings ({@code phumreader.payments.payway.*}), from {@code backend/.env}.
 * Empty until ABA issues the merchant keys (plan A4); then the real gateway starts.
 *
 * @param merchantId the merchant id from ABA
 * @param apiKey the API key that signs requests and callbacks (secret, never logged)
 * @param baseUrl the PayWay host: the sandbox by default; ABA gives the production host
 * @param callbackUrl the public HTTPS address of {@code /api/v1/payments/payway/callback}
 * @param hostedCheckout send every method to PayWay's own checkout page ({@code payment_gate=0})
 *     instead of showing the QR code on our page. For the sandbox, whose QR codes cannot be paid
 *     with a banking app ("for visual reference only"); the sandbox page takes test cards.
 */
@ConfigurationProperties("phumreader.payments.payway")
public record PayWayProperties(
        @DefaultValue("") String merchantId,
        @DefaultValue("") String apiKey,
        @DefaultValue("https://checkout-sandbox.payway.com.kh") String baseUrl,
        @DefaultValue("") String callbackUrl,
        @DefaultValue("false") boolean hostedCheckout) {}
