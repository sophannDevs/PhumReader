package app.phumreader.user.service;

import app.phumreader.user.domain.Language;
import app.phumreader.user.domain.ReaderFont;
import app.phumreader.user.domain.ReaderTheme;
import app.phumreader.user.domain.ThemeChoice;
import java.util.List;
import org.jspecify.annotations.Nullable;

/**
 * The Settings page's saved choices. Names and values follow the website's store (src/lib/store.ts:
 * {@code lang}, {@code novelSettings}, {@code notifications}) and next-themes.
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
     * @param episodes new-episode alerts for subscribed series
     * @param fastPass reminders when a wanted Fast Pass episode turns free
     */
    public record NotificationSettings(boolean episodes, boolean fastPass) {}

    /** A partial update: only the fields that are sent change. */
    public record SettingsChange(
            @Nullable Language language,
            @Nullable ThemeChoice theme,
            @Nullable ReaderChange reader,
            @Nullable NotificationsChange notifications) {}

    /**
     * @param size one of 14, 16, 18, 20, 22, 24
     */
    public record ReaderChange(
            @Nullable Integer size,
            @Nullable ReaderTheme theme,
            @Nullable ReaderFont font,
            @Nullable Boolean wide) {}

    public record NotificationsChange(@Nullable Boolean episodes, @Nullable Boolean fastPass) {}
}
