package app.phumreader.notification.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Development: emails (codes, reset links) are printed in the backend console instead of being
 * sent. Never active in production, where codes and links must not reach the logs.
 */
@Component
@Profile("!prod")
class ConsoleEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(ConsoleEmailSender.class);

    @Override
    public void send(String to, String subject, String body) {
        log.info("[dev email] to={} subject=\"{}\"\n{}", to, subject, body);
    }
}
