package app.phumreader.episode.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.media.service.ImageUrlSigner;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.SeededDemo;
import com.jayway.jsonpath.JsonPath;
import java.time.Instant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/**
 * With the image Worker configured, uploaded panels come back as signed addresses that last five
 * minutes, and the demo's own files stay as they are (plan P3-08, P3-09).
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
@TestPropertySource(
        properties = {
            "phumreader.storage.image-signing-secret=test-secret",
            "phumreader.storage.image-cdn-url=https://img.phumreader.test"
        })
class SignedPanelsTest {

    private static final Instant NOON = Instant.parse("2026-11-05T05:00:00Z");

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired PlatformTransactionManager transactions;
    @Autowired ImageUrlSigner signer;

    @BeforeEach
    void demo() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(NOON);
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    @Test
    void uploadedPanelsAreSignedForFiveMinutesAndDemoFilesAreNot() throws Exception {
        String key = "uploads/panel/11111111-2222-3333-4444-555555555555/w800.webp";
        // Panel 1 of Glass Compass episode 1 now points at an uploaded image (the in-memory store's
        // address).
        jdbc.sql(
                        "update episode_images set storage_key = :key where position = 1 and episode_id ="
                                + " (select e.id from episodes e join series s on s.id = e.series_id"
                                + " where s.slug = 'glass-compass' and e.number = 1)")
                .param("key", "memory://" + key)
                .update();

        String body =
                mvc.perform(get("/api/v1/series/glass-compass/episodes/1"))
                        .andExpect(status().isOk())
                        .andExpect(
                                jsonPath("$.panels[1].src")
                                        .value(org.hamcrest.Matchers.startsWith("/panels/")))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();

        String src = JsonPath.read(body, "$.panels[0].src");
        long exp = NOON.plus(ImageUrlSigner.LIFETIME).getEpochSecond();
        assertThat(src)
                .isEqualTo(
                        "https://img.phumreader.test/"
                                + key
                                + "?t="
                                + ImageUrlSigner.token("test-secret", "/" + key, exp));
    }

    @Test
    void anAddressOutsideTheStorageIsNotTouched() {
        assertThat(signer.signStored("/panels/abc.svg")).isEqualTo("/panels/abc.svg");
        assertThat(signer.signStored("https://elsewhere.test/x.webp"))
                .isEqualTo("https://elsewhere.test/x.webp");
        assertThat(signer.signStored("memory://")).isEqualTo("memory://");
    }
}
