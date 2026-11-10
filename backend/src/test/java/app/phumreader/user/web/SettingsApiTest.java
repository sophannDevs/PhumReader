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

/** Settings: profile name, language, appearance, reader defaults, notifications (plan P3-17). */
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
                .andExpect(jsonPath("$.notifications.fastPass").value(false));
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
