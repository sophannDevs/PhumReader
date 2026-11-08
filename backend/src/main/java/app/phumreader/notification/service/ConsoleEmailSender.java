package app.phumreader.notification.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Development without a mail server: emails (codes, reset links) are printed in the backend console
 * instead of being sent (set MAIL_HOST to send them to Mailpit). Never active in production, where
 * codes and links must not reach the logs.
 */
@Component
@Profile("!prod")
@ConditionalOnExpression(
        "'${phumreader.mail.host:}'.isBlank() && '${phumreader.mail.resend-api-key:}'.isBlank()")
class ConsoleEmailSender implements EmailSender {

    private static final Logger log = LoggerFactory.getLogger(ConsoleEmailSender.class);

    @Override
    public void send(String to, String subject, String body) {
        log.info("[dev email] to={} subject=\"{}\"\n{}", to, subject, body);
    }
}
