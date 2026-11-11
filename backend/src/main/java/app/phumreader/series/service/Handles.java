package app.phumreader.series.service;

import java.util.Locale;
import java.util.function.Predicate;

/**
 * Creator handles for {@code /creators/<handle>} (V21-05): lower case a-z, 0-9 and "-", up to 40
 * characters. The website's demo uses the same rule ("Dara Vann" gives "dara-vann").
 */
public final class Handles {

    public static final int MAX = 40;

    private Handles() {}

    /** The handle a name asks for: Latin letters and digits only; "creator" when none are left. */
    public static String base(String name) {
        String slug =
                name.toLowerCase(Locale.ROOT)
                        .replaceAll("[^a-z0-9]+", "-")
                        .replaceAll("^-+|-+$", "");
        if (slug.length() > MAX) {
            slug = slug.substring(0, MAX).replaceAll("-+$", "");
        }
        return slug.isEmpty() ? "creator" : slug;
    }

    /** The first free handle for a name: {@code base}, then {@code base-2}, {@code base-3} ... */
    public static String free(String name, Predicate<String> taken) {
        String base = base(name);
        String candidate = base;
        for (int n = 2; taken.test(candidate); n++) {
            String suffix = "-" + n;
            String head =
                    base.length() + suffix.length() > MAX
                            ? base.substring(0, MAX - suffix.length())
                            : base;
            candidate = head.replaceAll("-+$", "") + suffix;
        }
        return candidate;
    }
}
