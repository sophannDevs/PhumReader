package app.phumreader.auth.service;

/** A provider answered with an error or could not be reached. Never shown to the person as is. */
public class SocialLoginException extends RuntimeException {

    public SocialLoginException(String message, Throwable cause) {
        super(message, cause);
    }

    public SocialLoginException(String message) {
        super(message);
    }
}
