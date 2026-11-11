package app.phumreader.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import app.phumreader.auth.service.JwtService;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.Sessions;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

/**
 * Security rules checked against every endpoint the API has (P6-01): the list is read from the
 * running application, so a new endpoint is covered the day it is added. Signed out, anything that
 * is not on the public lists answers 401; a reader gets 403 on {@code /admin/**}; a write without
 * the CSRF header is refused.
 */
@IntegrationTest
class SecurityRulesTest {

    /** Endpoints that are not a plain "needs a session" rule; each has its own tests. */
    private static final Set<String> OWN_RULES =
            Set.of(
                    // PayWay signs this call itself: no cookie and no CSRF.
                    "POST /api/v1/payments/payway/callback");

    private final AntPathMatcher paths = new AntPathMatcher();

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    RequestMappingHandlerMapping mappings;

    Sessions sessions;

    record Endpoint(HttpMethod method, String pattern) {
        String path() {
            return pattern.replaceAll("\\{[^/}]+}", UUID.randomUUID().toString());
        }

        @Override
        public String toString() {
            return method + " " + pattern;
        }
    }

    @BeforeEach
    void setUp() {
        sessions = new Sessions(jwt, jdbc);
    }

    @Test
    void theApplicationHasEndpointsToCheck() {
        assertThat(endpoints()).hasSizeGreaterThan(80);
    }

    @Test
    void signedOutAnythingOffThePublicListsIsRefusedWith401() throws Exception {
        List<String> wrong = new ArrayList<>();
        int checked = 0;
        for (Endpoint e : endpoints()) {
            if (isPublic(e) || OWN_RULES.contains(e.toString())) {
                continue;
            }
            checked++;
            int status =
                    mvc.perform(
                                    request(e.method(), e.path())
                                            .with(sessions.guest())
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content("{}"))
                            .andReturn()
                            .getResponse()
                            .getStatus();
            if (status != 401) {
                wrong.add(e + " -> " + status);
            }
        }
        assertThat(checked).isGreaterThan(50);
        assertThat(wrong).as("endpoints that answered something other than 401").isEmpty();
    }

    @Test
    void aReaderCannotUseTheAdminEndpoints() throws Exception {
        UUID reader = sessions.newReader("Plain Reader");
        List<String> wrong = new ArrayList<>();
        int checked = 0;
        for (Endpoint e : endpoints()) {
            if (!paths.match("/api/v1/admin/**", e.path())) {
                continue;
            }
            checked++;
            int status =
                    mvc.perform(
                                    request(e.method(), e.path())
                                            .with(sessions.as(reader))
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content("{}"))
                            .andReturn()
                            .getResponse()
                            .getStatus();
            if (status != 403) {
                wrong.add(e + " -> " + status);
            }
        }
        assertThat(checked).isGreaterThan(15);
        assertThat(wrong).as("admin endpoints that did not answer 403").isEmpty();
    }

    @Test
    void aSignedInWriteWithoutTheCsrfHeaderIsRefused() throws Exception {
        UUID reader = sessions.newReader("Csrf Reader");
        List<String> wrong = new ArrayList<>();
        int checked = 0;
        for (Endpoint e : endpoints()) {
            if (e.method() == HttpMethod.GET || OWN_RULES.contains(e.toString())) {
                continue;
            }
            checked++;
            int status =
                    mvc.perform(
                                    request(e.method(), e.path())
                                            .with(sessions.withoutCsrf(reader))
                                            .contentType(MediaType.APPLICATION_JSON)
                                            .content("{}"))
                            .andReturn()
                            .getResponse()
                            .getStatus();
            if (status != 403) {
                wrong.add(e + " -> " + status);
            }
        }
        assertThat(checked).isGreaterThan(40);
        assertThat(wrong).as("writes accepted without CSRF").isEmpty();
    }

    @Test
    void thePublicCatalogAnswersWithoutASession() throws Exception {
        for (String path :
                List.of(
                        "/api/v1/home",
                        "/api/v1/genres",
                        "/api/v1/series",
                        "/api/v1/coins/packs")) {
            int status =
                    mvc.perform(request(HttpMethod.GET, path))
                            .andReturn()
                            .getResponse()
                            .getStatus();
            assertThat(status).as(path).isEqualTo(200);
        }
    }

    // ---------- helpers ----------

    private boolean isPublic(Endpoint e) {
        String[] list =
                e.method() == HttpMethod.GET
                        ? SecurityConfig.PUBLIC_GET
                        : e.method() == HttpMethod.POST
                                ? SecurityConfig.PUBLIC_POST
                                : new String[0];
        for (String pattern : list) {
            if (paths.match(pattern, e.path())) {
                return true;
            }
        }
        return false;
    }

    private List<Endpoint> endpoints() {
        List<Endpoint> found = new ArrayList<>();
        for (RequestMappingInfo info : mappings.getHandlerMethods().keySet()) {
            if (info.getPathPatternsCondition() == null) {
                continue;
            }
            for (String pattern : info.getPathPatternsCondition().getPatternValues()) {
                if (!pattern.startsWith("/api/v1/")) {
                    continue;
                }
                for (RequestMethod method : info.getMethodsCondition().getMethods()) {
                    found.add(new Endpoint(HttpMethod.valueOf(method.name()), pattern));
                }
            }
        }
        return found;
    }
}
