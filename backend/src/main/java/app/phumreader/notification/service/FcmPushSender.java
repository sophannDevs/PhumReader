package app.phumreader.notification.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Firebase Cloud Messaging, HTTP v1 API. Signs in with a Firebase service account (a JWT signed
 * with its private key, exchanged for an access token that is kept until it nearly expires) and
 * sends one request per browser token; v1 has no batch endpoint, so the dispatcher runs many of
 * these at once.
 */
class FcmPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(FcmPushSender.class);
    private static final String SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient http =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final JsonMapper json = JsonMapper.builder().build();
    private final Clock clock;
    private final String baseUrl;
    private final String projectId;
    private final String clientEmail;
    private final PrivateKey key;
    private final String tokenUri;

    private volatile String accessToken;
    private volatile Instant accessUntil = Instant.EPOCH;

    /**
     * @param credentials the service account's JSON key file
     */
    FcmPushSender(String credentials, String baseUrl, Clock clock) {
        this.clock = clock;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        JsonNode account = json.readTree(credentials);
        this.projectId = account.get("project_id").asString();
        this.clientEmail = account.get("client_email").asString();
        this.tokenUri = account.get("token_uri").asString();
        this.key = privateKey(account.get("private_key").asString());
    }

    @Override
    public Outcome send(String token, Message message) {
        Map<String, Object> notification = new LinkedHashMap<>();
        notification.put("title", message.title());
        notification.put("body", message.body());
        Map<String, Object> body =
                Map.of(
                        "message",
                        Map.of(
                                "token", token,
                                "notification", notification,
                                "webpush", Map.of("fcm_options", Map.of("link", message.link()))));
        try {
            HttpResponse<String> response =
                    http.send(
                            HttpRequest.newBuilder(
                                            URI.create(
                                                    baseUrl
                                                            + "/v1/projects/"
                                                            + projectId
                                                            + "/messages:send"))
                                    .timeout(TIMEOUT)
                                    .header("Authorization", "Bearer " + accessToken())
                                    .header("Content-Type", "application/json")
                                    .POST(
                                            HttpRequest.BodyPublishers.ofString(
                                                    json.writeValueAsString(body)))
                                    .build(),
                            HttpResponse.BodyHandlers.ofString());
            int status = response.statusCode();
            if (status / 100 == 2) {
                return Outcome.SENT;
            }
            if (status == 404 || response.body().contains("UNREGISTERED")) {
                return Outcome.GONE;
            }
            if (status == 401) {
                accessUntil = Instant.EPOCH; // sign in again next time
            }
            log.warn("FCM answered {}", status);
            return Outcome.FAILED;
        } catch (IOException | RuntimeException e) {
            log.warn("FCM request failed: {}", e.toString());
            return Outcome.FAILED;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Outcome.FAILED;
        }
    }

    private String accessToken() throws IOException, InterruptedException {
        Instant now = clock.instant();
        String current = accessToken;
        if (current != null && now.isBefore(accessUntil.minusSeconds(60))) {
            return current;
        }
        synchronized (this) {
            if (accessToken != null && now.isBefore(accessUntil.minusSeconds(60))) {
                return accessToken;
            }
            String assertion = jwt(now);
            String form =
                    "grant_type="
                            + URLEncoder.encode(
                                    "urn:ietf:params:oauth:grant-type:jwt-bearer",
                                    StandardCharsets.UTF_8)
                            + "&assertion="
                            + URLEncoder.encode(assertion, StandardCharsets.UTF_8);
            HttpResponse<String> response =
                    http.send(
                            HttpRequest.newBuilder(URI.create(tokenUri))
                                    .timeout(TIMEOUT)
                                    .header("Content-Type", "application/x-www-form-urlencoded")
                                    .POST(HttpRequest.BodyPublishers.ofString(form))
                                    .build(),
                            HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IOException("Google sign-in answered " + response.statusCode());
            }
            JsonNode answer = json.readTree(response.body());
            accessToken = answer.get("access_token").asString();
            accessUntil = now.plusSeconds(answer.path("expires_in").asLong(3600));
            return accessToken;
        }
    }

    private String jwt(Instant now) {
        Base64.Encoder b64 = Base64.getUrlEncoder().withoutPadding();
        String header =
                b64.encodeToString(
                        "{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", clientEmail);
        claims.put("scope", SCOPE);
        claims.put("aud", tokenUri);
        claims.put("iat", now.getEpochSecond());
        claims.put("exp", now.plusSeconds(3600).getEpochSecond());
        String payload =
                b64.encodeToString(
                        json.writeValueAsString(claims).getBytes(StandardCharsets.UTF_8));
        try {
            Signature signature = Signature.getInstance("SHA256withRSA");
            signature.initSign(key);
            signature.update((header + "." + payload).getBytes(StandardCharsets.US_ASCII));
            return header + "." + payload + "." + b64.encodeToString(signature.sign());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    private static PrivateKey privateKey(String pem) {
        try {
            String body = pem.replaceAll("-----[A-Z ]+-----", "").replaceAll("\\s", "");
            return KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(body)));
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new IllegalStateException(
                    "The Firebase service account's private_key is not valid", e);
        }
    }
}
