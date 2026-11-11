package app.phumreader.user.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.RecordingEmailSender;
import app.phumreader.support.Sessions;
import java.time.Year;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;

/**
 * The smaller V2.1 fields (V21-07): welcome picks saved on the account, birth year at sign-up, the
 * Help contact form (ticket T-xxxxx emailed to support) and "Was this helpful?" votes. Every test
 * rolls back.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class SmallFieldsApiTest {

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired jakarta.persistence.EntityManager entities;
    @Autowired JwtService jwt;
    @Autowired RateLimiter limiter;
    @Autowired RecordingEmailSender mail;

    Sessions sessions;

    @BeforeEach
    void setUp() {
        sessions = new Sessions(jwt, jdbc);
        limiter.clear();
        mail.clear();
    }

    // ---------- welcome picks ----------

    @Test
    void picksStartEmptyAndStayOnTheAccount() throws Exception {
        UUID reader = sessions.newReader("Dara");
        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.genres").doesNotExist())
                .andExpect(jsonPath("$.preferences.storyLanguages.length()").value(2));

        patchSettings(
                        reader,
                        "{\"preferences\":{\"genres\":[\"Romance\",\" Fantasy \",\"Romance\"],"
                                + "\"storyLanguages\":[\"km\"]}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.genres.length()").value(2))
                .andExpect(jsonPath("$.preferences.genres[1]").value("Fantasy"))
                .andExpect(jsonPath("$.preferences.storyLanguages[0]").value("km"));

        // A new device reads the same answer; another change keeps the picks.
        patchSettings(reader, "{\"theme\":\"dark\"}").andExpect(status().isOk());
        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(jsonPath("$.preferences.genres[0]").value("Romance"))
                .andExpect(jsonPath("$.preferences.storyLanguages.length()").value(1));
    }

    @Test
    void skippingIsAnEmptyListAndNotTheSameAsNeverChoosing() throws Exception {
        UUID reader = sessions.newReader("Dara");
        patchSettings(reader, "{\"preferences\":{\"genres\":[]}}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.preferences.genres.length()").value(0));
        mvc.perform(get("/api/v1/me/settings").with(sessions.as(reader)))
                .andExpect(jsonPath("$.preferences.genres.length()").value(0));
    }

    @Test
    void picksNeedAtLeastOneStoryLanguage() throws Exception {
        UUID reader = sessions.newReader("Dara");
        patchSettings(reader, "{\"preferences\":{\"storyLanguages\":[]}}")
                .andExpect(status().isBadRequest());
        patchSettings(reader, "{\"preferences\":{\"storyLanguages\":[\"fr\"]}}")
                .andExpect(status().isBadRequest());
    }

    // ---------- birth year ----------

    @Test
    void birthYearIsKeptFromSignUpAndAnUnderThirteenCannotJoin() throws Exception {
        int year = Year.now().getValue();
        signUp("a@example.com", year - 20).andExpect(status().isCreated());
        entities.flush();
        assertThat(
                        jdbc.sql("select birth_year from users where email = 'a@example.com'")
                                .query(Integer.class)
                                .single())
                .isEqualTo(year - 20);

        signUp("b@example.com", year - 12)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("too_young"))
                .andExpect(jsonPath("$.error.fields.birthYear").value("too_young"));
        assertThat(
                        jdbc.sql("select count(*) from users where email = 'b@example.com'")
                                .query(Integer.class)
                                .single())
                .isZero();

        signUp("c@example.com", 1850).andExpect(status().isBadRequest());
        signUp("d@example.com", null).andExpect(status().isCreated());
    }

    @Test
    void meShowsTheBirthYear() throws Exception {
        UUID reader = sessions.newReader("Dara");
        jdbc.sql("update users set birth_year = 1990 where id = :id").param("id", reader).update();
        mvc.perform(get("/api/v1/me").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.birthYear").value(1990));
    }

    // ---------- Help tickets ----------

    @Test
    void aTicketIsSavedNumberedAndEmailedToSupport() throws Exception {
        ticket("payment", "dara@example.com", "tw-12345678", "I paid but my coins did not arrive.")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ticket").value("T-58214"));
        ticket("other", "dara@example.com", null, "Where do I find my reading history?")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ticket").value("T-58215"));

        assertThat(
                        jdbc.sql(
                                        "select order_number from support_tickets where number ="
                                                + " 58214")
                                .query(String.class)
                                .single())
                .isEqualTo("TW-12345678");
        var sent = mail.lastTo("support@phumireader.test").orElseThrow();
        assertThat(sent.subject()).contains("T-58215");
        assertThat(sent.body()).contains("dara@example.com").contains("reading history");
        assertThat(mail.to("support@phumireader.test")).hasSize(2);
    }

    @Test
    void aSignedInReaderTicketKeepsTheAccount() throws Exception {
        UUID reader = sessions.newReader("Dara");
        mvc.perform(
                        json(
                                post("/api/v1/help/tickets").with(sessions.as(reader)),
                                ticketBody(
                                        "account",
                                        "dara@example.com",
                                        null,
                                        "I cannot change my email address.")))
                .andExpect(status().isCreated());
        assertThat(
                        jdbc.sql("select user_id from support_tickets order by number desc limit 1")
                                .query(UUID.class)
                                .single())
                .isEqualTo(reader);
    }

    @Test
    void aBadTicketIsRejectedWithTheFieldName() throws Exception {
        ticket("nonsense", "dara@example.com", null, "A message that is long enough.")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_topic"));
        ticket("other", "not-an-email", null, "A message that is long enough.")
                .andExpect(jsonPath("$.error.fields.email").value("invalid_email"));
        ticket("other", "dara@example.com", null, "too short")
                .andExpect(jsonPath("$.error.code").value("message_too_short"));
        ticket("payment", "dara@example.com", "12345", "A message that is long enough.")
                .andExpect(jsonPath("$.error.code").value("invalid_order"));
        ticket("other", "dara@example.com", null, "x".repeat(1001))
                .andExpect(jsonPath("$.error.code").value("message_too_long"));
        assertThat(jdbc.sql("select count(*) from support_tickets").query(Integer.class).single())
                .isZero();
    }

    @Test
    void ticketsAreLimitedPerHour() throws Exception {
        for (int i = 0; i < 5; i++) {
            ticket("other", "dara@example.com", null, "A message that is long enough " + i)
                    .andExpect(status().isCreated());
        }
        ticket("other", "dara@example.com", null, "A message that is long enough 6")
                .andExpect(status().isTooManyRequests());
    }

    // ---------- Was this helpful? ----------

    @Test
    void votesAreKeptPerAccountAndCanChangeOrGo() throws Exception {
        UUID reader = sessions.newReader("Dara");
        UUID other = sessions.newReader("Other");
        mvc.perform(get("/api/v1/me/help-votes")).andExpect(status().isUnauthorized());

        vote(reader, 3, true).andExpect(status().isNoContent());
        vote(reader, 5, false).andExpect(status().isNoContent());
        vote(reader, 3, false).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/help-votes").with(sessions.as(reader)))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].article").value(3))
                .andExpect(jsonPath("$[0].helpful").value(false))
                .andExpect(jsonPath("$[1].article").value(5));
        mvc.perform(get("/api/v1/me/help-votes").with(sessions.as(other)))
                .andExpect(jsonPath("$.length()").value(0));

        mvc.perform(delete("/api/v1/me/help-votes/3").with(sessions.as(reader)))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/me/help-votes").with(sessions.as(reader)))
                .andExpect(jsonPath("$.length()").value(1));
        vote(reader, 100, true).andExpect(status().isBadRequest());
    }

    // ---------- helpers ----------

    private ResultActions patchSettings(UUID user, String body) throws Exception {
        return mvc.perform(json(patch("/api/v1/me/settings").with(sessions.as(user)), body));
    }

    private ResultActions vote(UUID user, int article, boolean helpful) throws Exception {
        return mvc.perform(
                json(
                        put("/api/v1/me/help-votes/" + article).with(sessions.as(user)),
                        "{\"helpful\":" + helpful + "}"));
    }

    private ResultActions ticket(String topic, String email, String order, String message)
            throws Exception {
        return mvc.perform(
                json(
                        post("/api/v1/help/tickets").with(sessions.guest()),
                        ticketBody(topic, email, order, message)));
    }

    private static String ticketBody(String topic, String email, String order, String message) {
        return "{\"topic\":\"%s\",\"email\":\"%s\",\"order\":%s,\"message\":\"%s\",\"locale\":\"en\"}"
                .formatted(topic, email, order == null ? "null" : "\"" + order + "\"", message);
    }

    private ResultActions signUp(String email, Integer birthYear) throws Exception {
        String year = birthYear == null ? "" : ",\"birthYear\":" + birthYear;
        return mvc.perform(
                json(
                        post("/api/v1/auth/signup").with(sessions.guest()),
                        "{\"name\":\"Sokha\",\"email\":\"%s\",\"password\":\"PhumiReader1!\"%s}"
                                .formatted(email, year)));
    }

    private static MockHttpServletRequestBuilder json(
            MockHttpServletRequestBuilder request, String body) {
        return request.contentType(MediaType.APPLICATION_JSON).content(body);
    }
}
