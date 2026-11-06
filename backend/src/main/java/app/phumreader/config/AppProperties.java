package app.phumreader.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Duration;
import org.hibernate.validator.constraints.URL;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * PhumReader settings ({@code phumreader.*}). Values come from the environment or {@code
 * backend/.env}; the app refuses to start when a required one is missing and names it.
 *
 * @param frontendUrl the website's address, used for links in emails and sign-in redirects
 * @param auth sign-in settings
 * @param catalog settings for the public catalog (home feed, series, rankings)
 * @param payments coin orders and payments
 */
@Validated
@ConfigurationProperties("phumreader")
public record AppProperties(
        @NotBlank @URL String frontendUrl,
        @Valid @DefaultValue Auth auth,
        @Valid @DefaultValue Catalog catalog,
        @Valid @DefaultValue Payments payments) {

    /**
     * @param homeCacheTtl how long the home feed is served from memory before it is built again
     *     (zero turns the cache off)
     */
    public record Catalog(@DefaultValue("60s") Duration homeCacheTtl) {}

    /**
     * @param simulator dev and tests only: orders are paid with a simulator endpoint instead of ABA
     *     PayWay (never on in production)
     * @param orderTtl how long an order can be paid (the KHQR code's lifetime)
     */
    public record Payments(
            @DefaultValue("false") boolean simulator, @DefaultValue("10m") Duration orderTtl) {}

    /**
     * @param accessTokenTtl lifetime of the access token (JWT in the access cookie)
     * @param refreshTokenTtl lifetime of a refresh token (one device sign-in)
     * @param refreshReuseGrace how long a just-rotated refresh token may still be used (two tabs
     *     refreshing at once); later reuse logs that device out
     * @param secureCookies send cookies only over HTTPS (off for plain http://localhost in dev)
     * @param jwtPrivateKey RSA private key (PKCS#8 PEM) that signs access tokens; required unless
     *     {@code generateDevKeys}
     * @param generateDevKeys make a throw-away key at startup (dev and tests only): access tokens
     *     stop working after a restart and the website refreshes them silently
     * @param fixedVerificationCode dev only: every email code is this value (lets end-to-end tests
     *     sign up); never set in production
     */
    public record Auth(
            @DefaultValue("15m") Duration accessTokenTtl,
            @DefaultValue("30d") Duration refreshTokenTtl,
            @DefaultValue("20s") Duration refreshReuseGrace,
            @DefaultValue("true") boolean secureCookies,
            @Nullable String jwtPrivateKey,
            @DefaultValue("false") boolean generateDevKeys,
            @Nullable @Pattern(regexp = "\\d{6}") String fixedVerificationCode) {}
}
