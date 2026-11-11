package app.phumreader.payment.web;

import app.phumreader.payment.service.PayWayCallbacks;
import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * ABA PayWay tells us a payment finished (plan P3-11). Public and without CSRF, but every call must
 * carry PayWay's signature; PayWay is then asked for the real state before any coin is credited.
 */
@RestController
@RequestMapping("/api/v1/payments/payway")
@Hidden
class PayWayCallbackController {

    private final PayWayCallbacks callbacks;

    PayWayCallbackController(PayWayCallbacks callbacks) {
        this.callbacks = callbacks;
    }

    @PostMapping("/callback")
    ResponseEntity<String> callback(
            @RequestBody String body,
            @RequestHeader(name = "X-PAYWAY-HMAC-SHA512", required = false) String signature) {
        return callbacks.handle(body, signature)
                ? ResponseEntity.ok("OK")
                : ResponseEntity.status(401).body("Invalid signature");
    }
}
