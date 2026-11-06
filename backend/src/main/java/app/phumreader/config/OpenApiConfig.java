package app.phumreader.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI description of the API. It is written to {@code backend/openapi/openapi.json} by {@code
 * ./gradlew exportOpenApi}; the website generates its TypeScript types from that file ({@code npm
 * run api:gen}).
 */
@Configuration
class OpenApiConfig {

    @Bean
    OpenAPI phumReaderOpenApi() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("PhumReader API")
                                .version("v1")
                                .description(
                                        "Backend for PhumReader. Errors always use the"
                                                + " ErrorResponse body."))
                // The website calls the API on its own origin (/api is rewritten to the backend).
                .servers(List.of(new Server().url("/").description("Same origin as the website")));
    }
}
