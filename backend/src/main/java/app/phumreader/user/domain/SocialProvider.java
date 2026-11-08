package app.phumreader.user.domain;

import java.util.Locale;
import java.util.Optional;

/** The sign-in providers besides email and password. */
public enum SocialProvider {
    GOOGLE,
    FACEBOOK;

    /** The name used in URLs ({@code google}, {@code facebook}). */
    public String slug() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static Optional<SocialProvider> fromSlug(String slug) {
        for (SocialProvider provider : values()) {
            if (provider.slug().equals(slug)) {
                return Optional.of(provider);
            }
        }
        return Optional.empty();
    }
}
