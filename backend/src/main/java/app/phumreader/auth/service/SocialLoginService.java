package app.phumreader.auth.service;

import app.phumreader.auth.service.AuthService.ClientInfo;
import app.phumreader.auth.service.AuthService.SignIn;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.config.AppProperties;
import app.phumreader.notification.service.EmailSender;
import app.phumreader.user.domain.SocialProvider;
import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserStatus;
import app.phumreader.user.service.Account;
import app.phumreader.user.service.UserService;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sign in with Google or Facebook (plan P3-04). The person is sent to the provider with a random
 * {@code state}; when they return, the code is swapped for a profile and the profile is matched to
 * an account: by the provider's id first, then by a verified email (the accounts are linked), and
 * otherwise a new account is made.
 */
@Service
@Transactional
public class SocialLoginService {

    static final Duration STATE_LIFETIME = Duration.ofMinutes(10);
    static final int STARTS_PER_IP = 30;
    static final Duration START_WINDOW = Duration.ofMinutes(10);
    private static final int NAME_MAX = 60;

    /** Where to send the person, and the state to remember in their browser. */
    public record Started(URI providerUri, String state) {}

    private final Map<SocialProvider, SocialClient> clients = new EnumMap<>(SocialProvider.class);
    private final UserService users;
    private final TokenService tokens;
    private final ShortLivedStore store;
    private final RateLimiter limiter;
    private final EmailSender email;
    private final Clock clock;
    private final String frontendUrl;

    public SocialLoginService(
            List<SocialClient> clients,
            UserService users,
            TokenService tokens,
            ShortLivedStore store,
            RateLimiter limiter,
            EmailSender email,
            Clock clock,
            AppProperties properties) {
        // The first client of a provider wins (tests put a fake one first).
        clients.forEach(c -> this.clients.putIfAbsent(c.provider(), c));
        this.users = users;
        this.tokens = tokens;
        this.store = store;
        this.limiter = limiter;
        this.email = email;
        this.clock = clock;
        this.frontendUrl = properties.frontendUrl().replaceAll("/+$", "");
    }

    /** {@code false} when the provider's app credentials are not set. */
    public boolean available(SocialProvider provider) {
        SocialClient client = clients.get(provider);
        return client != null && client.configured();
    }

    /** The website's address for a language: {@code /login} or {@code /km/login}. */
    public String loginPage(String language) {
        return frontendUrl + ("km".equals(language) ? "/km" : "") + "/login";
    }

    public Started start(SocialProvider provider, String language, ClientInfo client) {
        limiter.acquire(
                "oauth:ip:" + client.ip(), STARTS_PER_IP, START_WINDOW, "too_many_requests");
        if (!available(provider)) {
            throw ApiException.notFound("social_unavailable", "This sign-in is not set up.");
        }
        String state = Secrets.randomToken();
        store.put(
                stateKey(state),
                "km".equals(language) ? "km" : "en",
                clock.instant().plus(STATE_LIFETIME));
        return new Started(clients.get(provider).authorizeUri(state, redirectUri(provider)), state);
    }

    /**
     * Uses up the state (once only) and returns the language chosen at the start. Empty when the
     * state is unknown or expired, or the browser's copy does not match (someone else's link).
     */
    public Optional<String> consumeState(String state, String browserState) {
        if (state == null || browserState == null || !Secrets.sameHash(state, browserState)) {
            return Optional.empty();
        }
        Optional<String> language = store.get(stateKey(state));
        store.remove(stateKey(state));
        return language;
    }

    public SignIn signIn(SocialProvider provider, String code, String language, ClientInfo client) {
        limiter.acquire(
                "oauth:ip:" + client.ip(), STARTS_PER_IP, START_WINDOW, "too_many_requests");
        SocialProfile profile;
        try {
            profile = clients.get(provider).fetchProfile(code, redirectUri(provider));
        } catch (SocialLoginException ex) {
            throw ApiException.badRequest("social_failed", "The sign-in could not be completed.");
        }
        User user = match(profile, language);
        if (user.getStatus() == UserStatus.BANNED) {
            throw ApiException.forbidden("account_banned", "This account has been suspended.");
        }
        if (user.getStatus() == UserStatus.DELETED) {
            throw ApiException.forbidden("social_failed", "This account is no longer available.");
        }
        users.recordLogin(user);
        if (users.cancelDeletion(user)) {
            email.send(
                    user.getEmail(),
                    "Your PhumReader account is staying",
                    "You logged in, so your account will not be deleted. Welcome back!\n\n"
                            + "To delete it after all, use Settings > Account again.");
        }
        Account account = Account.of(user);
        return new SignIn(account, tokens.newSession(account, true, null));
    }

    private User match(SocialProfile profile, String language) {
        Optional<User> known = users.findByIdentity(profile.provider(), profile.subject());
        if (known.isPresent()) {
            return known.get();
        }
        if (profile.email() == null) {
            throw ApiException.badRequest(
                    "social_no_email", "The provider did not share an email address.");
        }
        if (!profile.emailVerified()) {
            throw ApiException.badRequest(
                    "social_email_unverified", "The provider has not confirmed this email.");
        }
        String address = User.normalizeEmail(profile.email());
        Optional<User> sameEmail = users.findByEmail(address);
        if (sameEmail.isPresent()) {
            User user = sameEmail.get();
            if (user.getStatus() != UserStatus.DELETED) {
                users.linkIdentity(user, profile.provider(), profile.subject(), address);
            }
            return user;
        }
        return users.createSocialReader(
                address,
                displayName(profile, address),
                language,
                profile.provider(),
                profile.subject());
    }

    private static String displayName(SocialProfile profile, String address) {
        String name = profile.name() == null ? "" : profile.name().trim();
        if (name.isEmpty()) {
            name = address.substring(0, address.indexOf('@'));
        }
        return name.length() > NAME_MAX ? name.substring(0, NAME_MAX).trim() : name;
    }

    private String redirectUri(SocialProvider provider) {
        return frontendUrl + "/api/v1/auth/oauth/" + provider.slug() + "/callback";
    }

    private static String stateKey(String state) {
        return "oauth-state:" + Secrets.sha256(state);
    }
}
