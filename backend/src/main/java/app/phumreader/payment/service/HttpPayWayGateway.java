package app.phumreader.payment.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.payment.domain.PaymentMethod;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * ABA PayWay over HTTPS (developer.payway.com.kh: Purchase and Check transaction). Field names and
 * the hash order follow ABA's published OpenAPI and PHP samples; confirm them against the sandbox
 * (docs/BACKEND_CHECKLIST.md, P3-11).
 */
public class HttpPayWayGateway implements PayWayGateway {

    private static final Logger log = LoggerFactory.getLogger(HttpPayWayGateway.class);
    private static final DateTimeFormatter REQ_TIME =
            DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneOffset.UTC);
    private static final String PURCHASE = "/api/payment-gateway/v1/payments/purchase";
    private static final String CHECK = "/api/payment-gateway/v1/payments/check-transaction-2";

    private final PayWayProperties props;
    private final Clock clock;
    private final JsonMapper json;
    private final HttpClient http =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    public HttpPayWayGateway(PayWayProperties props, Clock clock, JsonMapper json) {
        this.props = props;
        this.clock = clock;
        this.json = json;
    }

    @Override
    public Checkout start(
            String tranId,
            String amount,
            String currency,
            PaymentMethod method,
            int lifetimeMinutes) {
        String reqTime = REQ_TIME.format(clock.instant());
        boolean hosted = props.hostedCheckout() || method == PaymentMethod.CARD;
        String option =
                method == PaymentMethod.CARD
                        ? "cards"
                        : !props.hostedCheckout()
                                ? "abapay_khqr_deeplink"
                                : method == PaymentMethod.ABA_PAY ? "abapay" : "abapay_khqr";
        String returnUrl =
                Base64.getEncoder()
                        .encodeToString(props.callbackUrl().getBytes(StandardCharsets.UTF_8));
        String lifetime = String.valueOf(Math.max(3, lifetimeMinutes));
        // Order of the hash input is fixed by ABA; fields not sent count as empty.
        String hash =
                PayWaySigner.sign(
                        PayWaySigner.concat(
                                reqTime,
                                props.merchantId(),
                                tranId,
                                amount,
                                null, // items
                                null, // shipping
                                null, // firstname
                                null, // lastname
                                null, // email
                                null, // phone
                                "purchase",
                                option,
                                returnUrl,
                                null, // cancel_url
                                null, // continue_success_url
                                null, // return_deeplink
                                currency,
                                null, // custom_fields
                                null, // return_params
                                null, // payout
                                lifetime,
                                null, // additional_params
                                null, // google_pay_token
                                null), // skip_success_page
                        props.apiKey());
        Map<String, String> fields = new LinkedHashMap<>();
        fields.put("req_time", reqTime);
        fields.put("merchant_id", props.merchantId());
        fields.put("tran_id", tranId);
        fields.put("amount", amount);
        fields.put("type", "purchase");
        fields.put("payment_option", option);
        fields.put("return_url", returnUrl);
        fields.put("currency", currency);
        fields.put("lifetime", lifetime);
        if (props.hostedCheckout()) {
            // This merchant profile also has the QR API, which answers a QR code by default;
            // payment_gate=0 asks for PayWay's checkout page.
            fields.put("payment_gate", "0");
        }
        fields.put("hash", hash);
        String action = props.baseUrl() + PURCHASE;
        if (hosted) {
            // The reader's browser posts this form to PayWay's hosted page: card numbers never
            // touch PhumReader (A5).
            return new Checkout(null, null, null, action, fields);
        }
        JsonNode reply = postMultipart(action, fields);
        String code = reply.path("status").path("code").asString("");
        if (!"00".equals(code) && !"0".equals(code)) {
            log.warn(
                    "PayWay refused order {}: code {} {}",
                    tranId,
                    code,
                    reply.path("status").path("message").asString(""));
            throw unavailable();
        }
        // The sandbox answers qrString / qrImage (camelCase); ABA's docs show qr_string.
        String qrString = first(reply, "qrString", "qr_string");
        if (qrString == null) {
            log.warn("PayWay gave no QR code for order {}", tranId);
            throw unavailable();
        }
        return new Checkout(
                qrString,
                text(reply, "abapay_deeplink"),
                first(reply, "qrImage", "checkout_qr_url"),
                null,
                null);
    }

    @Override
    public Check check(String tranId) {
        String reqTime = REQ_TIME.format(clock.instant());
        Map<String, String> body = new LinkedHashMap<>();
        body.put("req_time", reqTime);
        body.put("merchant_id", props.merchantId());
        body.put("tran_id", tranId);
        body.put(
                "hash",
                PayWaySigner.sign(
                        PayWaySigner.concat(reqTime, props.merchantId(), tranId), props.apiKey()));
        JsonNode reply;
        try {
            HttpRequest request =
                    HttpRequest.newBuilder(URI.create(props.baseUrl() + CHECK))
                            .timeout(Duration.ofSeconds(10))
                            .header("Content-Type", "application/json")
                            .POST(
                                    HttpRequest.BodyPublishers.ofString(
                                            json.writeValueAsString(body)))
                            .build();
            reply = json.readTree(send(request));
        } catch (RuntimeException e) {
            log.warn("PayWay status check failed for {}: {}", tranId, e.toString());
            throw unavailable();
        }
        String code = reply.path("status").path("code").asString("");
        if ("6".equals(code)) {
            return new Check(Status.NOT_FOUND, null, null);
        }
        if (!"00".equals(code)) {
            log.warn("PayWay status check for {} answered code {}", tranId, code);
            throw unavailable();
        }
        JsonNode data = reply.path("data");
        Status status =
                switch (data.path("payment_status_code").asInt(-1)) {
                    case 0 -> Status.APPROVED;
                    case 2 -> Status.PENDING;
                    case 3 -> Status.DECLINED;
                    case 4 -> Status.REFUNDED;
                    case 7 -> Status.CANCELLED;
                    default -> Status.PENDING;
                };
        String paid = text(data, "payment_amount");
        return new Check(
                status, paid == null ? null : new BigDecimal(paid), text(data, "payment_currency"));
    }

    // ---------- HTTP ----------

    private JsonNode postMultipart(String url, Map<String, String> fields) {
        String boundary = "----phum" + UUID.randomUUID().toString().replace("-", "");
        StringBuilder body = new StringBuilder();
        fields.forEach((name, value) ->
                body.append("--")
                        .append(boundary)
                        .append("\r\n")
                        .append("Content-Disposition: form-data; name=\"")
                        .append(name)
                        .append("\"\r\n\r\n")
                        .append(value)
                        .append("\r\n"));
        body.append("--").append(boundary).append("--\r\n");
        try {
            HttpRequest request =
                    HttpRequest.newBuilder(URI.create(url))
                            .timeout(Duration.ofSeconds(15))
                            .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                            .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                            .build();
            return json.readTree(send(request));
        } catch (RuntimeException e) {
            log.warn("PayWay purchase request failed: {}", e.toString());
            throw unavailable();
        }
    }

    private String send(HttpRequest request) {
        try {
            HttpResponse<String> response =
                    http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("PayWay answered HTTP " + response.statusCode());
            }
            return response.body();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    private static String first(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = text(node, field);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asString();
    }

    private static ApiException unavailable() {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "payments_unavailable",
                "Payments are not available right now. Try again in a moment.");
    }
}
