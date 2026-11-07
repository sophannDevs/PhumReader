package app.phumreader.auth.service;

import app.phumreader.user.domain.SocialProvider;
import org.jspecify.annotations.Nullable;

/**
 * Who a provider says the person is.
 *
 * @param subject the provider's own id for the person (never changes, unlike the email)
 * @param emailVerified the provider confirmed the person owns {@code email}
 */
public record SocialProfile(
        SocialProvider provider,
        String subject,
        @Nullable String email,
        boolean emailVerified,
        @Nullable String name) {}
