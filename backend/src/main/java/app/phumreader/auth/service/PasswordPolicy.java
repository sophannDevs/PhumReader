package app.phumreader.auth.service;

/**
 * The website's password rule (src/components/auth/auth-schemas.ts): at least 3 of these 4 — 8+
 * characters, upper and lower case, a number, a symbol. At most 128 characters.
 */
public final class PasswordPolicy {

    public static final int MAX_LENGTH = 128;

    private PasswordPolicy() {}

    public static boolean isStrongEnough(String password) {
        if (password.length() > MAX_LENGTH) {
            return false;
        }
        int passed = 0;
        if (password.length() >= 8) {
            passed++;
        }
        if (password.chars().anyMatch(c -> c >= 'a' && c <= 'z')
                && password.chars().anyMatch(c -> c >= 'A' && c <= 'Z')) {
            passed++;
        }
        if (password.chars().anyMatch(c -> c >= '0' && c <= '9')) {
            passed++;
        }
        if (password.chars()
                .anyMatch(c ->
                        !(c >= 'a' && c <= 'z')
                                && !(c >= 'A' && c <= 'Z')
                                && !(c >= '0' && c <= '9')
                                && !Character.isWhitespace(c))) {
            passed++;
        }
        return passed >= 3;
    }
}
