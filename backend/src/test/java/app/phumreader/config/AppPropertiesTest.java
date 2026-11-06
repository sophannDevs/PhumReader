package app.phumreader.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Configuration;

/** The app refuses to start when a required setting is missing, and the error names it. */
class AppPropertiesTest {

    private final ApplicationContextRunner runner =
            new ApplicationContextRunner().withUserConfiguration(PropertiesOnly.class);

    @Test
    void refusesToStartWithoutTheFrontendUrl() {
        runner.run(context -> {
            assertThat(context).hasFailed();
            assertThat(context.getStartupFailure())
                    .rootCause()
                    .hasMessageContaining("phumreader")
                    .hasMessageContaining("frontendUrl");
        });
    }

    @Test
    void refusesAFrontendUrlThatIsNotAUrl() {
        runner.withPropertyValues("phumreader.frontend-url=not a url")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void startsWithAValidFrontendUrl() {
        runner.withPropertyValues("phumreader.frontend-url=http://localhost:3000")
                .run(context ->
                        assertThat(context.getBean(AppProperties.class).frontendUrl())
                                .isEqualTo("http://localhost:3000"));
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(AppProperties.class)
    static class PropertiesOnly {}
}
