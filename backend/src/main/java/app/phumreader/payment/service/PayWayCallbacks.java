package app.phumreader.payment.service;

import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Checks a PayWay callback's signature, then settles the order it names. */
@Service
public class PayWayCallbacks {

    private static final Logger log = LoggerFactory.getLogger(PayWayCallbacks.class);

    private final PayWayProperties props;
    private final PaymentService payments;
    private final JsonMapper json;

    public PayWayCallbacks(PayWayProperties props, PaymentService payments, JsonMapper json) {
        this.props = props;
        this.payments = payments;
        this.json = json;
    }

    /**
     * @return false when the call is not signed by PayWay (answer 401); true otherwise, even for an
     *     order we do not know or one still open, so PayWay stops retrying
     */
    public boolean handle(String body, @Nullable String signature) {
        if (props.apiKey().isBlank() || signature == null) {
            return false;
        }
        JsonNode node;
        try {
            node = json.readTree(body);
        } catch (RuntimeException e) {
            return false;
        }
        if (!node.isObject() || !PayWaySigner.verifyCallback(node, signature, props.apiKey())) {
            log.warn("Rejected a PayWay callback with a wrong signature");
            return false;
        }
        String tranId = node.path("tran_id").asString("");
        if (!tranId.isBlank()) {
            PaymentService.Settlement result = payments.settleFromPayWay(tranId, false);
            log.info("PayWay callback for {}: {}", tranId, result);
        }
        return true;
    }
}
