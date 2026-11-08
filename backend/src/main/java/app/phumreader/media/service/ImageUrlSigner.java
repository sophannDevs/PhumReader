package app.phumreader.media.service;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Signs the addresses of paid comic panels for the image access Worker (plan P3-08).
 *
 * <p>A signed address is {@code <image-cdn-url>/<key>?t=<exp>.<sig>} where {@code exp} is the Unix
 * time (seconds) it stops working and {@code sig = base64url(HMAC-SHA256(secret, "/<key>\n<exp>"))}
 * without padding. The Worker (infra/image-worker/src/token.ts) checks exactly this; both are
 * tested against the same vector. The token is tied to the image's path and is not part of the CDN
 * cache key, so one cached copy serves every reader.
 *
 * <p>Without {@code phumreader.storage.image-signing-secret} (development without the Worker,
 * tests) addresses are not signed: they are the object's plain public address.
 */
@Component
public class ImageUrlSigner {

    /** How long a signed address works ("a paid image URL works for 5 minutes", plan P3-08). */
    public static final Duration LIFETIME = Duration.ofMinutes(5);

    private final ObjectStore store;
    private final Clock clock;
    private final String secret;
    private final String cdnUrl;

    public ImageUrlSigner(
            ObjectStore store,
            Clock clock,
            @Value("${phumreader.storage.image-signing-secret:}") String secret,
            @Value("${phumreader.storage.image-cdn-url:}") String cdnUrl) {
        this.store = store;
        this.clock = clock;
        this.secret = secret;
        this.cdnUrl = cdnUrl.replaceAll("/+$", "");
        if (!secret.isBlank() && this.cdnUrl.isBlank()) {
            throw new IllegalStateException(
                    "phumreader.storage.image-signing-secret is set but phumreader.storage.image-cdn-url"
                            + " (IMAGE_CDN_URL) is not: signed addresses need the Worker's address.");
        }
    }

    /** True when addresses are signed (the Worker guards the images). */
    public boolean enabled() {
        return !secret.isBlank();
    }

    /** The address a reader may load {@code key} from for the next {@link #LIFETIME}. */
    public String sign(String key) {
        if (!enabled()) {
            return store.publicUrl(key);
        }
        long exp = clock.instant().plus(LIFETIME).getEpochSecond();
        return cdnUrl + "/" + key + "?t=" + token(secret, "/" + key, exp);
    }

    /**
     * The address to give a reader for an image address kept in the database. Panels uploaded by
     * creators are stored as the object's public address; those are signed. Anything else (the
     * demo's {@code /panels/…} files shipped with the website) is returned as it is.
     */
    public String signStored(String stored) {
        if (!enabled()) {
            return stored;
        }
        String prefix = store.publicUrl("");
        return stored.startsWith(prefix) && stored.length() > prefix.length()
                ? sign(stored.substring(prefix.length()))
                : stored;
    }

    /** {@code <exp>.<sig>} for a path; public so tests can pin the format with a fixed vector. */
    public static String token(String secret, String pathname, long exp) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] signature =
                    mac.doFinal((pathname + "\n" + exp).getBytes(StandardCharsets.UTF_8));
            return exp + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(signature);
        } catch (java.security.GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }
}
