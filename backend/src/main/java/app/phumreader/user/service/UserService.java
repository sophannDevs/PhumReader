package app.phumreader.user.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.media.domain.UploadKind;
import app.phumreader.media.service.MediaService;
import app.phumreader.notification.service.NotificationInbox;
import app.phumreader.user.domain.SocialProvider;
import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserIdentity;
import app.phumreader.user.domain.UserSettings;
import app.phumreader.user.repository.UserIdentityRepository;
import app.phumreader.user.repository.UserRepository;
import app.phumreader.user.repository.UserSettingsRepository;
import app.phumreader.user.service.SettingsViews.AlertSwitch;
import app.phumreader.user.service.SettingsViews.AlertSwitchChange;
import app.phumreader.user.service.SettingsViews.AlertTypes;
import app.phumreader.user.service.SettingsViews.AlertTypesChange;
import app.phumreader.user.service.SettingsViews.NotificationSettings;
import app.phumreader.user.service.SettingsViews.NotificationsChange;
import app.phumreader.user.service.SettingsViews.QuietHoursChange;
import app.phumreader.user.service.SettingsViews.QuietHoursSetting;
import app.phumreader.user.service.SettingsViews.ReaderChange;
import app.phumreader.user.service.SettingsViews.ReaderSettings;
import app.phumreader.user.service.SettingsViews.Settings;
import app.phumreader.user.service.SettingsViews.SettingsChange;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Accounts: the only way other features reach the users table. */
@Service
@Transactional
public class UserService {

    /** How long a deleted account can still be restored by logging in (A18). */
    public static final Duration DELETION_GRACE = Duration.ofDays(30);

    private static final int NAME_MIN = 2;

    private final UserRepository users;
    private final UserSettingsRepository settings;
    private final UserIdentityRepository identities;
    private final MediaService media;
    private final NotificationInbox inbox;
    private final Clock clock;

    public UserService(
            UserRepository users,
            UserSettingsRepository settings,
            UserIdentityRepository identities,
            MediaService media,
            NotificationInbox inbox,
            Clock clock) {
        this.media = media;
        this.inbox = inbox;
        this.users = users;
        this.settings = settings;
        this.identities = identities;
        this.clock = clock;
    }

    // ---------- Google and Facebook (P3-04) ----------

    /** The account that signed in with this provider before. */
    @Transactional(readOnly = true)
    public Optional<User> findByIdentity(SocialProvider provider, String providerUserId) {
        return identities
                .findByProviderAndProviderUserId(provider, providerUserId)
                .flatMap(identity -> users.findById(identity.getUserId()));
    }

    /**
     * Ties a provider sign-in to an account. The provider has confirmed the email, so the account's
     * email counts as confirmed; a password typed at sign-up before confirming is dropped.
     */
    public void linkIdentity(
            User user, SocialProvider provider, String providerUserId, String email) {
        if (!user.isEmailVerified()) {
            user.removePassword();
            user.verifyEmail(clock.instant());
            welcome(user);
        }
        identities.save(
                UserIdentity.link(user.getId(), provider, providerUserId, email, clock.instant()));
    }

    /** A reader whose email the provider has confirmed; no password. */
    public User createSocialReader(
            String email,
            String displayName,
            String language,
            SocialProvider provider,
            String providerUserId) {
        User user = users.save(User.newSocialReader(email, displayName, clock.instant()));
        settings.save(UserSettings.defaults(user.getId(), language));
        identities.save(
                UserIdentity.link(user.getId(), provider, providerUserId, email, clock.instant()));
        welcome(user);
        return user;
    }

    @Transactional(readOnly = true)
    public Optional<User> findByEmail(String email) {
        return users.findByEmail(User.normalizeEmail(email));
    }

    @Transactional(readOnly = true)
    public Optional<User> findById(UUID id) {
        return users.findById(id);
    }

    @Transactional(readOnly = true)
    public Account account(UUID id) {
        return users.findById(id)
                .map(Account::of)
                .orElseThrow(() -> ApiException.notFound("user_not_found", "No such account."));
    }

    /** A new reader with default settings; the email still has to be confirmed. */
    public User createReader(
            String email, String displayName, String passwordHash, String language) {
        User user = users.save(User.newReader(email, displayName, passwordHash));
        settings.save(UserSettings.defaults(user.getId(), language));
        return user;
    }

    /** Signing up again before confirming the email replaces the name and password. */
    public void updateUnverifiedSignup(User user, String displayName, String passwordHash) {
        user.changeUnverifiedSignup(displayName, passwordHash);
    }

    /** Makes the account a creator. The access token carries the role after its next refresh. */
    public void grantCreator(UUID userId) {
        User user =
                users.findById(userId)
                        .orElseThrow(
                                () -> ApiException.notFound("user_not_found", "No such account."));
        user.grantCreator();
        users.saveAndFlush(user);
    }

    public void changePassword(User user, String passwordHash) {
        user.changePassword(passwordHash);
    }

    /** Confirms the email; the first time, the account gets the welcome notification. */
    public void markEmailVerified(User user) {
        if (!user.isEmailVerified()) {
            user.verifyEmail(clock.instant());
            welcome(user);
        }
    }

    /** The welcome item in the notifications inbox (V21-03), once per account. */
    private void welcome(User user) {
        // The account row may still wait in the persistence context; the item points at it.
        users.flush();
        inbox.welcome(user.getId());
    }

    public void recordLogin(User user) {
        user.recordLogin(clock.instant());
    }

    // ---------- profile and settings (P3-17) ----------

    /** Changes the display name (trimmed, 2 to 60 characters). */
    public Account rename(UUID userId, String displayName) {
        String name = displayName.trim();
        if (name.length() < NAME_MIN) {
            throw ApiException.invalidField(
                    "displayName", "name_too_short", "Use at least 2 characters.");
        }
        User user = require(userId);
        user.rename(name);
        return Account.of(user);
    }

    /** Sets the profile picture from one of this account's finished AVATAR uploads. */
    public Account setAvatar(UUID userId, UUID uploadId) {
        User user = require(userId);
        user.changeAvatar(media.readyImage(userId, uploadId, UploadKind.AVATAR, "uploadId").url());
        return Account.of(user);
    }

    /** Back to the initials. */
    public Account removeAvatar(UUID userId) {
        User user = require(userId);
        user.changeAvatar(null);
        return Account.of(user);
    }

    @Transactional(readOnly = true)
    public Settings settings(UUID userId) {
        return view(settings.findById(userId).orElseGet(() -> UserSettings.defaults(userId, "en")));
    }

    /**
     * Saves the fields that are sent; 400 {@code invalid_text_size} for a size the reader lacks.
     */
    public Settings updateSettings(UUID userId, SettingsChange change) {
        ReaderChange reader = change.reader();
        if (reader != null
                && reader.size() != null
                && !SettingsViews.TEXT_SIZES.contains(reader.size())) {
            throw ApiException.invalidField(
                    "reader.size",
                    "invalid_text_size",
                    "Text size must be one of " + SettingsViews.TEXT_SIZES + ".");
        }
        require(userId);
        UserSettings row =
                settings.findById(userId)
                        .orElseGet(() -> settings.save(UserSettings.defaults(userId, "en")));
        if (change.language() != null) {
            row.changeLanguage(change.language());
        }
        if (change.theme() != null) {
            row.changeTheme(change.theme());
        }
        if (reader != null) {
            if (reader.size() != null) {
                row.changeReaderTextSize(reader.size());
            }
            if (reader.theme() != null) {
                row.changeReaderTheme(reader.theme());
            }
            if (reader.font() != null) {
                row.changeReaderFont(reader.font());
            }
            if (reader.wide() != null) {
                row.changeReaderWideSpacing(reader.wide());
            }
        }
        NotificationsChange notify = change.notifications();
        if (notify != null) {
            changeAlerts(row, notify);
        }
        return view(row);
    }

    // ---------- email change and deletion (called by the auth feature) ----------

    /**
     * Sets a confirmed new email; 409 {@code email_taken} when another account took it meanwhile.
     */
    public void changeEmail(User user, String email) {
        user.changeEmail(email, clock.instant());
        try {
            users.flush();
        } catch (DataIntegrityViolationException ex) {
            throw ApiException.conflict("email_taken", "That email already has an account.");
        }
    }

    /** Starts the grace period and returns when the account will be erased. */
    public Instant requestDeletion(User user) {
        user.requestDeletion(clock.instant());
        Instant requested = user.getDeletionRequestedAt();
        return (requested != null ? requested : clock.instant()).plus(DELETION_GRACE);
    }

    /** Logging in during the grace period keeps the account; {@code true} when it was pending. */
    public boolean cancelDeletion(User user) {
        return user.cancelDeletion();
    }

    /** Suspends the account; {@code false} when it already was. */
    public boolean ban(UUID userId) {
        User user = require(userId);
        boolean changed = user.ban();
        users.saveAndFlush(user);
        return changed;
    }

    /** Lifts a suspension; {@code false} when the account was not suspended. */
    public boolean unban(UUID userId) {
        User user = require(userId);
        boolean changed = user.unban();
        users.saveAndFlush(user);
        return changed;
    }

    private User require(UUID userId) {
        return users.findById(userId)
                .orElseThrow(() -> ApiException.notFound("user_not_found", "No such account."));
    }

    /**
     * The alert settings that are sent: the two older switches first, then {@code types} (which
     * wins when both say something about the same switch), quiet hours and the digest.
     */
    private static void changeAlerts(UserSettings row, NotificationsChange notify) {
        if (notify.episodes() != null) {
            row.changeNotifyNewEpisodes(notify.episodes());
        }
        if (notify.fastPass() != null) {
            row.changeNotifyFastPass(notify.fastPass());
        }
        AlertTypesChange types = notify.types();
        if (types != null) {
            changeAlert(row, "update", types.update());
            changeAlert(row, "fastpass", types.fastpass());
            changeAlert(row, "comment", types.comment());
            changeAlert(row, "coins", types.coins());
            changeAlert(row, "news", types.news());
        }
        QuietHoursChange quiet = notify.quiet();
        if (quiet != null) {
            row.changeQuietHours(quiet.on(), quiet.from(), quiet.to());
        }
        if (notify.digest() != null) {
            row.changeDailyDigest(notify.digest());
        }
    }

    private static void changeAlert(
            UserSettings row, String type, @Nullable AlertSwitchChange change) {
        if (change != null) {
            row.changeAlert(type, change.push(), change.email());
        }
    }

    private static Settings view(UserSettings row) {
        return new Settings(
                row.getLanguage(),
                row.getTheme(),
                new ReaderSettings(
                        row.getReaderTextSize(),
                        row.getReaderTheme(),
                        row.getReaderFont(),
                        row.isReaderWideSpacing()),
                new NotificationSettings(
                        row.isNotifyNewEpisodes(),
                        row.isNotifyFastPass(),
                        new AlertTypes(
                                alert(row, "update"),
                                alert(row, "fastpass"),
                                alert(row, "comment"),
                                alert(row, "coins"),
                                alert(row, "news")),
                        new QuietHoursSetting(
                                row.isQuietHours(), row.getQuietFrom(), row.getQuietTo()),
                        row.isDailyDigest()));
    }

    private static AlertSwitch alert(UserSettings row, String type) {
        UserSettings.Alert alert = row.alert(type);
        return new AlertSwitch(alert.push(), alert.email());
    }
}
