package app.phumreader.user.domain;

/**
 * What a user may do. Every account is a READER; CREATOR after accepting the Creator terms (A11).
 */
public enum Role {
    READER,
    CREATOR,
    ADMIN
}
