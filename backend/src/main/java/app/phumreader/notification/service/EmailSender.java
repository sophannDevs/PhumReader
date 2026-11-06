package app.phumreader.notification.service;

/**
 * Sends an email. With {@code phumreader.mail.host} set it goes over SMTP ({@link SmtpEmailSender}:
 * Mailpit in development, the provider in production); in development without it, it is printed in
 * the backend console ({@link ConsoleEmailSender}). Production with no mail host has no sender on
 * purpose.
 */
public interface EmailSender {

    void send(String to, String subject, String body);
}
