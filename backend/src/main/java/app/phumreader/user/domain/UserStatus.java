package app.phumreader.user.domain;

public enum UserStatus {
    ACTIVE,
    BANNED,
    /** Asked to be deleted; personal data is erased after 30 days (A18). */
    DELETION_PENDING,
    DELETED
}
