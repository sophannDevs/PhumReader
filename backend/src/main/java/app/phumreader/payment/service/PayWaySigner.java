package app.phumreader.payment.service;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.Iterator;
import java.util.Map;
import java.util.TreeMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import tools.jackson.databind.JsonNode;

/**
 * ABA PayWay signatures: Base64 of HMAC-SHA512, keyed with the merchant's API key (ABA docs, "hash"
 * of Purchase and Check transaction, and the {@code X-PAYWAY-HMAC-SHA512} header of callbacks).
 */
public final class PayWaySigner {

    private PayWaySigner() {}

    /** Base64(HMAC-SHA512(data, key)). */
    public static String sign(String data, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA512");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA512"));
            return Base64.getEncoder()
                    .encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC-SHA512 is not available", e);
        }
    }

    /** The values joined in the order given; a null counts as an empty string. */
    public static String concat(String... values) {
        StringBuilder out = new StringBuilder();
        for (String v : values) {
            out.append(v == null ? "" : v);
        }
        return out.toString();
    }

    /**
     * The string a callback signature covers: the JSON object's values, ordered by key, joined (the
     * ABA PHP sample: {@code ksort}, then concatenate; arrays and objects as JSON).
     */
    public static String callbackData(JsonNode body) {
        Map<String, JsonNode> sorted = new TreeMap<>();
        for (Iterator<Map.Entry<String, JsonNode>> it = body.properties().iterator();
                it.hasNext(); ) {
            Map.Entry<String, JsonNode> e = it.next();
            sorted.put(e.getKey(), e.getValue());
        }
        StringBuilder out = new StringBuilder();
        for (JsonNode value : sorted.values()) {
            if (value.isNull()) {
                continue;
            } else if (value.isObject() || value.isArray()) {
                out.append(value.toString());
            } else {
                out.append(value.asString());
            }
        }
        return out.toString();
    }

    /** Whether a callback's signature header matches its body (constant-time comparison). */
    public static boolean verifyCallback(JsonNode body, String signature, String key) {
        if (signature == null || signature.isBlank()) {
            return false;
        }
        String expected = sign(callbackData(body), key);
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.trim().getBytes(StandardCharsets.UTF_8));
    }
}
