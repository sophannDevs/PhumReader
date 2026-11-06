package app.phumreader.auth.service;

import java.time.Instant;

/**
 * The cookies to set after a sign-in or refresh.
 *
 * @param remember persistent cookies when true, browser-session cookies when false
 */
public record IssuedTokens(
        String accessToken,
        Instant accessExpiresAt,
        String refreshToken,
        Instant refreshExpiresAt,
        boolean remember) {}
