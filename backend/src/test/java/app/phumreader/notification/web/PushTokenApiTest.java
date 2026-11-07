package app.phumreader.notification.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.Sessions;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.annotation.Transactional;

@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class PushTokenApiTest {

    private static final String URL = "/api/v1/me/push-token";

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;

    Sessions sessions;
    UUID dara;
    UUID sokha;

    @BeforeEach
    void readers() {
        sessions = new Sessions(jwt, jdbc);
        dara = sessions.newReader("Dara");
        sokha = sessions.newReader("Sokha");
    }

    @Test
    void aBrowserRegistersAndForgetsItsToken() throws Exception {
        call(put(URL), sessions.as(dara), "tok-1").andExpect(status().isNoContent());
        call(put(URL), sessions.as(dara), "tok-1").andExpect(status().isNoContent());
        call(put(URL), sessions.as(dara), "tok-2").andExpect(status().isNoContent());
        assertThat(tokensOf(dara)).containsExactlyInAnyOrder("tok-1", "tok-2");

        call(delete(URL), sessions.as(dara), "tok-1").andExpect(status().isNoContent());
        assertThat(tokensOf(dara)).containsExactly("tok-2");
    }

    @Test
    void aTokenMovesToTheAccountThatSignedInOnThatBrowserLast() throws Exception {
        call(put(URL), sessions.as(dara), "shared-browser").andExpect(status().isNoContent());
        call(put(URL), sessions.as(sokha), "shared-browser").andExpect(status().isNoContent());

        assertThat(tokensOf(dara)).isEmpty();
        assertThat(tokensOf(sokha)).containsExactly("shared-browser");
        // The first account cannot remove the other's token.
        call(delete(URL), sessions.as(dara), "shared-browser").andExpect(status().isNoContent());
        assertThat(tokensOf(sokha)).containsExactly("shared-browser");
    }

    @Test
    void emptyOrHugeTokensAreRefusedAndGuestsAreNot() throws Exception {
        call(put(URL), sessions.as(dara), "").andExpect(status().isBadRequest());
        call(put(URL), sessions.as(dara), "x".repeat(4097)).andExpect(status().isBadRequest());
        call(put(URL), sessions.guest(), "tok").andExpect(status().isUnauthorized());
    }

    private ResultActions call(
            org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder request,
            RequestPostProcessor who,
            String token)
            throws Exception {
        return mvc.perform(
                request.with(who)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"));
    }

    private List<String> tokensOf(UUID user) {
        return jdbc.sql("select token from push_tokens where user_id = :u")
                .param("u", user)
                .query(String.class)
                .list();
    }
}
