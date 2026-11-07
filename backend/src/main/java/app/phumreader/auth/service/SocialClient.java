package app.phumreader.auth.service;

import app.phumreader.user.domain.SocialProvider;
import java.net.URI;

/** Talks to one provider's OAuth 2 endpoints (authorization code flow). */
public interface SocialClient {

    SocialProvider provider();

    /** False when the app credentials are not set (the provider is switched off). */
    boolean configured();

    /** The provider's consent page; it sends the person back to {@code redirectUri}. */
    URI authorizeUri(String state, String redirectUri);

    /**
     * Swaps the code for the person's profile.
     *
     * @throws SocialLoginException when the provider refuses or cannot be reached
     */
    SocialProfile fetchProfile(String code, String redirectUri);
}
