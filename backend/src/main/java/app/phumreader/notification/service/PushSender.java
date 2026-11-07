package app.phumreader.notification.service;

/** Sends one web push to one browser (Firebase Cloud Messaging in production). */
public interface PushSender {

    /** What the notice says and where tapping it goes. */
    record Message(String title, String body, String link) {}

    enum Outcome {
        SENT,
        /** The token no longer exists (browser data cleared, notifications revoked): forget it. */
        GONE,
        /** Could not be sent now; the token stays. */
        FAILED
    }

    Outcome send(String token, Message message);
}
