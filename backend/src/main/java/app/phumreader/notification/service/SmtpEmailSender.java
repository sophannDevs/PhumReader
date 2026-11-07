package app.phumreader.notification.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Sends plain-text email over SMTP. Active when {@code phumreader.mail.host} is set: Mailpit in
 * development (read the mail at http://127.0.0.1:8025), the email provider's SMTP in staging and
 * production.
 */
@Component
@ConditionalOnExpression(
        "!'${phumreader.mail.host:}'.isBlank() && '${phumreader.mail.resend-api-key:}'.isBlank()")
class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailer;
    private final String from;

    SmtpEmailSender(
            JavaMailSender mailer,
            @Value("${phumreader.mail.from:PhumReader <no-reply@phumreader.local>}") String from) {
        this.mailer = mailer;
        this.from = from;
    }

    @Override
    public void send(String to, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailer.send(message);
    }
}
