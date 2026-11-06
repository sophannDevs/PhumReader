package app.phumreader.auth.service;

import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.config.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

/**
 * Six-digit email codes: valid 10 minutes, 5 tries. Only a hash of the code is kept. In development
 * {@code phumreader.auth.fixed-verification-code} makes every code the same (end-to-end tests).
 */
@Component
class VerificationCodes {

    static final Duration LIFETIME = Duration.ofMinutes(10);
    static final int MAX_ATTEMPTS = 5;

    private static final Logger log = LoggerFactory.getLogger(VerificationCodes.class);

    enum Check {
        OK,
        WRONG,
        EXPIRED,
        TOO_MANY_ATTEMPTS
    }

    private final ShortLivedStore store;
    private final Clock clock;
    private final String fixedCode;

    VerificationCodes(
            ShortLivedStore store, Clock clock, AppProperties properties, Environment environment) {
        this.store = store;
        this.clock = clock;
        this.fixedCode = properties.auth().fixedVerificationCode();
        if (fixedCode != null) {
            if (environment.acceptsProfiles(Profiles.of("prod"))) {
                throw new IllegalStateException(
                        "phumreader.auth.fixed-verification-code must not be set in production");
            }
            log.warn(
                    "Every email code is {} (phumreader.auth.fixed-verification-code).", fixedCode);
        }
    }

    /** A new code for {@code email}; the previous one stops working. */
    String issue(String email) {
        String code = fixedCode != null ? fixedCode : Secrets.randomCode();
        Instant expiresAt = clock.instant().plus(LIFETIME);
        store.put(key(email), encode(Secrets.sha256(email + ":" + code), 0, expiresAt), expiresAt);
        return code;
    }

    Check check(String email, String code) {
        Optional<String> stored = store.get(key(email));
        if (stored.isEmpty()) {
            return Check.EXPIRED;
        }
        String[] parts = stored.get().split("\\|");
        String hash = parts[0];
        int attempts = Integer.parseInt(parts[1]);
        Instant expiresAt = Instant.ofEpochMilli(Long.parseLong(parts[2]));
        if (attempts >= MAX_ATTEMPTS) {
            return Check.TOO_MANY_ATTEMPTS;
        }
        if (Secrets.sameHash(hash, Secrets.sha256(email + ":" + code))) {
            store.remove(key(email));
            return Check.OK;
        }
        int used = attempts + 1;
        store.put(key(email), encode(hash, used, expiresAt), expiresAt);
        return used >= MAX_ATTEMPTS ? Check.TOO_MANY_ATTEMPTS : Check.WRONG;
    }

    private static String key(String email) {
        return "verify:" + email;
    }

    private static String encode(String hash, int attempts, Instant expiresAt) {
        return hash + "|" + attempts + "|" + expiresAt.toEpochMilli();
    }
}
