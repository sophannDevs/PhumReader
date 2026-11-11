package app.phumreader.auth.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.error.RateLimitedException;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.config.AppProperties;
import app.phumreader.notification.service.EmailSender;
import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserStatus;
import app.phumreader.user.service.Account;
import app.phumreader.user.service.UserService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Year;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sign up, email code, log in, refresh, log out, forgot and reset password (plan P3-02), with the
 * rate limits of P3-03.
 */
@Service
@Transactional
public class AuthService {

    static final int LOGIN_FAILURES = 5;
    static final int LOGINS_PER_IP = 30;
    static final Duration LOGIN_WINDOW = Duration.ofMinutes(10);
    static final int SIGNUPS_PER_IP = 10;
    static final Duration SIGNUP_WINDOW = Duration.ofHours(1);
    static final Duration RESEND_COOLDOWN = Duration.ofSeconds(30);
    static final int FORGOT_PER_IP = 10;
    static final int FORGOT_PER_EMAIL = 3;
    static final Duration FORGOT_WINDOW = Duration.ofHours(1);
    static final int RESETS_PER_IP = 10;
    static final Duration RESET_WINDOW = Duration.ofMinutes(10);
    static final Duration RESET_LINK_LIFETIME = Duration.ofMinutes(30);

    /** Who is calling: the client address (rate limits) and browser (device list). */
    public record ClientInfo(String ip, @Nullable String userAgent) {}

    /** A signed-in account and its new cookies. */
    public record SignIn(Account account, IssuedTokens tokens) {}

    /** A sign-up waiting for its email code. */
    public record PendingSignup(String email, Duration codeValidFor, Duration resendAfter) {}

    private final UserService users;
    private final TokenService tokens;
    private final VerificationCodes codes;
    private final ShortLivedStore store;
    private final RateLimiter limiter;
    private final PasswordEncoder passwords;
    private final EmailSender email;
    private static final int MIN_AGE = 13;

    private final Clock clock;
    private final String frontendUrl;
    private final String unknownUserHash;

    public AuthService(
            UserService users,
            TokenService tokens,
            VerificationCodes codes,
            ShortLivedStore store,
            RateLimiter limiter,
            PasswordEncoder passwords,
            EmailSender email,
            Clock clock,
            AppProperties properties) {
        this.users = users;
        this.tokens = tokens;
        this.codes = codes;
        this.store = store;
        this.limiter = limiter;
        this.passwords = passwords;
        this.email = email;
        this.clock = clock;
        this.frontendUrl = properties.frontendUrl().replaceAll("/+$", "");
        // Checked against for unknown emails, so they take as long as known ones.
        this.unknownUserHash = passwords.encode("not-a-real-password");
    }

    // ---------- sign up and email code ----------

    public PendingSignup signUp(
            String displayName,
            String emailAddress,
            String password,
            @Nullable String language,
            @Nullable Integer birthYear,
            ClientInfo client) {
        limiter.acquire(
                "signup:ip:" + client.ip(), SIGNUPS_PER_IP, SIGNUP_WINDOW, "too_many_requests");
        requireStrongPassword(password);
        requireOldEnough(birthYear);
        String address = User.normalizeEmail(emailAddress);
        Optional<User> existing = users.findByEmail(address);
        if (existing.isPresent()) {
            User user = existing.get();
            if (user.isEmailVerified() || user.getStatus() != UserStatus.ACTIVE) {
                throw ApiException.conflict("email_taken", "That email already has an account.");
            }
            users.updateUnverifiedSignup(user, displayName, passwords.encode(password), birthYear);
        } else {
            users.createReader(
                    address, displayName, passwords.encode(password), language, birthYear);
        }
        sendCode(address);
        return new PendingSignup(address, VerificationCodes.LIFETIME, RESEND_COOLDOWN);
    }

    /** Under 13 cannot join (the form says the same). No birth year (older clients) passes. */
    private void requireOldEnough(@Nullable Integer birthYear) {
        if (birthYear != null && Year.now(clock).getValue() - birthYear < MIN_AGE) {
            throw ApiException.invalidField(
                    "birthYear", "too_young", "You must be 13 or older to join.");
        }
    }

    /** The right code confirms the email and signs in (remembered). */
    public SignIn verifyEmail(String emailAddress, String code, ClientInfo client) {
        String address = User.normalizeEmail(emailAddress);
        User user =
                users.findByEmail(address)
                        .orElseThrow(() ->
                                ApiException.invalidField(
                                        "code", "invalid_code", "That code isn't right."));
        if (user.isEmailVerified()) {
            throw ApiException.conflict(
                    "already_verified", "This email is already confirmed. Log in.");
        }
        switch (codes.check(address, code)) {
            case OK -> users.markEmailVerified(user);
            case WRONG ->
                    throw ApiException.invalidField(
                            "code", "invalid_code", "That code isn't right.");
            case EXPIRED ->
                    throw ApiException.invalidField(
                            "code", "code_expired", "This code has expired. Ask for a new one.");
            case TOO_MANY_ATTEMPTS ->
                    throw ApiException.invalidField(
                            "code",
                            "too_many_attempts",
                            "Too many wrong codes. Ask for a new one.");
        }
        users.recordLogin(user);
        return newSession(user, true, client);
    }

    /** A new code, at most once every 30 seconds per email. Unknown emails get the same answer. */
    public void resendCode(String emailAddress) {
        String address = User.normalizeEmail(emailAddress);
        limiter.acquire("resend:" + address, 1, RESEND_COOLDOWN, "resend_too_soon");
        users.findByEmail(address)
                .filter(u -> !u.isEmailVerified() && u.getStatus() == UserStatus.ACTIVE)
                .ifPresent(u -> mailCode(address, codes.issue(address)));
    }

    // ---------- log in, refresh, log out ----------

    /**
     * After 5 wrong passwords for an email in 10 minutes, the next try is refused with 429. Logging
     * in while the account waits to be deleted keeps it (A18).
     */
    public SignIn logIn(String emailAddress, String password, boolean remember, ClientInfo client) {
        String address = User.normalizeEmail(emailAddress);
        limiter.acquire(
                "login:ip:" + client.ip(), LOGINS_PER_IP, LOGIN_WINDOW, "too_many_attempts");
        String failures = "login-fail:" + address;
        limiter.blocked(failures, LOGIN_FAILURES)
                .ifPresent(wait -> {
                    throw new RateLimitedException("too_many_attempts", wait);
                });

        Optional<User> found =
                users.findByEmail(address).filter(u -> u.getStatus() != UserStatus.DELETED);
        String hash = found.map(User::getPasswordHash).orElse(null);
        boolean matches = passwords.matches(password, hash != null ? hash : unknownUserHash);
        if (hash == null || !matches) {
            limiter.hit(failures, LOGIN_WINDOW);
            throw ApiException.unauthorized(
                    "invalid_credentials", "Email or password is incorrect.");
        }
        limiter.reset(failures);

        User user = lifted(found.get());
        if (user.getStatus() == UserStatus.BANNED) {
            throw ApiException.forbidden("account_banned", "This account has been suspended.");
        }
        if (!user.isEmailVerified()) {
            if (limiter.blocked("resend:" + address, 1).isEmpty()) {
                sendCode(address);
            }
            throw ApiException.forbidden(
                    "email_not_verified", "Confirm your email first: we sent you a code.");
        }
        users.recordLogin(user);
        if (users.cancelDeletion(user)) {
            email.send(
                    user.getEmail(),
                    "Your PhumReader account is staying",
                    "You logged in, so your account will not be deleted. Welcome back!\n\n"
                            + "To delete it after all, use Settings > Account again.");
        }
        return newSession(user, remember, client);
    }

    /** New cookies for a valid refresh token; 401 {@code session_expired} otherwise. */
    @Transactional(noRollbackFor = ApiException.class)
    public SignIn refresh(@Nullable String refreshToken, ClientInfo client) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw TokenService.sessionExpired();
        }
        TokenService.Rotation rotation = tokens.rotate(refreshToken, client.userAgent());
        Optional<User> user =
                users.findById(rotation.userId())
                        .map(u -> lifted(u))
                        .filter(AuthService::maySignIn);
        if (user.isEmpty()) {
            tokens.revokeFamily(rotation.familyId());
            throw TokenService.sessionExpired();
        }
        Account account = Account.of(user.get());
        return new SignIn(account, tokens.withAccess(account, rotation));
    }

    public void logOut(@Nullable String refreshToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            tokens.revokeDeviceOf(refreshToken);
        }
    }

    public void logOutEverywhere(UUID userId) {
        tokens.revokeAll(userId);
    }

    // ---------- forgot and reset password ----------

    /** Emails a reset link when the account exists; the answer is the same either way. */
    public void forgotPassword(String emailAddress, ClientInfo client) {
        limiter.acquire(
                "forgot:ip:" + client.ip(), FORGOT_PER_IP, FORGOT_WINDOW, "too_many_requests");
        String address = User.normalizeEmail(emailAddress);
        String perEmail = "forgot:email:" + address;
        if (limiter.blocked(perEmail, FORGOT_PER_EMAIL).isPresent()) {
            return;
        }
        limiter.hit(perEmail, FORGOT_WINDOW);
        users.findByEmail(address)
                .filter(AuthService::maySignIn)
                .ifPresent(user -> {
                    String token = Secrets.randomToken();
                    store.put(
                            resetKey(token),
                            user.getId().toString(),
                            clock.instant().plus(RESET_LINK_LIFETIME));
                    String link =
                            frontendUrl
                                    + "/reset?token="
                                    + URLEncoder.encode(token, StandardCharsets.UTF_8);
                    email.send(
                            address,
                            "Reset your PhumReader password",
                            "Open this link to choose a new password (it works for 30 minutes,"
                                    + " once):\n"
                                    + link
                                    + "\n\nIf you did not ask for this, ignore this email.");
                });
    }

    /** Sets a new password from a reset link and logs the account out everywhere. */
    public void resetPassword(String token, String password, ClientInfo client) {
        limiter.acquire(
                "reset:ip:" + client.ip(), RESETS_PER_IP, RESET_WINDOW, "too_many_requests");
        String key = resetKey(token);
        User user =
                store.get(key)
                        .map(UUID::fromString)
                        .flatMap(users::findById)
                        .filter(AuthService::maySignIn)
                        .orElseThrow(() ->
                                ApiException.badRequest(
                                        "invalid_token",
                                        "This reset link is not valid or has expired."));
        requireStrongPassword(password);
        users.changePassword(user, passwords.encode(password));
        // The link proved the person can read this mailbox.
        users.markEmailVerified(user);
        store.remove(key);
        tokens.revokeAll(user.getId());
    }

    // ---------- helpers ----------

    private SignIn newSession(User user, boolean remember, ClientInfo client) {
        Account account = Account.of(user);
        return new SignIn(account, tokens.newSession(account, remember, client.userAgent()));
    }

    private void sendCode(String address) {
        mailCode(address, codes.issue(address));
        limiter.reset("resend:" + address);
        limiter.hit("resend:" + address, RESEND_COOLDOWN);
    }

    private void mailCode(String address, String code) {
        email.send(
                address,
                "Your PhumReader code: " + code,
                "Your PhumReader code is "
                        + code
                        + ". It works for 10 minutes.\n\nIf you did not sign up, ignore this email.");
    }

    private static void requireStrongPassword(String password) {
        PasswordPolicy.require("password", password);
    }

    /** A timed suspension that is over ends here (V21-04). */
    private User lifted(User user) {
        user.liftSuspensionIfOver(clock.instant());
        return user;
    }

    private static boolean maySignIn(User user) {
        return user.getStatus() == UserStatus.ACTIVE
                || user.getStatus() == UserStatus.DELETION_PENDING;
    }

    private static String resetKey(String token) {
        return "reset:" + Secrets.sha256(token);
    }
}
