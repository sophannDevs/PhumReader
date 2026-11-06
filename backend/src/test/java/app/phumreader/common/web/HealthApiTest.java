package app.phumreader.common.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.support.IntegrationTest;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class HealthApiTest {

    private static final String UUID_PATTERN =
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

    @Autowired MockMvc mvc;

    @Test
    void reportsApiAndDatabaseUpWithoutLogin() throws Exception {
        mvc.perform(get("/api/v1/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("UP"))
                .andExpect(
                        header().string(
                                        RequestIdFilter.HEADER,
                                        Matchers.matchesPattern(UUID_PATTERN)));
    }

    @Test
    void keepsTheCallersRequestIdWhenItIsSafe() throws Exception {
        mvc.perform(get("/api/v1/health").header(RequestIdFilter.HEADER, "web-123.abc"))
                .andExpect(header().string(RequestIdFilter.HEADER, "web-123.abc"));
    }

    @Test
    void replacesAnUnsafeRequestId() throws Exception {
        mvc.perform(get("/api/v1/health").header(RequestIdFilter.HEADER, "bad id <script>"))
                .andExpect(
                        header().string(
                                        RequestIdFilter.HEADER,
                                        Matchers.matchesPattern(UUID_PATTERN)));
    }

    @Test
    void actuatorHealthIsUp() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
