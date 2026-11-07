package app.phumreader.auth.service;

import app.phumreader.config.AppProperties;
import app.phumreader.user.domain.SocialProvider;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/**
 * Facebook Login: authorization code flow, then the Graph API. Facebook only returns an email it
 * has confirmed, so a returned email counts as verified (it has no separate flag).
 */
@Component
class FacebookClient implements SocialClient {

    private static final String VERSION = "v21.0";
    private static final String AUTHORIZE = "https://www.facebook.com/" + VERSION + "/dialog/oauth";
    private static final String TOKEN =
            "https://graph.facebook.com/" + VERSION + "/oauth/access_token";
    private static final String ME = "https://graph.facebook.com/" + VERSION + "/me";

    private final AppProperties.Auth.Provider app;
    private final OAuthHttp http = new OAuthHttp();

    FacebookClient(AppProperties properties) {
        this.app = properties.auth().social().facebook();
    }

    @Override
    public SocialProvider provider() {
        return SocialProvider.FACEBOOK;
    }

    @Override
    public boolean configured() {
        return app.configured();
    }

    @Override
    public URI authorizeUri(String state, String redirectUri) {
        Map<String, String> query = new LinkedHashMap<>();
        query.put("client_id", app.clientId());
        query.put("redirect_uri", redirectUri);
        query.put("response_type", "code");
        query.put("scope", "email,public_profile");
        query.put("state", state);
        return URI.create(AUTHORIZE + "?" + OAuthHttp.encode(query));
    }

    @Override
    public SocialProfile fetchProfile(String code, String redirectUri) {
        JsonNode token =
                http.get(
                        TOKEN,
                        Map.of(
                                "code",
                                code,
                                "client_id",
                                app.clientId(),
                                "client_secret",
                                app.clientSecret(),
                                "redirect_uri",
                                redirectUri),
                        null);
        String accessToken = GoogleClient.text(token, "access_token");
        if (accessToken == null) {
            throw new SocialLoginException("Facebook sent no access token");
        }
        JsonNode me = http.get(ME, Map.of("fields", "id,name,email"), accessToken);
        String subject = GoogleClient.text(me, "id");
        if (subject == null) {
            throw new SocialLoginException("Facebook sent no user id");
        }
        String email = GoogleClient.text(me, "email");
        return new SocialProfile(
                SocialProvider.FACEBOOK,
                subject,
                email,
                email != null,
                GoogleClient.text(me, "name"));
    }
}
