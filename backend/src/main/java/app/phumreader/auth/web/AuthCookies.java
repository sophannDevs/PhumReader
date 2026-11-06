package app.phumreader.auth.web;

import app.phumreader.auth.service.IssuedTokens;
import app.phumreader.config.AppProperties;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

/**
 * The two sign-in cookies, both HttpOnly (JavaScript never sees a token) and SameSite=Lax. The
 * refresh cookie is only sent to {@code /api/v1/auth}.
 */
@Component
public class AuthCookies {

    public static final String ACCESS = "phumreader_at";
    public static final String REFRESH = "phumreader_rt";
    static final String REFRESH_PATH = "/api/v1/auth";

    private final boolean secure;
    private final Clock clock;

    AuthCookies(AppProperties properties, Clock clock) {
        this.secure = properties.auth().secureCookies();
        this.clock = clock;
    }

    void write(HttpServletResponse response, IssuedTokens tokens) {
        Instant now = clock.instant();
        add(
                response,
                ACCESS,
                tokens.accessToken(),
                "/",
                lifetime(tokens, now, tokens.accessExpiresAt()));
        add(
                response,
                REFRESH,
                tokens.refreshToken(),
                REFRESH_PATH,
                lifetime(tokens, now, tokens.refreshExpiresAt()));
    }

    void clear(HttpServletResponse response) {
        add(response, ACCESS, "", "/", Duration.ZERO);
        add(response, REFRESH, "", REFRESH_PATH, Duration.ZERO);
    }

    /**
     * Remembered: until the token expires. Not remembered: until the browser closes (no Max-Age).
     */
    private static Duration lifetime(IssuedTokens tokens, Instant now, Instant expiresAt) {
        return tokens.remember() ? Duration.between(now, expiresAt) : Duration.ofSeconds(-1);
    }

    private void add(
            HttpServletResponse response, String name, String value, String path, Duration maxAge) {
        ResponseCookie cookie =
                ResponseCookie.from(name, value)
                        .httpOnly(true)
                        .secure(secure)
                        .sameSite("Lax")
                        .path(path)
                        .maxAge(maxAge)
                        .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
