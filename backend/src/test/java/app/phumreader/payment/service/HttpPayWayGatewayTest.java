package app.phumreader.payment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.phumreader.common.error.ApiException;
import app.phumreader.payment.domain.PaymentMethod;
import app.phumreader.payment.service.PayWayGateway.Check;
import app.phumreader.payment.service.PayWayGateway.Checkout;
import app.phumreader.payment.service.PayWayGateway.Status;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/**
 * The real PayWay client against a local HTTP server standing in for ABA (no network, no Docker):
 * what it sends (signed fields, JSON or multipart) and how it reads every answer.
 */
class HttpPayWayGatewayTest {

    static final Clock CLOCK = Clock.fixed(Instant.parse("2026-11-05T05:00:00Z"), ZoneOffset.UTC);

    HttpServer server;
    final AtomicInteger status = new AtomicInteger(200);
    final AtomicReference<String> reply = new AtomicReference<>("{}");
    final List<String> bodies = new CopyOnWriteArrayList<>();
    final List<String> types = new CopyOnWriteArrayList<>();
    final List<String> paths = new CopyOnWriteArrayList<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    bodies.add(
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8));
                    types.add(exchange.getRequestHeaders().getFirst("Content-Type"));
                    paths.add(exchange.getRequestURI().getPath());
                    byte[] out = reply.get().getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(status.get(), out.length);
                    exchange.getResponseBody().write(out);
                    exchange.close();
                });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    HttpPayWayGateway gateway(boolean hosted) {
        PayWayProperties props =
                new PayWayProperties(
                        "merchant1",
                        "secret-key",
                        "http://127.0.0.1:" + server.getAddress().getPort(),
                        "https://api.example.test/api/v1/payments/payway/callback",
                        hosted);
        return new HttpPayWayGateway(props, CLOCK, JsonMapper.builder().build());
    }

    // ---------- start ----------

    @Test
    void aKhqrPurchaseSendsASignedMultipartFormAndReadsTheQrCode() {
        reply.set(
                """
                {"status":{"code":"00","message":"Success"},"qrString":"000201KHQR",
                 "qrImage":"data:image/png;base64,AAA","abapay_deeplink":"abamobilebank://pay"}
                """);
        Checkout checkout = gateway(false).start("PR-1", "2.50", "USD", PaymentMethod.KHQR, 10);

        assertThat(checkout.qrString()).isEqualTo("000201KHQR");
        assertThat(checkout.qrImage()).isEqualTo("data:image/png;base64,AAA");
        assertThat(checkout.abaDeeplink()).isEqualTo("abamobilebank://pay");
        assertThat(checkout.formAction()).isNull();
        assertThat(paths).containsExactly("/api/payment-gateway/v1/payments/purchase");
        assertThat(types.getFirst()).startsWith("multipart/form-data; boundary=");
        assertThat(bodies.getFirst())
                .contains("name=\"merchant_id\"\r\n\r\nmerchant1")
                .contains("name=\"tran_id\"\r\n\r\nPR-1")
                .contains("name=\"amount\"\r\n\r\n2.50")
                .contains("name=\"payment_option\"\r\n\r\nabapay_khqr_deeplink")
                .contains("name=\"req_time\"\r\n\r\n20261105050000")
                .contains("name=\"hash\"")
                .doesNotContain("secret-key")
                .doesNotContain("payment_gate");
    }

    @Test
    void theQrCodeCanComeInTheDocumentedSnakeCaseFields() {
        reply.set(
                "{\"status\":{\"code\":\"0\"},\"qr_string\":\"abc\",\"checkout_qr_url\":\"https://q\"}");
        Checkout checkout = gateway(false).start("PR-2", "1.00", "USD", PaymentMethod.ABA_PAY, 1);
        assertThat(checkout.qrString()).isEqualTo("abc");
        assertThat(checkout.qrImage()).isEqualTo("https://q");
        assertThat(checkout.abaDeeplink()).isNull();
        // The lifetime is never shorter than 3 minutes.
        assertThat(bodies.getFirst()).contains("name=\"lifetime\"\r\n\r\n3");
    }

    @Test
    void aCardPaymentReturnsAFormForPayWaysHostedPageAndCallsNothing() {
        Checkout checkout = gateway(false).start("PR-3", "5.00", "USD", PaymentMethod.CARD, 10);
        assertThat(paths).isEmpty();
        assertThat(checkout.qrString()).isNull();
        assertThat(checkout.formAction())
                .isEqualTo(
                        "http://127.0.0.1:"
                                + server.getAddress().getPort()
                                + "/api/payment-gateway/v1/payments/purchase");
        assertThat(checkout.formFields())
                .containsEntry("payment_option", "cards")
                .containsEntry("tran_id", "PR-3")
                .containsKey("hash")
                .doesNotContainKey("payment_gate");
    }

    @Test
    void hostedCheckoutSendsEveryMethodToPayWaysOwnPage() {
        Checkout aba = gateway(true).start("PR-4", "5.00", "USD", PaymentMethod.ABA_PAY, 10);
        Checkout khqr = gateway(true).start("PR-5", "5.00", "USD", PaymentMethod.KHQR, 10);
        assertThat(aba.formFields())
                .containsEntry("payment_option", "abapay")
                .containsEntry("payment_gate", "0");
        assertThat(khqr.formFields()).containsEntry("payment_option", "abapay_khqr");
        assertThat(paths).isEmpty();
    }

    @Test
    void theHashDependsOnTheOrderAndTheKey() {
        Checkout one = gateway(true).start("PR-6", "5.00", "USD", PaymentMethod.CARD, 10);
        Checkout two = gateway(true).start("PR-7", "5.00", "USD", PaymentMethod.CARD, 10);
        assertThat(one.formFields().get("hash")).isNotEqualTo(two.formFields().get("hash"));
    }

    @Test
    void aRefusedPurchaseIsReportedAsPaymentsUnavailable() {
        reply.set("{\"status\":{\"code\":\"7\",\"message\":\"Invalid merchant\"}}");
        assertUnavailable(
                () -> gateway(false).start("PR-8", "1.00", "USD", PaymentMethod.KHQR, 10));
    }

    @Test
    void anAnswerWithoutAQrCodeIsReportedAsPaymentsUnavailable() {
        reply.set("{\"status\":{\"code\":\"00\"}}");
        assertUnavailable(
                () -> gateway(false).start("PR-9", "1.00", "USD", PaymentMethod.KHQR, 10));
    }

    @Test
    void aServerErrorOrBrokenJsonIsReportedAsPaymentsUnavailable() {
        status.set(500);
        assertUnavailable(
                () -> gateway(false).start("PR-10", "1.00", "USD", PaymentMethod.KHQR, 10));
        status.set(200);
        reply.set("not json");
        assertUnavailable(
                () -> gateway(false).start("PR-11", "1.00", "USD", PaymentMethod.KHQR, 10));
    }

    @Test
    void anUnreachableHostIsReportedAsPaymentsUnavailable() {
        HttpPayWayGateway gateway = gateway(false);
        server.stop(0);
        assertUnavailable(() -> gateway.start("PR-12", "1.00", "USD", PaymentMethod.KHQR, 10));
        assertUnavailable(() -> gateway.check("PR-12"));
    }

    // ---------- check ----------

    @Test
    void aStatusCheckPostsSignedJsonAndReadsAnApprovedPayment() {
        reply.set(
                """
                {"status":{"code":"00"},"data":{"payment_status_code":0,
                 "payment_amount":"2.50","payment_currency":"USD"}}
                """);
        Check check = gateway(false).check("PR-20");
        assertThat(check.status()).isEqualTo(Status.APPROVED);
        assertThat(check.paidAmount()).isEqualByComparingTo(new BigDecimal("2.50"));
        assertThat(check.currency()).isEqualTo("USD");
        assertThat(paths).containsExactly("/api/payment-gateway/v1/payments/check-transaction-2");
        assertThat(types.getFirst()).isEqualTo("application/json");
        assertThat(bodies.getFirst())
                .contains("\"tran_id\":\"PR-20\"")
                .contains("\"merchant_id\":\"merchant1\"")
                .contains("\"hash\":")
                .doesNotContain("secret-key");
    }

    @Test
    void everyPayWayStatusCodeMapsToOurStatus() {
        assertThat(statusFor(2)).isEqualTo(Status.PENDING);
        assertThat(statusFor(3)).isEqualTo(Status.DECLINED);
        assertThat(statusFor(4)).isEqualTo(Status.REFUNDED);
        assertThat(statusFor(7)).isEqualTo(Status.CANCELLED);
        // An unknown code is treated as not paid yet.
        assertThat(statusFor(99)).isEqualTo(Status.PENDING);
    }

    @Test
    void anUnknownTransactionIsNotFoundAndAPendingOneHasNoAmount() {
        reply.set("{\"status\":{\"code\":\"6\"}}");
        Check missing = gateway(false).check("PR-21");
        assertThat(missing.status()).isEqualTo(Status.NOT_FOUND);
        assertThat(missing.paidAmount()).isNull();

        reply.set("{\"status\":{\"code\":\"00\"},\"data\":{\"payment_status_code\":2}}");
        Check pending = gateway(false).check("PR-22");
        assertThat(pending.paidAmount()).isNull();
        assertThat(pending.currency()).isNull();
    }

    @Test
    void anErrorCodeOrBadAnswerFromTheStatusCheckIsReportedAsUnavailable() {
        reply.set("{\"status\":{\"code\":\"13\"}}");
        assertUnavailable(() -> gateway(false).check("PR-23"));
        status.set(503);
        assertUnavailable(() -> gateway(false).check("PR-24"));
    }

    private Status statusFor(int code) {
        reply.set("{\"status\":{\"code\":\"00\"},\"data\":{\"payment_status_code\":" + code + "}}");
        return gateway(false).check("PR-30").status();
    }

    private static void assertUnavailable(Runnable call) {
        assertThatThrownBy(call::run)
                .isInstanceOfSatisfying(
                        ApiException.class,
                        e -> assertThat(e.code()).isEqualTo("payments_unavailable"));
    }
}
