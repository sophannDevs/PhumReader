package app.phumreader.user.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.media.service.ObjectStore;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.Sessions;
import com.jayway.jsonpath.JsonPath;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

/** Profile pictures (plan P3-17): any signed-in reader uploads a square image and sets it. */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class AvatarApiTest {

    private static final String UPLOADS = "/api/v1/creator/uploads";

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired ObjectStore store;

    Sessions sessions;
    UUID reader;

    @BeforeEach
    void aReader() {
        sessions = new Sessions(jwt, jdbc);
        reader = sessions.newReader("Sokha Chan");
    }

    @Test
    void aReaderSetsAndRemovesTheirPicture() throws Exception {
        mvc.perform(get("/api/v1/me").with(sessions.as(reader)))
                .andExpect(jsonPath("$.avatarUrl").doesNotExist());

        String id = uploaded(reader, "AVATAR", png(400, 400));

        mvc.perform(
                        put("/api/v1/me/avatar")
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"uploadId\":\"" + id + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value(org.hamcrest.Matchers.endsWith(".webp")));
        mvc.perform(get("/api/v1/me").with(sessions.as(reader)))
                .andExpect(jsonPath("$.avatarUrl").exists());

        mvc.perform(delete("/api/v1/me/avatar").with(sessions.as(reader)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").doesNotExist());
    }

    @Test
    void aReaderStillCannotUploadOtherKinds() throws Exception {
        mvc.perform(
                        post(UPLOADS)
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"kind\":\"COVER\",\"contentType\":\"image/png\",\"size\":1000}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void thePictureMustBeSquareAndBigEnough() throws Exception {
        String wide = ticket(reader, "AVATAR", png(400, 300));
        store.put(key("AVATAR", wide), png(400, 300), "image/png");
        mvc.perform(post(UPLOADS + "/" + wide + "/complete").with(sessions.as(reader)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error.code").value("not_square"));

        String small = ticket(reader, "AVATAR", png(150, 150));
        store.put(key("AVATAR", small), png(150, 150), "image/png");
        mvc.perform(post(UPLOADS + "/" + small + "/complete").with(sessions.as(reader)))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error.code").value("image_too_small"));
    }

    @Test
    void onlyYourOwnFinishedAvatarUploadCanBeUsed() throws Exception {
        UUID other = sessions.newReader("Other");
        String theirs = uploaded(other, "AVATAR", png(300, 300));
        setAvatar(reader, theirs)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.uploadId").value("upload_invalid"));

        String notDone = ticket(reader, "AVATAR", png(300, 300));
        setAvatar(reader, notDone)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.fields.uploadId").value("upload_not_ready"));

        String cover = uploaded(sessionsCreator(), "COVER", png(700, 700));
        setAvatar(reader, cover).andExpect(status().isBadRequest());

        mvc.perform(
                        put("/api/v1/me/avatar")
                                .with(sessions.guest())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"uploadId\":\"" + theirs + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    // ---------- helpers ----------

    private UUID sessionsCreator() {
        return sessions.newReader("Creator");
    }

    private org.springframework.test.web.servlet.ResultActions setAvatar(UUID who, String uploadId)
            throws Exception {
        return mvc.perform(
                put("/api/v1/me/avatar")
                        .with(sessions.as(who))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"uploadId\":\"" + uploadId + "\"}"));
    }

    private String ticket(UUID who, String kind, byte[] data) throws Exception {
        String body =
                mvc.perform(
                                post(UPLOADS)
                                        .with(
                                                sessions.as(
                                                        who,
                                                        who.equals(reader) ? "READER" : "CREATOR"))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"kind\":\"%s\",\"contentType\":\"image/png\",\"size\":%d}"
                                                        .formatted(kind, data.length)))
                        .andExpect(status().isCreated())
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** Ticket, upload and complete: a finished upload. */
    private String uploaded(UUID who, String kind, byte[] data) throws Exception {
        String id = ticket(who, kind, data);
        store.put(key(kind, id), data, "image/png");
        mvc.perform(
                        post(UPLOADS + "/" + id + "/complete")
                                .with(sessions.as(who, who.equals(reader) ? "READER" : "CREATOR")))
                .andExpect(status().isOk());
        return id;
    }

    private static String key(String kind, String id) {
        return "uploads/" + kind.toLowerCase() + "/" + id + "/original";
    }

    private static byte[] png(int width, int height) {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(0, 220, 100));
        g.fillRect(0, 0, width, height);
        g.dispose();
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
