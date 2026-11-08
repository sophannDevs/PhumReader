package app.phumreader.auth.service;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.stream.Collectors;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The few HTTP calls the provider clients make, with timeouts and JSON answers. */
final class OAuthHttp {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final JsonMapper json = JsonMapper.builder().build();

    JsonNode postForm(String url, Map<String, String> form) {
        HttpRequest request =
                HttpRequest.newBuilder(URI.create(url))
                        .timeout(TIMEOUT)
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .header("Accept", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(encode(form)))
                        .build();
        return send(request);
    }

    JsonNode get(String url, Map<String, String> query, String bearer) {
        HttpRequest.Builder request =
                HttpRequest.newBuilder(
                                URI.create(query.isEmpty() ? url : url + "?" + encode(query)))
                        .timeout(TIMEOUT)
                        .header("Accept", "application/json")
                        .GET();
        if (bearer != null) {
            request.header("Authorization", "Bearer " + bearer);
        }
        return send(request.build());
    }

    static String encode(Map<String, String> values) {
        return values.entrySet().stream()
                .map(e -> urlEncode(e.getKey()) + "=" + urlEncode(e.getValue()))
                .collect(Collectors.joining("&"));
    }

    static String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private JsonNode send(HttpRequest request) {
        try {
            HttpResponse<String> response =
                    http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                // The body can hold the secret's name or a hint; log the status only.
                throw new SocialLoginException(
                        request.uri().getHost() + " answered " + response.statusCode());
            }
            return json.readTree(response.body());
        } catch (IOException ex) {
            throw new SocialLoginException("Could not reach " + request.uri().getHost(), ex);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new SocialLoginException("Interrupted", ex);
        }
    }
}
