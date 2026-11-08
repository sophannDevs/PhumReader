package app.phumreader.notification.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Web push goes through Firebase Cloud Messaging when a service account is configured ({@code
 * FCM_CREDENTIALS_FILE} = path to the JSON key, or {@code FCM_CREDENTIALS_JSON} = its content),
 * otherwise it is only counted and logged.
 */
@Configuration
class PushConfig {

    private static final Logger log = LoggerFactory.getLogger(PushConfig.class);

    @Bean
    PushSender pushSender(
            @Value("${phumreader.push.fcm-credentials-file:}") String file,
            @Value("${phumreader.push.fcm-credentials-json:}") String inline,
            @Value("${phumreader.push.fcm-base-url:https://fcm.googleapis.com}") String baseUrl,
            Clock clock) {
        String credentials = inline;
        if (credentials.isBlank() && !file.isBlank()) {
            try {
                credentials = Files.readString(Path.of(file));
            } catch (IOException e) {
                throw new IllegalStateException(
                        "Cannot read the Firebase credentials file " + file, e);
            }
        }
        if (credentials.isBlank()) {
            log.warn("No Firebase credentials (FCM_CREDENTIALS_FILE): web push is only logged.");
            return new NoopPushSender();
        }
        return new FcmPushSender(credentials, baseUrl, clock);
    }
}
