package app.phumreader.auth.web;

import app.phumreader.auth.service.AuthService.ClientInfo;
import app.phumreader.auth.service.AuthService.SignIn;
import app.phumreader.auth.service.SocialLoginService;
import app.phumreader.common.error.ApiException;
import app.phumreader.config.AppProperties;
import app.phumreader.user.domain.SocialProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Google and Facebook login. Both endpoints are whole-page browser navigations, not API calls: the
 * website sends the browser to {@code start}, the provider sends it back to {@code callback}, and
 * the callback sets the sign-in cookies and redirects to {@code /login?social=<result>} on the
 * website, where the page reads who signed in and returns to the page the person came from.
 *
 * <p>Results: {@code done}, {@code cancelled}, {@code unavailable}, or an error code ({@code
 * social_failed}, {@code social_no_email}, {@code social_email_unverified}, {@code account_banned},
 * {@code too_many_requests}).
 */
@RestController
@RequestMapping("/api/v1/auth/oauth/{provider}")
@Tag(name = "auth")
class SocialLoginController {

    static final String STATE_COOKIE = "phumreader_oauth";
    static final String STATE_PATH = "/api/v1/auth/oauth";
    private static final Logger LOG = LoggerFactory.getLogger(SocialLoginController.class);

    private final SocialLoginService social;
    private final AuthCookies cookies;
    private final boolean secure;

    SocialLoginController(
            SocialLoginService social, AuthCookies cookies, AppProperties properties) {
        this.social = social;
        this.cookies = cookies;
        this.secure = properties.auth().secureCookies();
    }

    @GetMapping("/start")
    @Operation(
            summary = "Sends the browser to Google or Facebook to sign in",
            description =
                    "302 to the provider. Without app credentials: 302 to"
                            + " /login?social=unavailable.")
    void start(
            @PathVariable String provider,
            @RequestParam(required = false) String locale,
            HttpServletRequest request,
            HttpServletResponse response)
            throws IOException {
        String language = "km".equals(locale) ? "km" : "en";
        SocialProvider which = SocialProvider.fromSlug(provider).orElse(null);
        if (which == null) {
            response.sendRedirect(loginUrl(language, "unavailable"));
            return;
        }
        try {
            SocialLoginService.Started started = social.start(which, language, client(request));
            stateCookie(response, started.state(), Duration.ofMinutes(10));
            response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
            response.sendRedirect(started.providerUri().toString());
        } catch (ApiException ex) {
            boolean off = ex.code().equals("social_unavailable");
            response.sendRedirect(loginUrl(language, off ? "unavailable" : ex.code()));
        }
    }

    @GetMapping("/callback")
    @Operation(
            summary = "Where the provider sends the browser back to",
            description = "Sets the sign-in cookies and redirects to /login?social=<result>.")
    void callback(
            @PathVariable String provider,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @Parameter(hidden = true) @CookieValue(name = STATE_COOKIE, required = false)
                    String browserState,
            HttpServletRequest request,
            HttpServletResponse response)
            throws IOException {
        stateCookie(response, "", Duration.ZERO);
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        SocialProvider which = SocialProvider.fromSlug(provider).orElse(null);
        String language =
                state == null ? null : social.consumeState(state, browserState).orElse(null);
        if (which == null || language == null) {
            // A stale or foreign link: nothing is known about the person's language.
            response.sendRedirect(loginUrl("en", "social_failed"));
            return;
        }
        if (error != null || code == null || code.isBlank()) {
            // "Cancel" on the provider's page comes back as error=access_denied.
            response.sendRedirect(
                    loginUrl(language, error != null ? "cancelled" : "social_failed"));
            return;
        }
        try {
            SignIn signIn = social.signIn(which, code, language, client(request));
            cookies.write(response, signIn.tokens());
            response.sendRedirect(loginUrl(language, "done"));
        } catch (ApiException ex) {
            response.sendRedirect(loginUrl(language, ex.code()));
        } catch (RuntimeException ex) {
            LOG.warn("{} sign-in failed", which, ex);
            response.sendRedirect(loginUrl(language, "social_failed"));
        }
    }

    private String loginUrl(String language, String result) {
        return social.loginPage(language) + "?social=" + result;
    }

    /**
     * HttpOnly, SameSite=Lax (the provider's redirect is a top-level GET), only for these paths.
     */
    private void stateCookie(HttpServletResponse response, String value, Duration maxAge) {
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                ResponseCookie.from(STATE_COOKIE, value)
                        .httpOnly(true)
                        .secure(secure)
                        .sameSite("Lax")
                        .path(STATE_PATH)
                        .maxAge(maxAge)
                        .build()
                        .toString());
    }

    private static ClientInfo client(HttpServletRequest request) {
        return new ClientInfo(request.getRemoteAddr(), request.getHeader(HttpHeaders.USER_AGENT));
    }
}
