package app.phumreader.user.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserSettings;
import app.phumreader.user.repository.UserRepository;
import app.phumreader.user.repository.UserSettingsRepository;
import app.phumreader.user.service.SettingsViews.NotificationSettings;
import app.phumreader.user.service.SettingsViews.NotificationsChange;
import app.phumreader.user.service.SettingsViews.ReaderChange;
import app.phumreader.user.service.SettingsViews.ReaderSettings;
import app.phumreader.user.service.SettingsViews.Settings;
import app.phumreader.user.service.SettingsViews.SettingsChange;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
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
    private final Clock clock;

    public UserService(UserRepository users, UserSettingsRepository settings, Clock clock) {
        this.users = users;
        this.settings = settings;
        this.clock = clock;
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

    public void markEmailVerified(User user) {
        user.verifyEmail(clock.instant());
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
            if (notify.episodes() != null) {
                row.changeNotifyNewEpisodes(notify.episodes());
            }
            if (notify.fastPass() != null) {
                row.changeNotifyFastPass(notify.fastPass());
            }
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

    private static Settings view(UserSettings row) {
        return new Settings(
                row.getLanguage(),
                row.getTheme(),
                new ReaderSettings(
                        row.getReaderTextSize(),
                        row.getReaderTheme(),
                        row.getReaderFont(),
                        row.isReaderWideSpacing()),
                new NotificationSettings(row.isNotifyNewEpisodes(), row.isNotifyFastPass()));
    }
}
