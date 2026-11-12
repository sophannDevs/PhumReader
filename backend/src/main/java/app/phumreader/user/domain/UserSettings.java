package app.phumreader.user.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.UpdateTimestamp;
import org.jspecify.annotations.Nullable;
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

    /** Push for new episodes (alert type "update"). */
    private boolean notifyNewEpisodes;

    /** Push when a wanted Fast Pass episode turns free (alert type "fastpass"). */
    private boolean notifyFastPass;

    private boolean emailNewEpisodes;

    private boolean emailFastPass;

    private boolean pushComments;

    private boolean emailComments;

    private boolean pushCoins;

    private boolean emailCoins;

    private boolean pushNews;

    private boolean emailNews;

    private boolean quietHours;

    private short quietFrom;

    private short quietTo;

    private boolean dailyDigest;

    /** Welcome / Home picks: comma-separated genre names; null = never chosen, empty = skipped. */
    @Nullable private String preferredGenres;

    /** Story languages, comma-separated locale codes (at least one). */
    private String storyLanguages;

    // Comic reader and data use (V21-08); enum names as in the other enum columns.
    private String comicMode;

    private String imageQuality;

    private boolean autoNext;

    private boolean dataSaver;

    private String comicBackground;

    private String comicWidth;

    // Privacy (V21-08).
    private String region;

    /** Saved only: nothing is shown publicly yet. */
    private boolean publicLibrary;

    /** Saved only: 16+ / 18+ series are not filtered by it yet. */
    private boolean matureContent;

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
        // Alert settings: src/lib/store.ts defaultNotifPrefs.
        settings.notifyNewEpisodes = true;
        settings.emailNewEpisodes = false;
        settings.notifyFastPass = true;
        settings.emailFastPass = false;
        settings.pushComments = true;
        settings.emailComments = false;
        settings.pushCoins = true;
        settings.emailCoins = true;
        settings.pushNews = false;
        settings.emailNews = false;
        settings.quietHours = true;
        settings.quietFrom = 22;
        settings.quietTo = 7;
        settings.dailyDigest = false;
        settings.storyLanguages = "en,km";
        settings.comicMode = "SCROLL";
        settings.imageQuality = "AUTO";
        settings.autoNext = true;
        settings.dataSaver = false;
        settings.comicBackground = "DARK";
        settings.comicWidth = "FIT";
        settings.region = "KH";
        settings.publicLibrary = false;
        settings.matureContent = false;
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

    /** One alert type's push and email switches. */
    public record Alert(boolean push, boolean email) {}

    /**
     * @param type {@code update}, {@code fastpass}, {@code comment}, {@code coins} or {@code news}
     */
    public Alert alert(String type) {
        return switch (type) {
            case "update" -> new Alert(notifyNewEpisodes, emailNewEpisodes);
            case "fastpass" -> new Alert(notifyFastPass, emailFastPass);
            case "comment" -> new Alert(pushComments, emailComments);
            case "coins" -> new Alert(pushCoins, emailCoins);
            case "news" -> new Alert(pushNews, emailNews);
            default -> throw new IllegalArgumentException("Unknown alert type " + type);
        };
    }

    /** Switches push and / or email of one alert type ({@code null}: unchanged). */
    public void changeAlert(String type, @Nullable Boolean push, @Nullable Boolean email) {
        switch (type) {
            case "update" -> {
                notifyNewEpisodes = push != null ? push : notifyNewEpisodes;
                emailNewEpisodes = email != null ? email : emailNewEpisodes;
            }
            case "fastpass" -> {
                notifyFastPass = push != null ? push : notifyFastPass;
                emailFastPass = email != null ? email : emailFastPass;
            }
            case "comment" -> {
                pushComments = push != null ? push : pushComments;
                emailComments = email != null ? email : emailComments;
            }
            case "coins" -> {
                pushCoins = push != null ? push : pushCoins;
                emailCoins = email != null ? email : emailCoins;
            }
            case "news" -> {
                pushNews = push != null ? push : pushNews;
                emailNews = email != null ? email : emailNews;
            }
            default -> throw new IllegalArgumentException("Unknown alert type " + type);
        }
    }

    public boolean isQuietHours() {
        return quietHours;
    }

    public int getQuietFrom() {
        return quietFrom;
    }

    public int getQuietTo() {
        return quietTo;
    }

    public boolean isDailyDigest() {
        return dailyDigest;
    }

    /** Quiet hours; {@code null}: unchanged. Hours are 0-23 (checked by the caller). */
    public void changeQuietHours(
            @Nullable Boolean on, @Nullable Integer from, @Nullable Integer to) {
        if (on != null) {
            quietHours = on;
        }
        if (from != null) {
            quietFrom = from.shortValue();
        }
        if (to != null) {
            quietTo = to.shortValue();
        }
    }

    public void changeDailyDigest(boolean value) {
        dailyDigest = value;
    }

    /** Null when the reader never chose; empty when they skipped. */
    @Nullable
    public List<String> getPreferredGenres() {
        if (preferredGenres == null) {
            return null;
        }
        return preferredGenres.isEmpty() ? List.of() : List.of(preferredGenres.split(",", -1));
    }

    public List<Language> getStoryLanguages() {
        return List.of(storyLanguages.split(",")).stream().map(Language::ofCode).toList();
    }

    public void changePreferredGenres(List<String> genres) {
        preferredGenres = String.join(",", genres);
    }

    public void changeStoryLanguages(List<Language> languages) {
        storyLanguages = String.join(",", languages.stream().map(Language::code).toList());
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

    public ComicMode getComicMode() {
        return ComicMode.valueOf(comicMode);
    }

    public ImageQuality getImageQuality() {
        return ImageQuality.valueOf(imageQuality);
    }

    public boolean isAutoNext() {
        return autoNext;
    }

    public boolean isDataSaver() {
        return dataSaver;
    }

    public ComicBackground getComicBackground() {
        return ComicBackground.valueOf(comicBackground);
    }

    public ComicWidth getComicWidth() {
        return ComicWidth.valueOf(comicWidth);
    }

    public Region getRegion() {
        return Region.valueOf(region);
    }

    /** Saved only; the library is not shown to others yet. */
    public boolean isPublicLibrary() {
        return publicLibrary;
    }

    /** Saved only; series are not filtered by it yet. */
    public boolean isMatureContent() {
        return matureContent;
    }

    public void changeComicMode(ComicMode value) {
        comicMode = value.name();
    }

    public void changeImageQuality(ImageQuality value) {
        imageQuality = value.name();
    }

    public void changeAutoNext(boolean value) {
        autoNext = value;
    }

    public void changeDataSaver(boolean value) {
        dataSaver = value;
    }

    public void changeComicBackground(ComicBackground value) {
        comicBackground = value.name();
    }

    public void changeComicWidth(ComicWidth value) {
        comicWidth = value.name();
    }

    public void changeRegion(Region value) {
        region = value.name();
    }

    public void changePublicLibrary(boolean value) {
        publicLibrary = value;
    }

    public void changeMatureContent(boolean value) {
        matureContent = value;
    }
}
