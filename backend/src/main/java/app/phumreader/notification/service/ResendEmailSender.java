package app.phumreader.notification.service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Sends plain-text email through Resend's HTTP API (A13). Active when {@code
 * phumreader.mail.resend-api-key} is set, and then used instead of SMTP: its batch endpoint sends
 * up to 100 emails per request, which is what lets one new episode reach thousands of subscribers
 * inside the 5-minute budget (Resend limits requests per second, not emails per request).
 */
@Component
@ConditionalOnExpression("!'${phumreader.mail.resend-api-key:}'.isBlank()")
class ResendEmailSender implements EmailSender {

    static final int BATCH = 100;
    private static final Duration TIMEOUT = Duration.ofSeconds(20);

    private final HttpClient http =
            HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final JsonMapper json = JsonMapper.builder().build();
    private final String apiKey;
    private final String from;
    private final String baseUrl;

    ResendEmailSender(
            @Value("${phumreader.mail.resend-api-key}") String apiKey,
            @Value("${phumreader.mail.from:PhumReader <no-reply@phumreader.local>}") String from,
            @Value("${phumreader.mail.resend-base-url:https://api.resend.com}") String baseUrl) {
        this.apiKey = apiKey;
        this.from = from;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    @Override
    public void send(String to, String subject, String body) {
        post("/emails", message(new Mail(to, subject, body)));
    }

    @Override
    public void sendAll(List<Mail> mails) {
        for (int from = 0; from < mails.size(); from += BATCH) {
            List<Map<String, Object>> batch = new ArrayList<>();
            for (Mail mail : mails.subList(from, Math.min(mails.size(), from + BATCH))) {
                batch.add(message(mail));
            }
            post("/emails/batch", batch);
        }
    }

    private Map<String, Object> message(Mail mail) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("from", from);
        m.put("to", List.of(mail.to()));
        m.put("subject", mail.subject());
        m.put("text", mail.body());
        return m;
    }

    private void post(String path, Object body) {
        try {
            HttpRequest request =
                    HttpRequest.newBuilder(URI.create(baseUrl + path))
                            .timeout(TIMEOUT)
                            .header("Authorization", "Bearer " + apiKey)
                            .header("Content-Type", "application/json")
                            .POST(
                                    HttpRequest.BodyPublishers.ofString(
                                            json.writeValueAsString(body)))
                            .build();
            HttpResponse<String> response =
                    http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                // The answer can name the address; keep the status only.
                throw new IllegalStateException("Resend answered " + response.statusCode());
            }
        } catch (IOException e) {
            throw new IllegalStateException("Could not reach Resend", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted", e);
        }
    }
}
