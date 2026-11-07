package app.phumreader.auth.service;

import app.phumreader.config.AppProperties;
import app.phumreader.user.domain.SocialProvider;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

/** Google: authorization code flow, then the OpenID Connect userinfo endpoint. */
@Component
class GoogleClient implements SocialClient {

    private static final String AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
    private static final String TOKEN = "https://oauth2.googleapis.com/token";
    private static final String USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

    private final AppProperties.Auth.Provider app;
    private final OAuthHttp http = new OAuthHttp();

    GoogleClient(AppProperties properties) {
        this.app = properties.auth().social().google();
    }

    @Override
    public SocialProvider provider() {
        return SocialProvider.GOOGLE;
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
        query.put("scope", "openid email profile");
        query.put("state", state);
        query.put("prompt", "select_account");
        return URI.create(AUTHORIZE + "?" + OAuthHttp.encode(query));
    }

    @Override
    public SocialProfile fetchProfile(String code, String redirectUri) {
        JsonNode token =
                http.postForm(
                        TOKEN,
                        Map.of(
                                "code",
                                code,
                                "client_id",
                                app.clientId(),
                                "client_secret",
                                app.clientSecret(),
                                "redirect_uri",
                                redirectUri,
                                "grant_type",
                                "authorization_code"));
        String accessToken = text(token, "access_token");
        if (accessToken == null) {
            throw new SocialLoginException("Google sent no access token");
        }
        JsonNode me = http.get(USERINFO, Map.of(), accessToken);
        String subject = text(me, "sub");
        if (subject == null) {
            throw new SocialLoginException("Google sent no user id");
        }
        return new SocialProfile(
                SocialProvider.GOOGLE,
                subject,
                text(me, "email"),
                me.path("email_verified").asBoolean(false),
                text(me, "name"));
    }

    static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() || value.asString().isBlank()
                ? null
                : value.asString();
    }
}
