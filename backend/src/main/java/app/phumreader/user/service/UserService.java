package app.phumreader.user.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserSettings;
import app.phumreader.user.repository.UserRepository;
import app.phumreader.user.repository.UserSettingsRepository;
import java.time.Clock;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Accounts: the only way other features reach the users table. */
@Service
@Transactional
public class UserService {

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

    public void changePassword(User user, String passwordHash) {
        user.changePassword(passwordHash);
    }

    public void markEmailVerified(User user) {
        user.verifyEmail(clock.instant());
    }

    public void recordLogin(User user) {
        user.recordLogin(clock.instant());
    }
}
