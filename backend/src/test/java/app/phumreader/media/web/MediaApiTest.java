package app.phumreader.media.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.media.service.InMemoryObjectStore;
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

/**
 * Creator image uploads (plan P3-07) against an in-memory object store: the ticket, the checks
 * (A19) and the WebP variants. The real S3 API is covered by S3ObjectStoreTest.
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class MediaApiTest {

    static final String UPLOADS = "/api/v1/creator/uploads";

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired ObjectStore store;

    Sessions sessions;
    UUID creator;

    @BeforeEach
    void aCreator() {
        sessions = new Sessions(jwt, jdbc);
        creator = sessions.newReader("Dara");
    }

    @Test
    void anImageWideEnoughBecomesWebpVariants() throws Exception {
        byte[] data = png(1000, 1500);
        String id = ticket("PANEL", "image/png", data);
        upload(id, "PANEL", data);

        String body =
                mvc.perform(complete(id))
                        .andExpect(status().isOk())
                        .andExpect(jsonPath("$.status").value("READY"))
                        .andExpect(jsonPath("$.width").value(1000))
                        .andExpect(jsonPath("$.height").value(1500))
                        .andExpect(jsonPath("$.variants.length()").value(3))
                        .andExpect(jsonPath("$.variants[0].width").value(320))
                        .andExpect(jsonPath("$.variants[1].width").value(800))
                        .andExpect(jsonPath("$.variants[2].width").value(1000))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        String url = JsonPath.read(body, "$.url");
        assertThat(url).endsWith("/w1000.webp");
        byte[] webp = ((InMemoryObjectStore) store).get(url.substring("memory://".length()));
        // A WebP file starts with "RIFF", a size and "WEBP".
        assertThat(new String(webp, 0, 4)).isEqualTo("RIFF");
        assertThat(new String(webp, 8, 4)).isEqualTo("WEBP");

        // Asking again answers the same.
        mvc.perform(complete(id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(url));
    }

    @Test
    void jpegsAreAccepted() throws Exception {
        byte[] jpg = image(900, 900, "jpg");
        String id = ticket("THUMBNAIL", "image/jpeg", jpg);
        upload(id, "THUMBNAIL", jpg);
        mvc.perform(complete(id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY"));
    }

    @Test
    void a799PxPanelIsRejectedWithAClearReason() throws Exception {
        byte[] data = png(799, 1200);
        String id = ticket("PANEL", "image/png", data);
        upload(id, "PANEL", data);

        mvc.perform(complete(id))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error.code").value("image_too_small"))
                .andExpect(
                        jsonPath("$.error.message")
                                .value("The image is 799 px wide; the minimum is 800 px."));
        mvc.perform(get(UPLOADS + "/" + id).with(sessions.as(creator, "CREATOR")))
                .andExpect(jsonPath("$.status").value("REJECTED"))
                .andExpect(jsonPath("$.rejectCode").value("image_too_small"))
                .andExpect(jsonPath("$.variants.length()").value(0));
        // The rejected original is not kept.
        String key =
                jdbc.sql("select original_key from media_uploads where id = :id")
                        .param("id", UUID.fromString(id))
                        .query(String.class)
                        .single();
        assertThat(((InMemoryObjectStore) store).contains(key)).isFalse();
    }

    @Test
    void anImageExactly800PxWideIsAccepted() throws Exception {
        byte[] data = png(800, 800);
        String id = ticket("PANEL", "image/png", data);
        upload(id, "PANEL", data);
        mvc.perform(complete(id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.variants.length()").value(2));
    }

    @Test
    void thumbnailsMustBeSquare() throws Exception {
        byte[] data = png(600, 400);
        String id = ticket("THUMBNAIL", "image/png", data);
        upload(id, "THUMBNAIL", data);
        mvc.perform(complete(id))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error.code").value("not_square"));
    }

    @Test
    void theFilesOwnBytesDecideNotTheClaimedType() throws Exception {
        byte[] notAnImage = "GIF89a this is not a png".getBytes();
        String id = ticket("COVER", "image/png", notAnImage);
        upload(id, "COVER", notAnImage);
        mvc.perform(complete(id))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error.code").value("unsupported_type"));
    }

    @Test
    void aFileOfAnotherSizeThanAnnouncedIsRejected() throws Exception {
        String id = ticket("PANEL", "image/png", png(900, 900));
        upload(id, "PANEL", png(1000, 1000));
        mvc.perform(complete(id))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.error.code").value("file_too_large"));
    }

    @Test
    void completingBeforeTheUploadIsAConflictAndCanBeRetried() throws Exception {
        byte[] data = png(900, 900);
        String id = ticket("PANEL", "image/png", data);
        mvc.perform(complete(id))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("upload_missing"));
        upload(id, "PANEL", data);
        mvc.perform(complete(id)).andExpect(status().isOk());
    }

    @Test
    void theRulesAreCheckedWhenTheTicketIsRequested() throws Exception {
        for (String body :
                new String[] {
                    "{\"kind\":\"PANEL\",\"contentType\":\"image/gif\",\"size\":1000}",
                    "{\"kind\":\"PANEL\",\"contentType\":\"image/png\",\"size\":"
                            + (20L * 1024 * 1024 + 1)
                            + "}",
                    "{\"kind\":\"PANEL\",\"contentType\":\"image/png\",\"size\":0}",
                    "{\"kind\":\"VIDEO\",\"contentType\":\"image/png\",\"size\":10}"
                }) {
            mvc.perform(
                            post(UPLOADS)
                                    .with(sessions.as(creator, "CREATOR"))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    @Test
    void onlyCreatorsUploadAndOnlyTheOwnerSeesAnUpload() throws Exception {
        String body = "{\"kind\":\"PANEL\",\"contentType\":\"image/png\",\"size\":1000}";
        UUID reader = sessions.newReader("Reader");
        mvc.perform(
                        post(UPLOADS)
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isForbidden());
        mvc.perform(
                        post(UPLOADS)
                                .with(sessions.guest())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andExpect(status().isUnauthorized());

        String id = ticket("PANEL", "image/png", png(900, 900));
        UUID other = sessions.newReader("Other");
        mvc.perform(get(UPLOADS + "/" + id).with(sessions.as(other, "CREATOR")))
                .andExpect(status().isNotFound());
        mvc.perform(post(UPLOADS + "/" + id + "/complete").with(sessions.as(other, "CREATOR")))
                .andExpect(status().isNotFound());
    }

    // ---------- helpers ----------

    private org.springframework.test.web.servlet.RequestBuilder complete(String id) {
        return post(UPLOADS + "/" + id + "/complete").with(sessions.as(creator, "CREATOR"));
    }

    /** Asks for a ticket for these bytes and returns the upload id. */
    private String ticket(String kind, String type, byte[] data) throws Exception {
        String body =
                mvc.perform(
                                post(UPLOADS)
                                        .with(sessions.as(creator, "CREATOR"))
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                "{\"kind\":\"%s\",\"contentType\":\"%s\",\"size\":%d}"
                                                        .formatted(kind, type, data.length)))
                        .andExpect(status().isCreated())
                        .andExpect(jsonPath("$.uploadUrl").exists())
                        .andExpect(jsonPath("$.headers['Content-Type']").value(type))
                        .andReturn()
                        .getResponse()
                        .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    /** What the browser does: PUT the bytes to the presigned URL (here: into the memory store). */
    private void upload(String id, String kind, byte[] data) {
        store.put("uploads/" + kind.toLowerCase() + "/" + id + "/original", data, "image/png");
    }

    private static byte[] png(int width, int height) {
        return image(width, height, "png");
    }

    private static byte[] image(int width, int height, String format) {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(0, 220, 100));
        g.fillRect(0, 0, width, height);
        g.setColor(Color.DARK_GRAY);
        g.fillOval(width / 4, height / 4, width / 2, height / 2);
        g.dispose();
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, format, out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }
}
