package app.phumreader.user.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.data.domain.Persistable;

/**
 * Per-account settings (table {@code user_settings}), created with the account and edited on the
 * Settings page (P3-17). Accounts made before settings existed (seeded commenters) have no row;
 * they read as {@link #defaults}.
 */
@Entity
@Table(name = "user_settings")
public class UserSettings implements Persistable<UUID> {

    @Id private UUID userId;

    private String language;

    private String theme;

    private short readerTextSize;

    private String readerTheme;

    private String readerFont;

    private boolean readerWideSpacing;

    private boolean notifyNewEpisodes;

    private boolean notifyFastPass;

    @UpdateTimestamp private Instant updatedAt;

    private transient boolean isNew;

    protected UserSettings() {}

    /** The defaults the website starts with (src/lib/store.ts). */
    public static UserSettings defaults(UUID userId, String language) {
        UserSettings settings = new UserSettings();
        settings.userId = userId;
        settings.language = "km".equals(language) ? "km" : "en";
        settings.theme = "SYSTEM";
        settings.readerTextSize = 18;
        settings.readerTheme = "LIGHT";
        settings.readerFont = "SANS";
        settings.readerWideSpacing = true;
        settings.notifyNewEpisodes = true;
        settings.notifyFastPass = false;
        settings.isNew = true;
        return settings;
    }

    @Override
    public UUID getId() {
        return userId;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostPersist
    @PostLoad
    void markStored() {
        isNew = false;
    }

    public Language getLanguage() {
        return Language.ofCode(language);
    }

    public ThemeChoice getTheme() {
        return ThemeChoice.valueOf(theme);
    }

    public int getReaderTextSize() {
        return readerTextSize;
    }

    public ReaderTheme getReaderTheme() {
        return ReaderTheme.valueOf(readerTheme);
    }

    public ReaderFont getReaderFont() {
        return ReaderFont.valueOf(readerFont);
    }

    public boolean isReaderWideSpacing() {
        return readerWideSpacing;
    }

    public boolean isNotifyNewEpisodes() {
        return notifyNewEpisodes;
    }

    public boolean isNotifyFastPass() {
        return notifyFastPass;
    }

    public void changeLanguage(Language value) {
        language = value.code();
    }

    public void changeTheme(ThemeChoice value) {
        theme = value.name();
    }

    public void changeReaderTextSize(int value) {
        readerTextSize = (short) value;
    }

    public void changeReaderTheme(ReaderTheme value) {
        readerTheme = value.name();
    }

    public void changeReaderFont(ReaderFont value) {
        readerFont = value.name();
    }

    public void changeReaderWideSpacing(boolean value) {
        readerWideSpacing = value;
    }

    public void changeNotifyNewEpisodes(boolean value) {
        notifyNewEpisodes = value;
    }

    public void changeNotifyFastPass(boolean value) {
        notifyFastPass = value;
    }
}
