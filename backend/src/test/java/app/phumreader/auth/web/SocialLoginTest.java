package app.phumreader.auth.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.SocialClient;
import app.phumreader.auth.service.SocialLoginException;
import app.phumreader.auth.service.SocialProfile;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.user.domain.SocialProvider;
import app.phumreader.user.domain.User;
import app.phumreader.user.repository.UserRepository;
import app.phumreader.user.service.UserService;
import jakarta.servlet.http.Cookie;
import java.net.URI;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

/** Google and Facebook login through the real endpoints, with a fake Google (no network). */
@IntegrationTest
@Import({AuthTestConfig.class, SocialLoginTest.FakeGoogleConfig.class})
class SocialLoginTest {

    /** Answers like Google: {@code code=bad} fails; otherwise the profile set by the test. */
    static class FakeGoogle implements SocialClient {
        volatile SocialProfile profile;

        @Override
        public SocialProvider provider() {
            return SocialProvider.GOOGLE;
        }

        @Override
        public boolean configured() {
            return true;
        }

        @Override
        public URI authorizeUri(String state, String redirectUri) {
            return URI.create("https://accounts.example/auth?state=" + state);
        }

        @Override
        public SocialProfile fetchProfile(String code, String redirectUri) {
            if (code.equals("bad")) {
                throw new SocialLoginException("refused");
            }
            return profile;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class FakeGoogleConfig {
        @Bean
        @Order(Ordered.HIGHEST_PRECEDENCE)
        FakeGoogle fakeGoogle() {
            return new FakeGoogle();
        }
    }

    private static final Pattern STATE = Pattern.compile("state=([^&]+)");

    @Autowired MockMvc mvc;
    @Autowired FakeGoogle google;
    @Autowired UserService users;
    @Autowired UserRepository userRepository;
    @Autowired RateLimiter limiter;
    @Autowired ShortLivedStore store;

    @BeforeEach
    void reset() {
        limiter.clear();
        store.clear();
    }

    @Test
    void aNewPersonGetsAnAccountWithoutAPasswordAndIsSignedIn() throws Exception {
        String email = uniqueEmail();
        google.profile = profile("g-" + UUID.randomUUID(), email, true, "Sokha Chan");

        MockHttpServletResponse back = signInWithGoogle("km");

        assertThat(back.getRedirectedUrl()).isEqualTo("http://localhost:3000/km/login?social=done");
        mvc.perform(get("/api/v1/me").cookie(back.getCookie("phumreader_at")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.displayName").value("Sokha Chan"))
                .andExpect(jsonPath("$.emailVerified").value(true));
        User user = userRepository.findByEmail(email).orElseThrow();
        assertThat(user.getPasswordHash()).isNull();
        assertThat(back.getCookie("phumreader_at").isHttpOnly()).isTrue();
        assertThat(back.getCookie("phumreader_rt").isHttpOnly()).isTrue();
    }

    @Test
    void aReturningPersonSignsInToTheSameAccountEvenAfterChangingTheirGoogleEmail()
            throws Exception {
        String subject = "g-" + UUID.randomUUID();
        String email = uniqueEmail();
        google.profile = profile(subject, email, true, "Dara");
        signInWithGoogle("en");
        UUID first = userRepository.findByEmail(email).orElseThrow().getId();

        google.profile = profile(subject, uniqueEmail(), true, "Dara");
        MockHttpServletResponse back = signInWithGoogle("en");

        assertThat(back.getRedirectedUrl()).isEqualTo("http://localhost:3000/login?social=done");
        mvc.perform(get("/api/v1/me").cookie(back.getCookie("phumreader_at")))
                .andExpect(jsonPath("$.id").value(first.toString()));
    }

    @Test
    void aVerifiedEmailLinksToTheExistingAccount() throws Exception {
        String email = uniqueEmail();
        User existing = users.createReader(email, "Vanna", "hash", "en");
        users.markEmailVerified(existing);
        userRepository.saveAndFlush(existing);
        google.profile = profile("g-" + UUID.randomUUID(), email, true, "Someone Else");

        MockHttpServletResponse back = signInWithGoogle("en");

        mvc.perform(get("/api/v1/me").cookie(back.getCookie("phumreader_at")))
                .andExpect(jsonPath("$.id").value(existing.getId().toString()))
                .andExpect(jsonPath("$.displayName").value("Vanna"));
        assertThat(userRepository.findByEmail(email).orElseThrow().getPasswordHash())
                .as("a confirmed account keeps its password")
                .isEqualTo("hash");
    }

    @Test
    void linkingToAnUnconfirmedSignUpDropsThePasswordSomeoneElseTyped() throws Exception {
        String email = uniqueEmail();
        users.createReader(email, "Squatter", "squatters-hash", "en");
        google.profile = profile("g-" + UUID.randomUUID(), email, true, "Real Owner");

        signInWithGoogle("en");

        User user = userRepository.findByEmail(email).orElseThrow();
        assertThat(user.getPasswordHash()).isNull();
        assertThat(user.isEmailVerified()).isTrue();
    }

    @Test
    void anEmailTheProviderHasNotConfirmedIsRefusedAndNeverLinked() throws Exception {
        String email = uniqueEmail();
        users.createReader(email, "Vanna", "hash", "en");
        google.profile = profile("g-" + UUID.randomUUID(), email, false, "Vanna");

        MockHttpServletResponse back = signInWithGoogle("en");

        assertThat(back.getRedirectedUrl()).endsWith("/login?social=social_email_unverified");
        assertThat(back.getCookie("phumreader_at")).isNull();
    }

    @Test
    void aProfileWithoutAnEmailIsRefused() throws Exception {
        google.profile = profile("g-" + UUID.randomUUID(), null, false, "No Email");

        assertThat(signInWithGoogle("en").getRedirectedUrl())
                .endsWith("/login?social=social_no_email");
    }

    @Test
    void aBannedAccountIsRefused() throws Exception {
        String email = uniqueEmail();
        User existing = users.createReader(email, "Banned", "hash", "en");
        users.markEmailVerified(existing);
        userRepository.saveAndFlush(existing);
        users.ban(existing.getId());
        google.profile = profile("g-" + UUID.randomUUID(), email, true, "Banned");

        MockHttpServletResponse back = signInWithGoogle("en");

        assertThat(back.getRedirectedUrl()).endsWith("/login?social=account_banned");
        assertThat(back.getCookie("phumreader_at")).isNull();
    }

    @Test
    void theProviderRefusingTheCodeShowsAGenericFailure() throws Exception {
        Started started = start("google", "en");

        MockHttpServletResponse back = callback("google", "bad", started.state(), started.cookie());

        assertThat(back.getRedirectedUrl()).endsWith("/login?social=social_failed");
        assertThat(back.getCookie("phumreader_at")).isNull();
    }

    @Test
    void pressingCancelAtTheProviderComesBackAsCancelled() throws Exception {
        Started started = start("google", "km");

        MockHttpServletResponse back =
                mvc.perform(
                                get("/api/v1/auth/oauth/google/callback")
                                        .param("error", "access_denied")
                                        .param("state", started.state())
                                        .cookie(started.cookie()))
                        .andReturn()
                        .getResponse();

        assertThat(back.getRedirectedUrl())
                .isEqualTo("http://localhost:3000/km/login?social=cancelled");
    }

    @Test
    void aStateFromAnotherBrowserOrUsedTwiceIsRefused() throws Exception {
        google.profile = profile("g-" + UUID.randomUUID(), uniqueEmail(), true, "Dara");
        Started started = start("google", "en");

        // The attacker's link, opened in a browser that never started the sign-in.
        MockHttpServletResponse foreign =
                mvc.perform(
                                get("/api/v1/auth/oauth/google/callback")
                                        .param("code", "c")
                                        .param("state", started.state()))
                        .andReturn()
                        .getResponse();
        assertThat(foreign.getRedirectedUrl()).endsWith("/login?social=social_failed");
        assertThat(foreign.getCookie("phumreader_at")).isNull();

        // The foreign attempt did not use the state up; the right browser still can, once.
        MockHttpServletResponse first = callback("google", "c", started.state(), started.cookie());
        assertThat(first.getRedirectedUrl()).endsWith("/login?social=done");
        MockHttpServletResponse reused = callback("google", "c", started.state(), started.cookie());
        assertThat(reused.getRedirectedUrl()).endsWith("/login?social=social_failed");
    }

    @Test
    void aProviderWithoutCredentialsAnswersUnavailable() throws Exception {
        MockHttpServletResponse response =
                mvc.perform(get("/api/v1/auth/oauth/facebook/start").param("locale", "km"))
                        .andReturn()
                        .getResponse();

        assertThat(response.getRedirectedUrl())
                .isEqualTo("http://localhost:3000/km/login?social=unavailable");
        assertThat(response.getCookie("phumreader_oauth")).isNull();
    }

    @Test
    void startRedirectsToTheProviderWithAStateAndAnHttpOnlyCookie() throws Exception {
        Started started = start("google", "en");

        assertThat(started.cookie().getValue()).isEqualTo(started.state());
        assertThat(started.cookie().isHttpOnly()).isTrue();
        assertThat(started.cookie().getPath()).isEqualTo("/api/v1/auth/oauth");
    }

    @Test
    void aSocialOnlyAccountCannotLogInWithAPassword() throws Exception {
        String email = uniqueEmail();
        google.profile = profile("g-" + UUID.randomUUID(), email, true, "Dara");
        signInWithGoogle("en");

        Cookie xsrf =
                mvc.perform(get("/api/v1/auth/csrf"))
                        .andReturn()
                        .getResponse()
                        .getCookie("XSRF-TOKEN");
        mvc.perform(
                        post("/api/v1/auth/login")
                                .cookie(xsrf)
                                .header("X-XSRF-TOKEN", xsrf.getValue())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"email\":\""
                                                + email
                                                + "\",\"password\":\"Toonwave1!\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("invalid_credentials"));
    }

    // ---------- helpers ----------

    record Started(String state, Cookie cookie) {}

    private Started start(String provider, String locale) throws Exception {
        MockHttpServletResponse response =
                mvc.perform(
                                get("/api/v1/auth/oauth/" + provider + "/start")
                                        .param("locale", locale))
                        .andReturn()
                        .getResponse();
        assertThat(response.getStatus()).isEqualTo(302);
        Matcher state = STATE.matcher(response.getRedirectedUrl());
        assertThat(state.find()).as("state in " + response.getRedirectedUrl()).isTrue();
        return new Started(state.group(1), response.getCookie("phumreader_oauth"));
    }

    private MockHttpServletResponse callback(
            String provider, String code, String state, Cookie cookie) throws Exception {
        return mvc.perform(
                        get("/api/v1/auth/oauth/" + provider + "/callback")
                                .param("code", code)
                                .param("state", state)
                                .cookie(cookie))
                .andReturn()
                .getResponse();
    }

    private MockHttpServletResponse signInWithGoogle(String locale) throws Exception {
        Started started = start("google", locale);
        return callback("google", "good-code", started.state(), started.cookie());
    }

    private static SocialProfile profile(
            String subject, String email, boolean verified, String name) {
        return new SocialProfile(SocialProvider.GOOGLE, subject, email, verified, name);
    }

    private static String uniqueEmail() {
        return "social-" + UUID.randomUUID() + "@example.com";
    }
}
