package app.phumreader.config;

import java.util.List;
import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;

/**
 * Stops the API at start-up, before any other bean, when a database setting is missing, and names
 * it. Without this, an unset {@code DB_URL} reaches the connection pool as the text {@code
 * ${DB_URL}} and the driver only says "'url' must start with jdbc". Runs for the {@code dev} and
 * {@code prod} profiles; tests bring their own database.
 */
@Configuration(proxyBeanMethods = false)
@Profile({"dev", "prod"})
class RequiredSettings {

    /** The names as they appear in {@code backend/.env} or the process environment. */
    static final List<String> REQUIRED = List.of("DB_URL", "DB_USER", "DB_PASSWORD");

    @Bean
    static BeanFactoryPostProcessor requiredSettingsCheck(Environment environment) {
        return beanFactory -> check(environment);
    }

    static void check(Environment environment) {
        List<String> missing =
                REQUIRED.stream()
                        .filter(name -> {
                            String value = environment.getProperty(name);
                            return value == null || value.isBlank();
                        })
                        .toList();
        if (!missing.isEmpty()) {
            throw new IllegalStateException(
                    "Missing required setting(s): "
                            + String.join(", ", missing)
                            + ". Copy backend/.env.example to backend/.env and fill them in"
                            + " (see backend/README.md), or set them as environment variables.");
        }
    }
}
