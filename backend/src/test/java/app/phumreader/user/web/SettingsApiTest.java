package app.phumreader.user.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/**
 * Settings: profile name, language, appearance, reader defaults, notifications (plan P3-17) and the
 * alert settings per type, quiet hours and digest (V21-03).
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class SettingsApiTest {

    @Autowired MockMvc mvc;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;

    @BeforeEach
    void demo() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        sessions = new Sessions(jwt, jdbc);
    }

    @Test
    void theDemoReaderStartsWithTheWebsiteDefaults() throws Exception {
        UUID demoReader = sessions.userId("reader@phumireader.app");
        mvc.perform(get("/api/v1/me/settings").with(sessions.as(demoReader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.language").value("en"))
                .andExpect(jsonPath("$.theme").value("system"))
                .andExpect(jsonPath("$.reader.size").value(18))
                .andExpect(jsonPath("$.reader.theme").value("light"))
                .andExpect(jsonPath("$.reader.font").value("sans"))
                .andExpect(jsonPath("$.reader.wide").value(true))
                .andExpect(jsonPath("$.notifications.episodes").value(true))
                .andExpect(jsonPath("$.notifications.fastPass").value(true))
                // The website's alert defaults (src/lib/store.ts defaultNotifPrefs).
                .andExpect(jsonPath("$.notifications.types.update.push").value(true))
                .andExpect(jsonPath("$.notifications.types.update.email").value(false))
                .andExpect(jsonPath("$.notifications.types.comment.push").value(true))
                .andExpect(jsonPath("$.notifications.types.comment.email").value(false))
                .andExpect(jsonPath("$.notifications.types.coins.push").value(true))
                .andExpect(jsonPath("$.notifications.types.coins.email").value(true))
                .andExpect(jsonPath("$.notifications.types.fastpass.push").value(true))
                .andExpect(jsonPath("$.notifications.types.fastpass.email").value(false))
                .andExpect(jsonPath("$.notifications.types.news.push").value(false))
                .andExpect(jsonPath("$.notifications.types.news.email").value(false))
                .andExpect(jsonPath("$.notifications.quiet.on").value(true))
                .andExpect(jsonPath("$.notifications.quiet.from").value(22))
                .andExpect(jsonPath("$.notifications.quiet.to").value(7))
                .andExpect(jsonPath("$.notifications.digest").value(false));
    }

    @Test
    void theAlertSettingsAreSavedPerTypeAndTheOlderSwitchesFollowThem() throws Exception {
        UUID reader = sessions.newReader("Dara");
        // No settings row yet: the defaults, the same as a new account's.
        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(jsonPath("$.notifications.types.coins.email").value(true))
                .andExpect(jsonPath("$.notifications.quiet.from").value(22));

        save(
                        reader,
                        "{\"notifications\":{\"types\":{\"update\":{\"email\":true},"
                                + "\"comment\":{\"push\":false},\"news\":{\"push\":true,\"email\":true}},"
                                + "\"quiet\":{\"from\":23},\"digest\":true}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notifications.types.update.push").value(true))
                .andExpect(jsonPath("$.notifications.types.update.email").value(true))
                .andExpect(jsonPath("$.notifications.types.comment.push").value(false))
                .andExpect(jsonPath("$.notifications.types.comment.email").value(false))
                .andExpect(jsonPath("$.notifications.types.news.push").value(true))
                .andExpect(jsonPath("$.notifications.types.news.email").value(true))
                .andExpect(jsonPath("$.notifications.quiet.on").value(true))
                .andExpect(jsonPath("$.notifications.quiet.from").value(23))
                .andExpect(jsonPath("$.notifications.quiet.to").value(7))
                .andExpect(jsonPath("$.notifications.digest").value(true));

        // "episodes" and "fastPass" are the push switches of update and fastpass, both ways.
        save(reader, "{\"notifications\":{\"episodes\":false,\"fastPass\":false}}")
                .andExpect(jsonPath("$.notifications.types.update.push").value(false))
                .andExpect(jsonPath("$.notifications.types.update.email").value(true))
                .andExpect(jsonPath("$.notifications.types.fastpass.push").value(false));
        save(
                        reader,
                        "{\"notifications\":{\"types\":{\"update\":{\"push\":true},"
                                + "\"fastpass\":{\"push\":true,\"email\":true}},"
                                + "\"quiet\":{\"on\":false,\"from\":0,\"to\":23}}}")
                .andExpect(jsonPath("$.notifications.episodes").value(true))
                .andExpect(jsonPath("$.notifications.fastPass").value(true));
        // Sent together, "types" wins.
        save(
                        reader,
                        "{\"notifications\":{\"episodes\":true,"
                                + "\"types\":{\"update\":{\"push\":false}}}}")
                .andExpect(jsonPath("$.notifications.episodes").value(false));

        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(jsonPath("$.notifications.episodes").value(false))
                .andExpect(jsonPath("$.notifications.fastPass").value(true))
                .andExpect(jsonPath("$.notifications.types.update.push").value(false))
                .andExpect(jsonPath("$.notifications.types.update.email").value(true))
                .andExpect(jsonPath("$.notifications.types.fastpass.email").value(true))
                .andExpect(jsonPath("$.notifications.types.comment.push").value(false))
                .andExpect(jsonPath("$.notifications.types.coins.push").value(true))
                .andExpect(jsonPath("$.notifications.types.coins.email").value(true))
                .andExpect(jsonPath("$.notifications.types.news.email").value(true))
                .andExpect(jsonPath("$.notifications.quiet.on").value(false))
                .andExpect(jsonPath("$.notifications.quiet.from").value(0))
                .andExpect(jsonPath("$.notifications.quiet.to").value(23))
                .andExpect(jsonPath("$.notifications.digest").value(true))
                // Other settings were left alone.
                .andExpect(jsonPath("$.reader.size").value(18))
                .andExpect(jsonPath("$.language").value("en"));
    }

    @Test
    void quietHoursMustBeHoursOfTheDay() throws Exception {
        UUID reader = sessions.newReader("Dara");
        save(reader, "{\"notifications\":{\"quiet\":{\"from\":24}}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("validation_failed"))
                .andExpect(jsonPath("$.error.fields['notifications.quiet.from']").exists());
        save(reader, "{\"notifications\":{\"quiet\":{\"to\":-1}}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields['notifications.quiet.to']").exists());
        save(reader, "{\"notifications\":{\"types\":{\"update\":{\"push\":\"maybe\"}}}}")
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(jsonPath("$.notifications.quiet.from").value(22))
                .andExpect(jsonPath("$.notifications.quiet.to").value(7));
    }

    @Test
    void onlyTheFieldsSentChangeAndTheyAreThereOnReload() throws Exception {
        // A reader without a settings row reads the defaults and gets one on the first save.
        UUID reader = sessions.newReader("Dara");
        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(jsonPath("$.reader.size").value(18));

        save(reader, "{\"language\":\"km\",\"reader\":{\"size\":22,\"theme\":\"sepia\"}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.language").value("km"))
                .andExpect(jsonPath("$.reader.size").value(22))
                .andExpect(jsonPath("$.reader.theme").value("sepia"))
                .andExpect(jsonPath("$.reader.font").value("sans"));
        save(
                        reader,
                        "{\"theme\":\"dark\",\"reader\":{\"font\":\"serif\",\"wide\":false},"
                                + "\"notifications\":{\"fastPass\":true}}")
                .andExpect(status().isOk());

        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(jsonPath("$.language").value("km"))
                .andExpect(jsonPath("$.theme").value("dark"))
                .andExpect(jsonPath("$.reader.size").value(22))
                .andExpect(jsonPath("$.reader.theme").value("sepia"))
                .andExpect(jsonPath("$.reader.font").value("serif"))
                .andExpect(jsonPath("$.reader.wide").value(false))
                .andExpect(jsonPath("$.notifications.episodes").value(true))
                .andExpect(jsonPath("$.notifications.fastPass").value(true));
    }

    @Test
    void settingsAreChecked() throws Exception {
        UUID reader = sessions.newReader("Dara");
        save(reader, "{\"reader\":{\"size\":15}}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_text_size"))
                .andExpect(jsonPath("$.error.fields['reader.size']").value("invalid_text_size"));
        save(reader, "{\"theme\":\"purple\"}").andExpect(status().isBadRequest());
        save(reader, "{\"language\":\"fr\"}").andExpect(status().isBadRequest());

        mvc.perform(get("/api/v1/me/settings")).andExpect(status().isUnauthorized());
        mvc.perform(
                        patch("/api/v1/me/settings")
                                .with(sessions.withoutCsrf(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"theme\":\"dark\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(jsonPath("$.theme").value("system"))
                .andExpect(jsonPath("$.reader.size").value(18));
    }

    @Test
    void theDisplayNameCanBeChanged() throws Exception {
        UUID reader = sessions.newReader("Dara");
        rename(reader, "  Sokha Chan  ")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Sokha Chan"));
        mvc.perform(get("/api/v1/me").with(sessions.as(reader)))
                .andExpect(jsonPath("$.displayName").value("Sokha Chan"));

        rename(reader, " S ")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.displayName").value("name_too_short"));
        rename(reader, "x".repeat(61))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.displayName").exists());
        rename(reader, "").andExpect(status().isBadRequest());
    }

    private ResultActions save(UUID user, String body) throws Exception {
        return mvc.perform(
                patch("/api/v1/me/settings")
                        .with(sessions.as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private ResultActions rename(UUID user, String name) throws Exception {
        return mvc.perform(
                patch("/api/v1/me/profile")
                        .with(sessions.as(user))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"displayName\":\"" + name + "\"}"));
    }
}
