package app.phumreader.auth.service;

import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/**
 * Browser and system names from a User-Agent header, for the devices list ("Chrome on Windows").
 * Only the common cases; anything else is {@code null} and the website shows "Unknown".
 */
public final class DeviceNames {

    /** Checked in order: Edge and Opera also say "Chrome", Chrome also says "Safari". */
    private static final List<Map.Entry<String, String>> BROWSERS =
            List.of(
                    Map.entry("Edg/", "Edge"),
                    Map.entry("EdgA/", "Edge"),
                    Map.entry("EdgiOS/", "Edge"),
                    Map.entry("OPR/", "Opera"),
                    Map.entry("SamsungBrowser/", "Samsung Internet"),
                    Map.entry("Firefox/", "Firefox"),
                    Map.entry("FxiOS/", "Firefox"),
                    Map.entry("CriOS/", "Chrome"),
                    Map.entry("Chrome/", "Chrome"),
                    Map.entry("Safari/", "Safari"));

    /** Checked in order: Android also says "Linux", iPhone also says "Mac OS X". */
    private static final List<Map.Entry<String, String>> SYSTEMS =
            List.of(
                    Map.entry("Windows", "Windows"),
                    Map.entry("Android", "Android"),
                    Map.entry("iPhone", "iPhone"),
                    Map.entry("iPad", "iPad"),
                    Map.entry("CrOS", "ChromeOS"),
                    Map.entry("Macintosh", "macOS"),
                    Map.entry("Linux", "Linux"));

    private DeviceNames() {}

    public static @Nullable String browser(@Nullable String userAgent) {
        return first(BROWSERS, userAgent);
    }

    public static @Nullable String system(@Nullable String userAgent) {
        return first(SYSTEMS, userAgent);
    }

    private static @Nullable String first(
            List<Map.Entry<String, String>> names, @Nullable String userAgent) {
        if (userAgent == null) {
            return null;
        }
        for (Map.Entry<String, String> name : names) {
            if (userAgent.contains(name.getKey())) {
                return name.getValue();
            }
        }
        return null;
    }
}
