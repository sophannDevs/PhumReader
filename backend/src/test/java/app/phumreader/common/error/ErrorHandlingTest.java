package app.phumreader.common.error;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.common.web.RequestIdFilter;
import app.phumreader.support.IntegrationTest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Every error uses the shared body {@code {"error": {"code", "message", "fields"?}}}. */
@IntegrationTest
@Import(ErrorHandlingTest.ProbeController.class)
class ErrorHandlingTest {

    private static final String PROBE = "/api/v1/test-probe";

    @Autowired MockMvc mvc;

    @Test
    void guestGets401WithTheSharedBodyAndARequestId() throws Exception {
        mvc.perform(get(PROBE + "/missing"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("unauthorized"))
                .andExpect(jsonPath("$.error.message").isNotEmpty())
                .andExpect(header().exists(RequestIdFilter.HEADER));
    }

    @Test
    @WithMockUser
    void apiExceptionKeepsItsStatusAndCode() throws Exception {
        mvc.perform(get(PROBE + "/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("series_not_found"))
                .andExpect(jsonPath("$.error.fields").doesNotExist());
    }

    @Test
    @WithMockUser
    void invalidBodyListsTheFields() throws Exception {
        mvc.perform(
                        post(PROBE + "/echo")
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\": \" \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("validation_failed"))
                .andExpect(jsonPath("$.error.fields.name").isNotEmpty());
    }

    @Test
    @WithMockUser
    void malformedJsonIs400() throws Exception {
        mvc.perform(
                        post(PROBE + "/echo")
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\": "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("malformed_request"));
    }

    @Test
    @WithMockUser
    void writeWithoutCsrfTokenIs403() throws Exception {
        mvc.perform(
                        post(PROBE + "/echo")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\": \"Sokha\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error.code").value("invalid_csrf_token"));
    }

    @Test
    @WithMockUser
    void writeWithCsrfTokenSucceeds() throws Exception {
        mvc.perform(
                        post(PROBE + "/echo")
                                .with(csrf())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"name\": \"Sokha\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Sokha"));
    }

    @Test
    @WithMockUser
    void wrongAndMissingParametersAre400() throws Exception {
        mvc.perform(get(PROBE + "/number").param("value", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_parameter"))
                .andExpect(jsonPath("$.error.fields.value").isNotEmpty());
        mvc.perform(get(PROBE + "/number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("missing_parameter"));
    }

    @Test
    @WithMockUser
    void unknownAddressIs404() throws Exception {
        mvc.perform(get("/api/v1/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error.code").value("not_found"));
    }

    @Test
    @WithMockUser
    void wrongMethodIs405() throws Exception {
        mvc.perform(delete(PROBE + "/missing").with(csrf()))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error.code").value("method_not_allowed"));
    }

    @Test
    @WithMockUser
    void unexpectedErrorIs500AndHidesTheDetails() throws Exception {
        mvc.perform(get(PROBE + "/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error.code").value("internal_error"))
                .andExpect(
                        jsonPath("$.error.message")
                                .value(Matchers.not(Matchers.containsString("secret"))));
    }

    /** Test-only endpoints. Nested in the test class, so other tests never load them. */
    @RestController
    @RequestMapping(PROBE)
    static class ProbeController {

        record NameRequest(@NotBlank String name) {}

        @PostMapping("/echo")
        NameRequest echo(@Valid @RequestBody NameRequest request) {
            return request;
        }

        @GetMapping("/missing")
        void missing() {
            throw ApiException.notFound("series_not_found", "This series does not exist.");
        }

        @GetMapping("/number")
        int number(@RequestParam int value) {
            return value;
        }

        @GetMapping("/boom")
        void boom() {
            throw new IllegalStateException("secret detail");
        }
    }
}
