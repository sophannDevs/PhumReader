package app.phumreader.auth.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import app.phumreader.user.service.AccountErasureService;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
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
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Settings &gt; Account through the real endpoints (plan P3-17): change password, change email with
 * a code, signed-in devices, delete account with a 30-day grace period (A18).
 */
@IntegrationTest
@Import(AuthTestConfig.class)
class AccountSecurityTest {

    private static final String PASSWORD = "Toonwave1!";
    private static final String NEW_PASSWORD = "Phumreader2?";
    private static final Pattern CODE = Pattern.compile("\\b(\\d{6})\\b");
    private static final String CHROME_ON_WINDOWS =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
                    + " Chrome/140.0.0.0 Safari/537.36";
    private static final String SAFARI_ON_IPHONE =
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML,"
                    + " like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired RecordingEmailSender emails;
    @Autowired RateLimiter limiter;
    @Autowired ShortLivedStore store;
    @Autowired JdbcClient jdbc;
    @Autowired AccountErasureService erasure;

    /** The two sign-in cookies of one device. */
    record Session(Cookie access, Cookie refresh) {}

    private Cookie xsrf;

    @BeforeEach
    void reset() throws Exception {
        clock.set(Instant.now());
        limiter.clear();
        store.clear();
        emails.clear();
        xsrf =
                mvc.perform(get("/api/v1/auth/csrf"))
                        .andReturn()
                        .getResponse()
                        .getCookie("XSRF-TOKEN");
    }

    // ---------- password ----------

    @Test
    void changingThePasswordKeepsThisDeviceAndSignsOutTheOthers() throws Exception {
        String email = confirmedAccount();
        Session here = logIn(email, PASSWORD, CHROME_ON_WINDOWS);
        Session phone = logIn(email, PASSWORD, SAFARI_ON_IPHONE);

        changePassword(here, "Wrong-password1", NEW_PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("wrong_password"))
                .andExpect(jsonPath("$.error.fields.currentPassword").value("wrong_password"));
        changePassword(here, PASSWORD, "abcdefgh")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.newPassword").value("password_too_weak"));
        changePassword(here, PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());

        refresh(phone.refresh()).andExpect(status().isUnauthorized());
        refresh(here.refresh()).andExpect(status().isOk());
        logInRequest(email, PASSWORD, null).andExpect(status().isUnauthorized());
        logInRequest(email, NEW_PASSWORD, null).andExpect(status().isOk());
        assertThat(emails.lastTo(email).orElseThrow().subject()).contains("password was changed");
    }

    @Test
    void fiveWrongPasswordsPauseAccountChanges() throws Exception {
        String email = confirmedAccount();
        Session here = logIn(email, PASSWORD, CHROME_ON_WINDOWS);
        for (int i = 0; i < 5; i++) {
            changePassword(here, "Wrong-password1", NEW_PASSWORD)
                    .andExpect(status().isBadRequest());
        }
        // The pause covers every action that asks for the password, even with the right one.
        deleteAccount(here, PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER))
                .andExpect(jsonPath("$.error.code").value("too_many_attempts"));

        clock.advance(Duration.ofMinutes(10));
        changePassword(here, PASSWORD, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    // ---------- email ----------

    @Test
    void theEmailChangesOnceTheCodeSentToTheNewAddressIsEntered() throws Exception {
        String email = confirmedAccount();
        String taken = confirmedAccount();
        String next = uniqueEmail();
        Session here = logIn(email, PASSWORD, CHROME_ON_WINDOWS);

        confirmEmail(here, "123456")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("code_expired"));
        changeEmail(here, taken, PASSWORD)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("email_taken"));
        changeEmail(here, email.toUpperCase(), PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("same_email"));
        changeEmail(here, next, "Wrong-password1")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.password").value("wrong_password"));
        changeEmail(here, "not-an-email", PASSWORD)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.newEmail").exists());

        changeEmail(here, next, PASSWORD)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.email").value(next))
                .andExpect(jsonPath("$.codeExpiresInSeconds").value(600))
                .andExpect(jsonPath("$.resendAfterSeconds").value(30));
        changeEmail(here, next, PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error.code").value("resend_too_soon"));
        String code = codeSentTo(next);
        confirmEmail(here, code.equals("000000") ? "111111" : "000000")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_code"));
        confirmEmail(here, code)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(next))
                .andExpect(jsonPath("$.emailVerified").value(true));

        mvc.perform(get("/api/v1/me").cookie(here.access()))
                .andExpect(jsonPath("$.email").value(next));
        logInRequest(email, PASSWORD, null).andExpect(status().isUnauthorized());
        logInRequest(next, PASSWORD, null).andExpect(status().isOk());
        assertThat(emails.lastTo(email).orElseThrow().subject()).contains("email was changed");
        // The code was used up.
        confirmEmail(here, code).andExpect(status().isBadRequest());
    }

    // ---------- devices ----------

    @Test
    void devicesAreListedAndCanBeSignedOut() throws Exception {
        String email = confirmedAccount();
        Session here = logIn(email, PASSWORD, CHROME_ON_WINDOWS);
        clock.advance(Duration.ofSeconds(1));
        Session phone = logIn(email, PASSWORD, SAFARI_ON_IPHONE);

        String list =
                devices(here)
                        .andExpect(status().isOk())
                        // The device from the email code, Chrome and the phone; this one first.
                        .andExpect(jsonPath("$.items.length()").value(3))
                        .andExpect(jsonPath("$.items[0].current").value(true))
                        .andExpect(jsonPath("$.items[0].browser").value("Chrome"))
                        .andExpect(jsonPath("$.items[0].system").value("Windows"))
                        .andExpect(jsonPath("$.items[1].current").value(false))
                        .andExpect(jsonPath("$.items[1].browser").value("Safari"))
                        .andExpect(jsonPath("$.items[1].system").value("iPhone"))
                        .andExpect(jsonPath("$.items[2].browser").doesNotExist())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String phoneId = JsonPath.read(list, "$.items[1].id");
        String hereId = JsonPath.read(list, "$.items[0].id");

        signOut(here, phoneId).andExpect(status().isNoContent());
        refresh(phone.refresh()).andExpect(status().isUnauthorized());
        devices(here).andExpect(jsonPath("$.items.length()").value(2));
        signOut(here, phoneId)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("device_not_found"));
        signOut(here, UUID.randomUUID().toString()).andExpect(status().isNotFound());

        // Another account's device cannot be signed out.
        Session other = logIn(confirmedAccount(), PASSWORD, CHROME_ON_WINDOWS);
        String otherId = JsonPath.read(devicesBody(other), "$.items[0].id");
        signOut(here, otherId).andExpect(status().isNotFound());
        refresh(other.refresh()).andExpect(status().isOk());

        // Signing out this device also clears its cookies.
        MockHttpServletResponse signedOut =
                signOut(here, hereId).andExpect(status().isNoContent()).andReturn().getResponse();
        assertThat(signedOut.getCookie(AuthCookies.ACCESS).getMaxAge()).isZero();
        refresh(here.refresh()).andExpect(status().isUnauthorized());
    }

    // ---------- delete account ----------

    @Test
    void aDeletedAccountWaitsThirtyDaysAndLoggingInKeepsIt() throws Exception {
        String email = confirmedAccount();
        Session here = logIn(email, PASSWORD, CHROME_ON_WINDOWS);
        Session phone = logIn(email, PASSWORD, SAFARI_ON_IPHONE);

        deleteAccount(here, "Wrong-password1")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.password").value("wrong_password"));
        assertThat(accountStatus(email)).isEqualTo("ACTIVE");

        MockHttpServletResponse deleted =
                deleteAccount(here, PASSWORD).andExpect(status().isOk()).andReturn().getResponse();
        Instant deleteAfter =
                Instant.parse(JsonPath.read(deleted.getContentAsString(), "$.deleteAfter"));
        assertThat(deleteAfter).isEqualTo(clock.instant().plus(Duration.ofDays(30)));
        assertThat(deleted.getCookie(AuthCookies.ACCESS).getMaxAge()).isZero();
        assertThat(accountStatus(email)).isEqualTo("DELETION_PENDING");
        refresh(here.refresh()).andExpect(status().isUnauthorized());
        refresh(phone.refresh()).andExpect(status().isUnauthorized());
        assertThat(emails.lastTo(email).orElseThrow().subject()).contains("will be deleted");

        clock.advance(Duration.ofDays(29));
        logInRequest(email, PASSWORD, null).andExpect(status().isOk());
        assertThat(accountStatus(email)).isEqualTo("ACTIVE");
        assertThat(
                        jdbc.sql("select deletion_requested_at is null from users where email = :e")
                                .param("e", email)
                                .query(Boolean.class)
                                .single())
                .isTrue();
        assertThat(emails.lastTo(email).orElseThrow().subject()).contains("is staying");
    }

    @Test
    void afterThirtyDaysTheNightlyJobErasesThePersonalDataAndFreesTheEmail() throws Exception {
        String email = confirmedAccount();
        UUID id =
                jdbc.sql("select id from users where email = :e")
                        .param("e", email)
                        .query(UUID.class)
                        .single();
        assertThat(notifications(id)).as("the welcome item").isEqualTo(1);
        Session here = logIn(email, PASSWORD, CHROME_ON_WINDOWS);
        deleteAccount(here, PASSWORD).andExpect(status().isOk());

        clock.advance(Duration.ofDays(29));
        assertThat(erasure.eraseExpired()).as("still in the grace period").isZero();
        assertThat(accountStatus(email)).isEqualTo("DELETION_PENDING");

        clock.advance(Duration.ofDays(1).plusMinutes(1));
        assertThat(erasure.eraseExpired()).isEqualTo(1);
        assertThat(erasure.eraseExpired()).as("a second run changes nothing").isZero();

        long erased =
                jdbc.sql(
                                "select count(*) from users where status = 'DELETED'"
                                        + " and display_name = 'Deleted account'"
                                        + " and password_hash is null"
                                        + " and email like 'deleted-%@deleted.invalid'")
                        .query(Long.class)
                        .single();
        assertThat(erased).isGreaterThanOrEqualTo(1);
        assertThat(notifications(id)).as("the inbox goes with the personal data").isZero();
        assertThat(
                        jdbc.sql("select count(*) from users where lower(email) = :e")
                                .param("e", email)
                                .query(Long.class)
                                .single())
                .as("the old address is gone")
                .isZero();
        // The old address is gone and free again; the old password no longer works.
        logInRequest(email, PASSWORD, null).andExpect(status().isUnauthorized());
        mvc.perform(
                        json(
                                post("/api/v1/auth/signup"),
                                "{\"name\":\"New Owner\",\"email\":\""
                                        + email
                                        + "\",\"password\":\""
                                        + PASSWORD
                                        + "\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void accountActionsNeedASignInAndTheCsrfHeader() throws Exception {
        mvc.perform(get("/api/v1/auth/devices")).andExpect(status().isUnauthorized());
        mvc.perform(
                        json(
                                post("/api/v1/auth/change-password"),
                                "{\"currentPassword\":\"a\",\"newPassword\":\"b\"}"))
                .andExpect(status().isUnauthorized());
        Session here = logIn(confirmedAccount(), PASSWORD, CHROME_ON_WINDOWS);
        mvc.perform(
                        post("/api/v1/auth/delete-account")
                                .cookie(here.access(), here.refresh())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isForbidden());
    }

    // ---------- helpers ----------

    private ResultActions changePassword(Session session, String current, String next)
            throws Exception {
        return mvc.perform(
                json(
                        post("/api/v1/auth/change-password"),
                        "{\"currentPassword\":\""
                                + current
                                + "\",\"newPassword\":\""
                                + next
                                + "\"}",
                        session));
    }

    private ResultActions changeEmail(Session session, String newEmail, String password)
            throws Exception {
        return mvc.perform(
                json(
                        post("/api/v1/auth/change-email"),
                        "{\"newEmail\":\"" + newEmail + "\",\"password\":\"" + password + "\"}",
                        session));
    }

    private ResultActions confirmEmail(Session session, String code) throws Exception {
        return mvc.perform(
                json(
                        post("/api/v1/auth/change-email/confirm"),
                        "{\"code\":\"" + code + "\"}",
                        session));
    }

    private ResultActions devices(Session session) throws Exception {
        return mvc.perform(get("/api/v1/auth/devices").cookie(session.access(), session.refresh()));
    }

    private String devicesBody(Session session) throws Exception {
        return devices(session).andReturn().getResponse().getContentAsString();
    }

    private ResultActions signOut(Session session, String deviceId) throws Exception {
        return mvc.perform(
                withCsrf(delete("/api/v1/auth/devices/" + deviceId))
                        .cookie(session.access(), session.refresh()));
    }

    private ResultActions deleteAccount(Session session, String password) throws Exception {
        return mvc.perform(
                json(
                        post("/api/v1/auth/delete-account"),
                        "{\"password\":\"" + password + "\"}",
                        session));
    }

    private ResultActions refresh(Cookie refreshCookie) throws Exception {
        return mvc.perform(withCsrf(post("/api/v1/auth/refresh")).cookie(refreshCookie));
    }

    /** A confirmed account (signed up and verified with its emailed code). */
    private String confirmedAccount() throws Exception {
        String email = uniqueEmail();
        mvc.perform(
                        json(
                                post("/api/v1/auth/signup"),
                                "{\"name\":\"Sokha Chan\",\"email\":\""
                                        + email
                                        + "\",\"password\":\""
                                        + PASSWORD
                                        + "\"}"))
                .andExpect(status().isCreated());
        mvc.perform(
                        json(
                                post("/api/v1/auth/verify"),
                                "{\"email\":\""
                                        + email
                                        + "\",\"code\":\""
                                        + codeSentTo(email)
                                        + "\"}"))
                .andExpect(status().isOk());
        return email;
    }

    private Session logIn(String email, String password, String userAgent) throws Exception {
        MockHttpServletResponse response =
                logInRequest(email, password, userAgent)
                        .andExpect(status().isOk())
                        .andReturn()
                        .getResponse();
        Cookie access = response.getCookie(AuthCookies.ACCESS);
        Cookie refresh = response.getCookie(AuthCookies.REFRESH);
        assertThat(List.of(access, refresh)).doesNotContainNull();
        return new Session(access, refresh);
    }

    private ResultActions logInRequest(String email, String password, String userAgent)
            throws Exception {
        MockHttpServletRequestBuilder request = post("/api/v1/auth/login");
        if (userAgent != null) {
            request.header(HttpHeaders.USER_AGENT, userAgent);
        }
        return mvc.perform(
                json(
                        request,
                        "{\"email\":\""
                                + email
                                + "\",\"password\":\""
                                + password
                                + "\",\"remember\":true}"));
    }

    private String accountStatus(String email) {
        return jdbc.sql("select status from users where email = :e")
                .param("e", email)
                .query(String.class)
                .single();
    }

    private MockHttpServletRequestBuilder withCsrf(MockHttpServletRequestBuilder request) {
        return request.cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue());
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, String body) {
        return withCsrf(request).contentType(MediaType.APPLICATION_JSON).content(body);
    }

    private MockHttpServletRequestBuilder json(
            MockHttpServletRequestBuilder request, String body, Session session) {
        return json(request, body).cookie(session.access(), session.refresh());
    }

    private String codeSentTo(String email) {
        String subject = emails.lastTo(email).orElseThrow().subject();
        Matcher m = CODE.matcher(subject);
        assertThat(m.find()).as("code in %s", subject).isTrue();
        return m.group(1);
    }

    private long notifications(UUID userId) {
        return jdbc.sql("select count(*) from notifications where user_id = :u")
                .param("u", userId)
                .query(Long.class)
                .single();
    }

    private static String uniqueEmail() {
        return "account-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }
}
