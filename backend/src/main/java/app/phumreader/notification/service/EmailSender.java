package app.phumreader.notification.service;

/**
 * Sends an email. Development prints it in the backend console ({@link ConsoleEmailSender}); a real
 * provider (Resend, A13) comes later. There is deliberately no implementation for production yet.
 */
public interface EmailSender {

    void send(String to, String subject, String body);
}
