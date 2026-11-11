package app.phumreader.user.service;

import app.phumreader.user.domain.Language;
import app.phumreader.user.domain.ReaderFont;
import app.phumreader.user.domain.ReaderTheme;
import app.phumreader.user.domain.ThemeChoice;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * The Settings page's saved choices. Names and values follow the website's store (src/lib/store.ts:
 * {@code lang}, {@code novelSettings}, {@code notifications}, {@code notifPrefs}) and next-themes.
 */
public final class SettingsViews {

    /** The text sizes the novel reader offers (TEXT_SIZES in reading-settings.tsx). */
    public static final List<Integer> TEXT_SIZES = List.of(14, 16, 18, 20, 22, 24);

    private SettingsViews() {}

    /**
     * @param language menus, buttons and emails
     * @param theme Settings &gt; Appearance
     * @param reader web novel reader defaults
     */
    public record Settings(
            Language language,
            ThemeChoice theme,
            ReaderSettings reader,
            NotificationSettings notifications) {}

    /**
     * @param size text size in px, one of 14, 16, 18, 20, 22, 24
     * @param wide wider line spacing
     */
    public record ReaderSettings(int size, ReaderTheme theme, ReaderFont font, boolean wide) {}

    /**
     * Alert settings (Settings &gt; Notifications, V21-03).
     *
     * @param episodes the push switch for new episodes of subscribed series: the same value as
     *     {@code types.update.push}
     * @param fastPass the push switch for a wanted Fast Pass episode turning free: the same value
     *     as {@code types.fastpass.push}
     * @param types push and email per alert type
     * @param quiet no push during these hours (the inbox item and email still come)
     * @param digest one daily email instead of single emails (saved; not sent yet)
     */
    public record NotificationSettings(
            boolean episodes,
            boolean fastPass,
            AlertTypes types,
            QuietHoursSetting quiet,
            boolean digest) {}

    /**
     * @param update new episodes of subscribed series
     * @param fastpass a wanted Fast Pass episode is now free
     * @param comment replies and likes on your comments
     * @param coins top-ups, refunds and coin news
     * @param news PhumiReader news and offers
     */
    public record AlertTypes(
            AlertSwitch update,
            AlertSwitch fastpass,
            AlertSwitch comment,
            AlertSwitch coins,
            AlertSwitch news) {}

    public record AlertSwitch(boolean push, boolean email) {}

    /**
     * Whole hours in Asia/Phnom_Penh; the window may wrap midnight (22 to 7), the same hour twice
     * means no quiet time.
     *
     * @param from first quiet hour, 0-23
     * @param to first hour that is no longer quiet, 0-23
     */
    public record QuietHoursSetting(boolean on, int from, int to) {}

    /** A partial update: only the fields that are sent change. */
    public record SettingsChange(
            @Nullable Language language,
            @Nullable ThemeChoice theme,
            @Nullable ReaderChange reader,
            @Nullable @Valid NotificationsChange notifications) {}

    /**
     * @param size one of 14, 16, 18, 20, 22, 24
     */
    public record ReaderChange(
            @Nullable Integer size,
            @Nullable ReaderTheme theme,
            @Nullable ReaderFont font,
            @Nullable Boolean wide) {}

    /**
     * Only what is sent changes. {@code episodes} and {@code fastPass} are the same switches as
     * {@code types.update.push} and {@code types.fastpass.push}; when both are sent, {@code types}
     * wins.
     */
    public record NotificationsChange(
            @Nullable Boolean episodes,
            @Nullable Boolean fastPass,
            @Nullable AlertTypesChange types,
            @Nullable @Valid QuietHoursChange quiet,
            @Nullable Boolean digest) {}

    public record AlertTypesChange(
            @Nullable AlertSwitchChange update,
            @Nullable AlertSwitchChange fastpass,
            @Nullable AlertSwitchChange comment,
            @Nullable AlertSwitchChange coins,
            @Nullable AlertSwitchChange news) {}

    public record AlertSwitchChange(@Nullable Boolean push, @Nullable Boolean email) {}

    /**
     * @param from first quiet hour, 0-23 (Asia/Phnom_Penh)
     * @param to first hour that is no longer quiet, 0-23
     */
    public record QuietHoursChange(
            @Nullable Boolean on,
            @Nullable @Min(0) @Max(23) Integer from,
            @Nullable @Min(0) @Max(23) Integer to) {}
}
