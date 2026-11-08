package app.phumreader.notification.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.phumreader.notification.service.EmailSender.Mail;
import app.phumreader.notification.service.PushSender.Message;
import app.phumreader.notification.service.PushSender.Outcome;
import app.phumreader.support.MutableClock;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Resend and Firebase adapters against a small local HTTP server that plays both services: what
 * they send is checked, but they are not tried against the real services.
 */
class ProviderAdaptersTest {

    record Call(String path, String authorization, String body) {}

    private final JsonMapper json = JsonMapper.builder().build();
    private final List<Call> calls = new CopyOnWriteArrayList<>();
    private final MutableClock clock = new MutableClock();
    private HttpServer server;
    private String base;
    private volatile int sendStatus = 200;
    private volatile String sendBody = "{}";
    private volatile int resendStatus = 200;
    private final AtomicInteger tokenIssued = new AtomicInteger();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext(
                "/",
                exchange -> {
                    String body =
                            new String(
                                    exchange.getRequestBody().readAllBytes(),
                                    StandardCharsets.UTF_8);
                    String path = exchange.getRequestURI().getPath();
                    calls.add(
                            new Call(
                                    path,
                                    exchange.getRequestHeaders().getFirst("Authorization"),
                                    body));
                    int status = 200;
                    String answer = "{}";
                    if (path.equals("/token")) {
                        answer =
                                "{\"access_token\":\"at-"
                                        + tokenIssued.incrementAndGet()
                                        + "\",\"expires_in\":3600}";
                    } else if (path.endsWith("messages:send")) {
                        status = sendStatus;
                        answer = sendBody;
                    } else if (path.startsWith("/emails")) {
                        status = resendStatus;
                    }
                    byte[] bytes = answer.getBytes(StandardCharsets.UTF_8);
                    exchange.sendResponseHeaders(status, bytes.length);
                    exchange.getResponseBody().write(bytes);
                    exchange.close();
                });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    // ---------- Resend ----------

    @Test
    void resendSendsUpTo100EmailsPerRequestWithTheApiKey() {
        ResendEmailSender sender =
                new ResendEmailSender("re_key", "PhumReader <no-reply@phumreader.test>", base);
        List<Mail> mails = new ArrayList<>();
        for (int i = 0; i < 250; i++) {
            mails.add(new Mail("r" + i + "@example.com", "Subject", "Body " + i));
        }

        sender.sendAll(mails);

        assertThat(calls)
                .extracting(Call::path)
                .containsExactly("/emails/batch", "/emails/batch", "/emails/batch");
        assertThat(calls).allMatch(c -> "Bearer re_key".equals(c.authorization()));
        List<Integer> sizes = calls.stream().map(c -> json.readTree(c.body()).size()).toList();
        assertThat(sizes).containsExactly(100, 100, 50);
        JsonNode first = json.readTree(calls.getFirst().body()).get(0);
        assertThat(first.get("from").asString()).isEqualTo("PhumReader <no-reply@phumreader.test>");
        assertThat(first.get("to").get(0).asString()).isEqualTo("r0@example.com");
        assertThat(first.get("text").asString()).isEqualTo("Body 0");
    }

    @Test
    void aSingleEmailUsesTheSingleEndpointAndAFailureIsThrown() {
        ResendEmailSender sender = new ResendEmailSender("re_key", "PhumReader <a@b.test>", base);
        sender.send("who@example.com", "Hi", "There");
        assertThat(calls).extracting(Call::path).containsExactly("/emails");

        resendStatus = 429;
        assertThatThrownBy(() -> sender.sendAll(List.of(new Mail("x@example.com", "s", "b"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Resend answered 429");
    }

    // ---------- Firebase ----------

    @Test
    void firebaseSignsInOnceWithASignedJwtAndSendsEachNotice() throws Exception {
        KeyPair pair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        FcmPushSender fcm = new FcmPushSender(serviceAccount(pair), base, clock);
        Message message =
                new Message(
                        "New episode: Glass Tide",
                        "Episode 7 is out",
                        "https://phumreader.test/read/x/7");

        assertThat(fcm.send("browser-1", message)).isEqualTo(Outcome.SENT);
        assertThat(fcm.send("browser-2", message)).isEqualTo(Outcome.SENT);

        List<Call> tokenCalls = calls.stream().filter(c -> c.path().equals("/token")).toList();
        assertThat(tokenCalls).as("one sign-in for both notices").hasSize(1);
        String form = tokenCalls.getFirst().body();
        assertThat(form)
                .contains("grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer");
        String jwt =
                URLDecoder.decode(
                        form.substring(form.indexOf("assertion=") + 10), StandardCharsets.UTF_8);
        String[] parts = jwt.split("\\.");
        Signature verify = Signature.getInstance("SHA256withRSA");
        verify.initVerify(pair.getPublic());
        verify.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
        assertThat(verify.verify(Base64.getUrlDecoder().decode(parts[2])))
                .as("RS256 signature")
                .isTrue();
        JsonNode claims = json.readTree(Base64.getUrlDecoder().decode(parts[1]));
        assertThat(claims.get("iss").asString())
                .isEqualTo("push@phumreader-test.iam.gserviceaccount.com");
        assertThat(claims.get("scope").asString())
                .isEqualTo("https://www.googleapis.com/auth/firebase.messaging");
        assertThat(claims.get("aud").asString()).isEqualTo(base + "/token");

        List<Call> sends = calls.stream().filter(c -> c.path().endsWith("messages:send")).toList();
        assertThat(sends).hasSize(2);
        assertThat(sends.getFirst().path()).isEqualTo("/v1/projects/phumreader-test/messages:send");
        assertThat(sends.getFirst().authorization()).isEqualTo("Bearer at-1");
        JsonNode sent = json.readTree(sends.getFirst().body()).get("message");
        assertThat(sent.get("token").asString()).isEqualTo("browser-1");
        assertThat(sent.get("notification").get("title").asString())
                .isEqualTo("New episode: Glass Tide");
        assertThat(sent.get("webpush").get("fcm_options").get("link").asString())
                .isEqualTo("https://phumreader.test/read/x/7");
    }

    @Test
    void firebaseOutcomesAndAccessTokenRefresh() throws Exception {
        KeyPair pair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        FcmPushSender fcm = new FcmPushSender(serviceAccount(pair), base, clock);
        Message message = new Message("t", "b", "https://phumreader.test/");

        sendStatus = 404;
        sendBody = "{\"error\":{\"status\":\"NOT_FOUND\"}}";
        assertThat(fcm.send("old", message)).isEqualTo(Outcome.GONE);
        sendStatus = 400;
        sendBody = "{\"error\":{\"details\":[{\"errorCode\":\"UNREGISTERED\"}]}}";
        assertThat(fcm.send("old", message)).isEqualTo(Outcome.GONE);
        sendStatus = 400;
        sendBody = "{\"error\":{\"status\":\"INVALID_ARGUMENT\"}}";
        assertThat(fcm.send("odd", message))
                .as("a bad request is not proof the token is gone")
                .isEqualTo(Outcome.FAILED);
        sendStatus = 503;
        assertThat(fcm.send("later", message)).isEqualTo(Outcome.FAILED);

        // An access token that Google refuses is replaced on the next notice.
        sendStatus = 401;
        assertThat(fcm.send("x", message)).isEqualTo(Outcome.FAILED);
        sendStatus = 200;
        assertThat(fcm.send("x", message)).isEqualTo(Outcome.SENT);
        assertThat(tokenIssued.get()).isEqualTo(2);

        // And an access token near its end is replaced before it fails.
        clock.advance(Duration.ofSeconds(3_550));
        assertThat(fcm.send("x", message)).isEqualTo(Outcome.SENT);
        assertThat(tokenIssued.get()).isEqualTo(3);
    }

    @Test
    void anUnreachableServiceIsFailedNotAnException() throws Exception {
        KeyPair pair = KeyPairGenerator.getInstance("RSA").generateKeyPair();
        FcmPushSender fcm = new FcmPushSender(serviceAccount(pair), "http://127.0.0.1:1", clock);

        assertThat(fcm.send("x", new Message("t", "b", "https://phumreader.test/")))
                .isEqualTo(Outcome.FAILED);
    }

    private String serviceAccount(KeyPair pair) {
        String pem =
                "-----BEGIN PRIVATE KEY-----\n"
                        + Base64.getMimeEncoder(64, "\n".getBytes())
                                .encodeToString(pair.getPrivate().getEncoded())
                        + "\n-----END PRIVATE KEY-----\n";
        return json.writeValueAsString(
                java.util.Map.of(
                        "type", "service_account",
                        "project_id", "phumreader-test",
                        "client_email", "push@phumreader-test.iam.gserviceaccount.com",
                        "private_key", pem,
                        "token_uri", base + "/token"));
    }
}
