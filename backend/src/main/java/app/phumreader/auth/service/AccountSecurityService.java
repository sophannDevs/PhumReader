package app.phumreader.auth.service;

import app.phumreader.auth.repository.DeviceQueries.DeviceRow;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.error.RateLimitedException;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.notification.service.EmailSender;
import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserStatus;
import app.phumreader.user.service.Account;
import app.phumreader.user.service.UserService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Settings &gt; Account (plan P3-17): change password, change email with a code, signed-in devices,
 * delete account (A18). Every change asks for the current password; 5 wrong ones in 10 minutes
 * pause these actions with 429.
 */
@Service
@Transactional
public class AccountSecurityService {

    static final int PASSWORD_FAILURES = 5;
    static final Duration PASSWORD_WINDOW = Duration.ofMinutes(10);
    static final Duration EMAIL_CODE_COOLDOWN = Duration.ofSeconds(30);

    private static final ZoneId ZONE = ZoneId.of("Asia/Phnom_Penh");

    /**
     * A signed-in device.
     *
     * @param id the device's id (for signing it out)
     * @param browser e.g. "Chrome"; {@code null} when unknown
     * @param system e.g. "Windows", "iPhone"; {@code null} when unknown
     * @param signedInAt when it logged in
     * @param lastActiveAt its latest visit (refreshed every 15 minutes while the site is open)
     * @param current the device making this request
     */
    public record Device(
            UUID id,
            @Nullable String browser,
            @Nullable String system,
            Instant signedInAt,
            Instant lastActiveAt,
            boolean current) {}

    /** A code was sent to the new address. */
    public record EmailChangeStarted(String email, Duration codeValidFor, Duration resendAfter) {}

    private final UserService users;
    private final TokenService tokens;
    private final VerificationCodes codes;
    private final ShortLivedStore store;
    private final RateLimiter limiter;
    private final PasswordEncoder passwords;
    private final EmailSender email;
    private final Clock clock;

    public AccountSecurityService(
            UserService users,
            TokenService tokens,
            VerificationCodes codes,
            ShortLivedStore store,
            RateLimiter limiter,
            PasswordEncoder passwords,
            EmailSender email,
            Clock clock) {
        this.users = users;
        this.tokens = tokens;
        this.codes = codes;
        this.store = store;
        this.limiter = limiter;
        this.passwords = passwords;
        this.email = email;
        this.clock = clock;
    }

    // ---------- password ----------

    /**
     * Sets a new password and signs out every other device; the device with {@code refreshToken}
     * stays signed in.
     */
    public void changePassword(
            UUID userId,
            String currentPassword,
            String newPassword,
            @Nullable String refreshToken) {
        User user = checkPassword(userId, "currentPassword", currentPassword);
        PasswordPolicy.require("newPassword", newPassword);
        users.changePassword(user, passwords.encode(newPassword));
        tokens.revokeAllExcept(userId, tokens.deviceOf(refreshToken, userId));
        email.send(
                user.getEmail(),
                "Your PhumReader password was changed",
                "Your password was just changed and your other devices were signed out.\n\n"
                        + "If this was not you, use \"Forgot password\" on the log in page right"
                        + " away.");
    }

    // ---------- email ----------

    /** Sends a 6-digit code to the new address; the email changes once the code is entered. */
    public EmailChangeStarted startEmailChange(UUID userId, String newEmail, String password) {
        User user = checkPassword(userId, "password", password);
        String address = User.normalizeEmail(newEmail);
        if (address.equals(user.getEmail())) {
            throw ApiException.invalidField(
                    "newEmail", "same_email", "That is already your email.");
        }
        if (users.findByEmail(address).isPresent()) {
            throw ApiException.conflict("email_taken", "That email already has an account.");
        }
        limiter.acquire("email-change:send:" + userId, 1, EMAIL_CODE_COOLDOWN, "resend_too_soon");
        String code = codes.issueEmailChange(userId, address);
        store.put(pendingKey(userId), address, clock.instant().plus(VerificationCodes.LIFETIME));
        email.send(
                address,
                "Your PhumReader code: " + code,
                "Your PhumReader code is "
                        + code
                        + ". Enter it in Settings to use this email for your account. It works for"
                        + " 10 minutes.\n\nIf you did not ask for this, ignore this email.");
        return new EmailChangeStarted(address, VerificationCodes.LIFETIME, EMAIL_CODE_COOLDOWN);
    }

    /** The right code moves the account to the new address and tells the old one. */
    public Account confirmEmailChange(UUID userId, String code) {
        String address =
                store.get(pendingKey(userId))
                        .orElseThrow(() ->
                                ApiException.invalidField(
                                        "code",
                                        "code_expired",
                                        "This code has expired. Ask for a new one."));
        switch (codes.checkEmailChange(userId, address, code)) {
            case OK -> {}
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
        store.remove(pendingKey(userId));
        User user = signedIn(userId);
        String previous = user.getEmail();
        users.changeEmail(user, address);
        email.send(
                previous,
                "Your PhumReader email was changed",
                "Your PhumReader account now uses "
                        + address
                        + ". Log in with that address from now on.\n\n"
                        + "If this was not you, contact PhumReader support right away.");
        return Account.of(user);
    }

    // ---------- devices ----------

    /** Signed-in devices, the current one first. */
    @Transactional(readOnly = true)
    public List<Device> devices(UUID userId, @Nullable String refreshToken) {
        Optional<UUID> current = tokens.deviceOf(refreshToken, userId);
        return tokens.devices(userId).stream()
                .map(row -> device(row, current))
                .sorted(Comparator.comparing((Device d) -> !d.current()))
                .toList();
    }

    /**
     * Signs out one device; 404 {@code device_not_found} when it is not a signed-in device of this
     * account. Returns {@code true} when it was the device making the request.
     */
    public boolean signOutDevice(UUID userId, UUID deviceId, @Nullable String refreshToken) {
        Optional<UUID> current = tokens.deviceOf(refreshToken, userId);
        if (!tokens.revokeDevice(userId, deviceId)) {
            throw ApiException.notFound("device_not_found", "This device is already signed out.");
        }
        return current.filter(deviceId::equals).isPresent();
    }

    // ---------- delete account ----------

    /**
     * Starts the 30-day grace period (A18) and signs out every device. Logging in before the date
     * keeps the account. Returns the date the account will be erased.
     */
    public Instant deleteAccount(UUID userId, String password) {
        User user = checkPassword(userId, "password", password);
        Instant deleteAfter = users.requestDeletion(user);
        tokens.revokeAll(userId);
        email.send(
                user.getEmail(),
                "Your PhumReader account will be deleted",
                "Your account and personal data will be deleted on "
                        + LocalDate.ofInstant(deleteAfter, ZONE)
                        + ". Your coins and unlocks go with it.\n\n"
                        + "Changed your mind? Log in before then and the account stays.");
        return deleteAfter;
    }

    // ---------- helpers ----------

    /** The signed-in account when {@code password} is its password; 400 otherwise. */
    private User checkPassword(UUID userId, String field, String password) {
        String failures = "password-check:" + userId;
        limiter.blocked(failures, PASSWORD_FAILURES)
                .ifPresent(wait -> {
                    throw new RateLimitedException("too_many_attempts", wait);
                });
        User user = signedIn(userId);
        String hash = user.getPasswordHash();
        // Accounts that only use Google or Facebook have no password: they set one with "Forgot
        // password" first.
        if (hash == null || !passwords.matches(password, hash)) {
            limiter.hit(failures, PASSWORD_WINDOW);
            throw ApiException.invalidField(field, "wrong_password", "That password isn't right.");
        }
        limiter.reset(failures);
        return user;
    }

    private User signedIn(UUID userId) {
        return users.findById(userId)
                .filter(u ->
                        u.getStatus() == UserStatus.ACTIVE
                                || u.getStatus() == UserStatus.DELETION_PENDING)
                .orElseThrow(TokenService::sessionExpired);
    }

    private static Device device(DeviceRow row, Optional<UUID> current) {
        return new Device(
                row.familyId(),
                DeviceNames.browser(row.userAgent()),
                DeviceNames.system(row.userAgent()),
                row.signedInAt(),
                row.lastActiveAt(),
                current.filter(row.familyId()::equals).isPresent());
    }

    private static String pendingKey(UUID userId) {
        return "email-change:to:" + userId;
    }
}
