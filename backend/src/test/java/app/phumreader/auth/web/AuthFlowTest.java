package app.phumreader.auth.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.RecordingEmailSender;
import jakarta.servlet.http.Cookie;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Sign up, email code, log in, refresh, log out, forgot and reset, through the real endpoints. */
@IntegrationTest
@Import(AuthTestConfig.class)
class AuthFlowTest {

    private static final String PASSWORD = "Toonwave1!";
    private static final Pattern CODE = Pattern.compile("\\b(\\d{6})\\b");
    private static final Pattern RESET_TOKEN = Pattern.compile("token=([^\\s]+)");

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired RecordingEmailSender emails;
    @Autowired RateLimiter limiter;
    @Autowired ShortLivedStore store;

    /** The two sign-in cookies after a response. */
    record Session(Cookie access, Cookie refresh) {}

    /**
     * The browser's XSRF-TOKEN cookie (Spring's csrf() test helper is not used: it hides the real
     * cookie).
     */
    private Cookie xsrf;

    @BeforeEach
    void reset() throws Exception {
        limiter.clear();
        store.clear();
        emails.clear();
        xsrf =
                mvc.perform(get("/api/v1/auth/csrf"))
                        .andReturn()
                        .getResponse()
                        .getCookie("XSRF-TOKEN");
        assertThat(xsrf).as("XSRF-TOKEN cookie from GET /auth/csrf").isNotNull();
    }

    // ---------- sign up and email code ----------

    @Test
    void signUpConfirmTheCodeAndUseTheSession() throws Exception {
        String email = uniqueEmail();
        signUp(" Sokha Chan ", email.toUpperCase())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.codeExpiresInSeconds").value(600))
                .andExpect(jsonPath("$.resendAfterSeconds").value(30));

        MockHttpServletResponse verified =
                verify(email, codeSentTo(email))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.email").value(email))
                        .andExpect(jsonPath("$.displayName").value("Sokha Chan"))
                        .andExpect(jsonPath("$.emailVerified").value(true))
                        .andExpect(jsonPath("$.roles[0]").value("READER"))
                        .andReturn()
                        .getResponse();
        Session session = sessionOf(verified);
        assertThat(session.access().isHttpOnly()).isTrue();
        assertThat(session.refresh().isHttpOnly()).isTrue();
        assertThat(session.refresh().getPath()).isEqualTo("/api/v1/auth");
        assertThat(authCookieHeaders(verified))
                .hasSize(2)
                .allSatisfy(c -> assertThat(c).contains("SameSite=Lax").contains("HttpOnly"));

        mvc.perform(get("/api/v1/me").cookie(session.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));
        mvc.perform(get("/api/v1/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("unauthorized"));
    }

    @Test
    void weakPasswordsAndBadEmailsAreRefused() throws Exception {
        mvc.perform(
                        json(
                                post("/api/v1/auth/signup"),
                                signupBody("Sokha", uniqueEmail(), "abcdefgh")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("password_too_weak"))
                .andExpect(jsonPath("$.error.fields.password").value("password_too_weak"));
        mvc.perform(json(post("/api/v1/auth/signup"), signupBody("Sokha", "a@b", PASSWORD)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("validation_failed"))
                .andExpect(jsonPath("$.error.fields.email").exists());
        mvc.perform(json(post("/api/v1/auth/signup"), signupBody("S", uniqueEmail(), PASSWORD)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.name").exists());
    }

    @Test
    void aConfirmedEmailCannotSignUpAgainButAnUnconfirmedOneCan() throws Exception {
        String email = uniqueEmail();
        signUp("First Try", email).andExpect(status().isCreated());
        clock.advance(Duration.ofSeconds(1));
        signUp("Second Try", email).andExpect(status().isCreated());
        assertThat(emails.to(email)).hasSize(2);

        verify(email, codeSentTo(email))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Second Try"));
        signUp("Third Try", email)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("email_taken"));
    }

    @Test
    void wrongCodesAreCountedAndTheFifthEndsTheCode() throws Exception {
        String email = uniqueEmail();
        signUp("Sokha", email);
        String right = codeSentTo(email);
        String wrong = right.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < 4; i++) {
            verify(email, wrong)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error.code").value("invalid_code"))
                    .andExpect(jsonPath("$.error.fields.code").value("invalid_code"));
        }
        verify(email, wrong).andExpect(jsonPath("$.error.code").value("too_many_attempts"));
        verify(email, right).andExpect(jsonPath("$.error.code").value("too_many_attempts"));

        // A new code after the 30-second wait works.
        mvc.perform(json(post("/api/v1/auth/resend-code"), "{\"email\":\"" + email + "\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.error.code").value("resend_too_soon"))
                .andExpect(jsonPath("$.error.retryAfterSeconds").isNumber());
        clock.advance(Duration.ofSeconds(31));
        mvc.perform(json(post("/api/v1/auth/resend-code"), "{\"email\":\"" + email + "\"}"))
                .andExpect(status().isAccepted());
        verify(email, codeSentTo(email)).andExpect(status().isOk());
    }

    @Test
    void aCodeExpiresAfterTenMinutes() throws Exception {
        String email = uniqueEmail();
        signUp("Sokha", email);
        String code = codeSentTo(email);
        clock.advance(Duration.ofMinutes(10));
        verify(email, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("code_expired"));
    }

    // ---------- log in ----------

    @Test
    void logInAndTheSixthWrongPasswordIsSlowedDown() throws Exception {
        String email = confirmedAccount();
        logIn(email, PASSWORD, true)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));

        for (int i = 0; i < 5; i++) {
            logIn(email, "Wrong-password1", true)
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error.code").value("invalid_credentials"));
        }
        // The 6th try in 10 minutes is refused, even with the right password.
        logIn(email, PASSWORD, true)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.error.code").value("too_many_attempts"));

        clock.advance(Duration.ofMinutes(10));
        logIn(email, PASSWORD, true).andExpect(status().isOk());
    }

    @Test
    void unknownEmailsGetTheSameAnswerAsWrongPasswords() throws Exception {
        logIn(uniqueEmail(), PASSWORD, true)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("invalid_credentials"));
    }

    @Test
    void anUnconfirmedAccountIsAskedForItsCode() throws Exception {
        String email = uniqueEmail();
        signUp("Sokha", email);
        clock.advance(Duration.ofSeconds(31));
        logIn(email, PASSWORD, true)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("email_not_verified"));
        assertThat(emails.to(email)).hasSize(2);
    }

    @Test
    void rememberMeOffGivesBrowserSessionCookies() throws Exception {
        String email = confirmedAccount();
        MockHttpServletResponse response =
                logIn(email, PASSWORD, false).andExpect(status().isOk()).andReturn().getResponse();
        assertThat(authCookieHeaders(response))
                .hasSize(2)
                .noneSatisfy(c -> assertThat(c).contains("Max-Age"));
        MockHttpServletResponse remembered =
                logIn(email, PASSWORD, true).andExpect(status().isOk()).andReturn().getResponse();
        assertThat(authCookieHeaders(remembered))
                .hasSize(2)
                .allSatisfy(c -> assertThat(c).contains("Max-Age"));
    }

    @Test
    void anExpiredAccessTokenIsIgnored() throws Exception {
        Session session =
                sessionOf(logIn(confirmedAccount(), PASSWORD, true).andReturn().getResponse());
        clock.advance(Duration.ofMinutes(16));
        mvc.perform(get("/api/v1/me").cookie(session.access()))
                .andExpect(status().isUnauthorized());
    }

    // ---------- refresh and log out ----------

    @Test
    void refreshRotatesAndAReusedTokenLogsTheDeviceOut() throws Exception {
        Session first =
                sessionOf(logIn(confirmedAccount(), PASSWORD, true).andReturn().getResponse());

        Session second =
                sessionOf(
                        refresh(first.refresh())
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse());
        assertThat(second.refresh().getValue()).isNotEqualTo(first.refresh().getValue());
        mvc.perform(get("/api/v1/me").cookie(second.access())).andExpect(status().isOk());

        clock.advance(Duration.ofSeconds(1));
        MockHttpServletResponse reused =
                refresh(first.refresh())
                        .andExpect(status().isUnauthorized())
                        .andExpect(jsonPath("$.error.code").value("session_expired"))
                        .andReturn()
                        .getResponse();
        assertThat(reused.getCookie(AuthCookies.REFRESH).getMaxAge()).isZero();
        // The whole device is signed out, including the newer token.
        refresh(second.refresh()).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshWithoutACookieIsRefused() throws Exception {
        mvc.perform(withCsrf(post("/api/v1/auth/refresh")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("session_expired"));
    }

    @Test
    void logOutEndsThisDevice() throws Exception {
        Session session =
                sessionOf(logIn(confirmedAccount(), PASSWORD, true).andReturn().getResponse());
        MockHttpServletResponse out =
                mvc.perform(withCsrf(post("/api/v1/auth/logout")).cookie(session.refresh()))
                        .andExpect(status().isNoContent())
                        .andReturn()
                        .getResponse();
        assertThat(out.getCookie(AuthCookies.ACCESS).getMaxAge()).isZero();
        refresh(session.refresh()).andExpect(status().isUnauthorized());
    }

    @Test
    void logOutEverywhereEndsEveryDevice() throws Exception {
        String email = confirmedAccount();
        Session phone = sessionOf(logIn(email, PASSWORD, true).andReturn().getResponse());
        Session laptop = sessionOf(logIn(email, PASSWORD, true).andReturn().getResponse());

        mvc.perform(withCsrf(post("/api/v1/auth/logout-all")).cookie(laptop.access()))
                .andExpect(status().isNoContent());
        refresh(phone.refresh()).andExpect(status().isUnauthorized());
        refresh(laptop.refresh()).andExpect(status().isUnauthorized());
    }

    // ---------- forgot and reset password ----------

    @Test
    void forgotAndResetPassword() throws Exception {
        String email = confirmedAccount();
        Session before = sessionOf(logIn(email, PASSWORD, true).andReturn().getResponse());
        String unknown = uniqueEmail();

        forgot(unknown).andExpect(status().isAccepted());
        assertThat(emails.to(unknown)).isEmpty();
        forgot(email).andExpect(status().isAccepted());
        String token = resetTokenSentTo(email);

        reset(token, "weakpassword")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("password_too_weak"));
        reset(token, "N3w-password!").andExpect(status().isNoContent());

        // Signed out everywhere, the old password no longer works, the new one does.
        refresh(before.refresh()).andExpect(status().isUnauthorized());
        logIn(email, PASSWORD, true).andExpect(status().isUnauthorized());
        logIn(email, "N3w-password!", true).andExpect(status().isOk());
        // A reset link works once.
        reset(token, "An0ther-password!")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_token"));
    }

    @Test
    void aResetLinkExpiresAfterThirtyMinutes() throws Exception {
        String email = confirmedAccount();
        forgot(email);
        String token = resetTokenSentTo(email);
        clock.advance(Duration.ofMinutes(30));
        reset(token, "N3w-password!").andExpect(jsonPath("$.error.code").value("invalid_token"));
    }

    // ---------- CSRF ----------

    @Test
    void writesNeedTheCsrfHeaderWhichTheCsrfEndpointProvides() throws Exception {
        mvc.perform(
                        post("/api/v1/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(loginBody(uniqueEmail(), PASSWORD, true)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("invalid_csrf_token"));

        Cookie xsrf =
                mvc.perform(get("/api/v1/auth/csrf"))
                        .andExpect(status().isNoContent())
                        .andReturn()
                        .getResponse()
                        .getCookie("XSRF-TOKEN");
        assertThat(xsrf).isNotNull();
        mvc.perform(
                        post("/api/v1/auth/login")
                                .cookie(xsrf)
                                .header("X-XSRF-TOKEN", xsrf.getValue())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(loginBody(uniqueEmail(), PASSWORD, true)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("invalid_credentials"));
    }

    @Test
    void theCsrfTokenStaysTheSameAcrossSignUpRefreshAndLogOut() throws Exception {
        // The browser flow only (Spring's csrf() test helper would hide the real cookie): the
        // XSRF-TOKEN cookie from GET /auth/csrf is echoed in X-XSRF-TOKEN on every POST.
        String email = uniqueEmail();

        MockHttpServletResponse signedUp =
                mvc.perform(
                                browserPost("/api/v1/auth/signup", xsrf)
                                        .content(signupBody("Sokha", email, PASSWORD)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse();
        MockHttpServletResponse verified =
                mvc.perform(
                                browserPost("/api/v1/auth/verify", xsrf)
                                        .content(
                                                "{\"email\":\""
                                                        + email
                                                        + "\",\"code\":\""
                                                        + codeSentTo(email)
                                                        + "\"}"))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse();
        Session session = sessionOf(verified);
        MockHttpServletResponse me =
                mvc.perform(get("/api/v1/me").cookie(xsrf, session.access()))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse();
        MockHttpServletResponse refreshed =
                mvc.perform(
                                browserPost(
                                        "/api/v1/auth/refresh",
                                        xsrf,
                                        session.access(),
                                        session.refresh()))
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse();
        for (MockHttpServletResponse response : List.of(signedUp, verified, me, refreshed)) {
            assertThat(response.getHeaders(HttpHeaders.SET_COOKIE))
                    .as("the CSRF cookie must not be replaced")
                    .noneSatisfy(c -> assertThat(c).startsWith("XSRF-TOKEN="));
        }

        Session next = sessionOf(refreshed);
        mvc.perform(browserPost("/api/v1/auth/logout", xsrf, next.access(), next.refresh()))
                .andExpect(status().isNoContent());
    }

    /** Adds the CSRF cookie and header, as the browser sends them. */
    private org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder withCsrf(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request) {
        return request.cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue());
    }

    /** A POST as the browser sends it: the cookies, the CSRF header, a JSON body. */
    private static org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
            browserPost(String path, Cookie xsrf, Cookie... more) {
        Cookie[] cookies = new Cookie[more.length + 1];
        cookies[0] = xsrf;
        System.arraycopy(more, 0, cookies, 1, more.length);
        return post(path)
                .cookie(cookies)
                .header("X-XSRF-TOKEN", xsrf.getValue())
                .contentType(MediaType.APPLICATION_JSON);
    }

    // ---------- helpers ----------

    private String confirmedAccount() throws Exception {
        String email = uniqueEmail();
        signUp("Sokha Chan", email).andExpect(status().isCreated());
        verify(email, codeSentTo(email)).andExpect(status().isOk());
        return email;
    }

    private ResultActions signUp(String name, String email) throws Exception {
        return mvc.perform(json(post("/api/v1/auth/signup"), signupBody(name, email, PASSWORD)));
    }

    private ResultActions verify(String email, String code) throws Exception {
        return mvc.perform(
                json(
                        post("/api/v1/auth/verify"),
                        "{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}"));
    }

    private ResultActions logIn(String email, String password, boolean remember) throws Exception {
        return mvc.perform(json(post("/api/v1/auth/login"), loginBody(email, password, remember)));
    }

    private ResultActions refresh(Cookie refreshCookie) throws Exception {
        return mvc.perform(withCsrf(post("/api/v1/auth/refresh")).cookie(refreshCookie));
    }

    private ResultActions forgot(String email) throws Exception {
        return mvc.perform(
                json(post("/api/v1/auth/forgot-password"), "{\"email\":\"" + email + "\"}"));
    }

    private ResultActions reset(String token, String password) throws Exception {
        return mvc.perform(
                json(
                        post("/api/v1/auth/reset-password"),
                        "{\"token\":\"" + token + "\",\"password\":\"" + password + "\"}"));
    }

    private org.springframework.test.web.servlet.RequestBuilder json(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
            String body) {
        return withCsrf(request).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private static String signupBody(String name, String email, String password) {
        return "{\"name\":\""
                + name
                + "\",\"email\":\""
                + email
                + "\",\"password\":\""
                + password
                + "\"}";
    }

    private static String loginBody(String email, String password, boolean remember) {
        return "{\"email\":\""
                + email
                + "\",\"password\":\""
                + password
                + "\",\"remember\":"
                + remember
                + "}";
    }

    private String codeSentTo(String email) {
        String subject = emails.lastTo(email).orElseThrow().subject();
        Matcher m = CODE.matcher(subject);
        assertThat(m.find()).as("code in %s", subject).isTrue();
        return m.group(1);
    }

    private String resetTokenSentTo(String email) {
        String body = emails.lastTo(email).orElseThrow().body();
        Matcher m = RESET_TOKEN.matcher(body);
        assertThat(m.find()).as("reset link in %s", body).isTrue();
        return URLDecoder.decode(m.group(1), StandardCharsets.UTF_8);
    }

    /** The Set-Cookie headers of the two sign-in cookies (not the CSRF cookie). */
    private static List<String> authCookieHeaders(MockHttpServletResponse response) {
        return response.getHeaders(HttpHeaders.SET_COOKIE).stream()
                .filter(c ->
                        c.startsWith(AuthCookies.ACCESS + "=")
                                || c.startsWith(AuthCookies.REFRESH + "="))
                .toList();
    }

    private static Session sessionOf(MockHttpServletResponse response) {
        Cookie access = response.getCookie(AuthCookies.ACCESS);
        Cookie refresh = response.getCookie(AuthCookies.REFRESH);
        assertThat(List.of(access, refresh)).doesNotContainNull();
        return new Session(access, refresh);
    }

    private static String uniqueEmail() {
        return "reader-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }
}
