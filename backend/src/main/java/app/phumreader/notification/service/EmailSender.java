package app.phumreader.notification.service;

/**
 * Sends an email. With {@code phumreader.mail.host} set it goes over SMTP ({@link SmtpEmailSender}:
 * Mailpit in development, the provider in production); in development without it, it is printed in
 * the backend console ({@link ConsoleEmailSender}). Production with no mail host has no sender on
 * purpose.
 */
public interface EmailSender {

    /** One email in a bulk send. */
    record Mail(String to, String subject, String body) {}

    void send(String to, String subject, String body);

    /**
     * Sends many emails (new-episode notices). The default sends them one by one; the Resend sender
     * sends up to 100 per request. A failure stops the rest and is thrown, so the caller can retry.
     */
    default void sendAll(java.util.List<Mail> mails) {
        for (Mail mail : mails) {
            send(mail.to(), mail.subject(), mail.body());
        }
    }
}
