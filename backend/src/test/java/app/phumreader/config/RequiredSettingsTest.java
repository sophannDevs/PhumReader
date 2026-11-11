package app.phumreader.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class RequiredSettingsTest {

    @Test
    void namesEveryMissingDatabaseSetting() {
        MockEnvironment environment = new MockEnvironment().withProperty("DB_USER", "postgres");

        assertThatThrownBy(() -> RequiredSettings.check(environment))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DB_URL")
                .hasMessageContaining("DB_PASSWORD")
                .hasMessageNotContaining("DB_USER")
                .hasMessageContaining("backend/.env.example");
    }

    @Test
    void treatsBlankValuesAsMissing() {
        MockEnvironment environment =
                new MockEnvironment()
                        .withProperty("DB_URL", "  ")
                        .withProperty("DB_USER", "postgres")
                        .withProperty("DB_PASSWORD", "secret");

        assertThatThrownBy(() -> RequiredSettings.check(environment))
                .hasMessageContaining("DB_URL");
    }

    @Test
    void passesWhenAllAreSet() {
        MockEnvironment environment =
                new MockEnvironment()
                        .withProperty("DB_URL", "jdbc:postgresql://localhost:5432/postgres")
                        .withProperty("DB_USER", "postgres")
                        .withProperty("DB_PASSWORD", "secret");

        assertThatCode(() -> RequiredSettings.check(environment)).doesNotThrowAnyException();
    }
}
