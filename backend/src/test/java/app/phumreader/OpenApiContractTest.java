package app.phumreader;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.support.IntegrationTest;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Keeps {@code backend/openapi/openapi.json} in step with the code. {@code ./gradlew exportOpenApi}
 * rewrites the file; {@code ./gradlew check} fails while it is out of date. The website generates
 * its TypeScript types from it ({@code npm run api:gen}).
 */
@IntegrationTest
class OpenApiContractTest {

    @Autowired MockMvc mvc;

    @Test
    void committedContractMatchesTheCode() throws Exception {
        String actual =
                normalize(
                        mvc.perform(get("/v3/api-docs"))
                                .andExpect(status().isOk())
                                .andReturn()
                                .getResponse()
                                .getContentAsString(StandardCharsets.UTF_8));
        Path file = Path.of(System.getProperty("openapi.file", "openapi/openapi.json"));

        if (Boolean.getBoolean("openapi.write")) {
            Files.createDirectories(file.getParent());
            Files.writeString(file, actual, StandardCharsets.UTF_8);
            return;
        }

        assertThat(file).as("Run ./gradlew exportOpenApi to create %s", file).exists();
        assertThat(actual)
                .as(
                        "openapi/openapi.json is out of date: run ./gradlew exportOpenApi, then npm"
                                + " run api:gen, and commit both files")
                .isEqualTo(normalize(Files.readString(file, StandardCharsets.UTF_8)));
    }

    private static String normalize(String json) {
        return json.replace("\r\n", "\n").strip() + "\n";
    }
}
