package app.phumreader.common.paging;

import app.phumreader.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.jspecify.annotations.Nullable;

/**
 * Encodes list positions as opaque cursors and reads {@code ?limit=}. A cursor is the position key
 * (for example {@code 2026-11-05T10:00:00Z|<uuid>}) in URL-safe Base64, so callers never depend on
 * its format.
 */
public final class Cursors {

    public static final int DEFAULT_LIMIT = 20;
    public static final int MAX_LIMIT = 100;

    private Cursors() {}

    public static String encode(String key) {
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(key.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * @return the position key, or {@code null} for the first page
     * @throws ApiException 400 {@code invalid_cursor} when the cursor was not made by {@link
     *     #encode}
     */
    public static @Nullable String decode(@Nullable String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            return new String(Base64.getUrlDecoder().decode(cursor), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ex) {
            throw ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
        }
    }

    /** The page size to use: the default when none is given, otherwise kept between 1 and 100. */
    public static int limit(@Nullable Integer requested) {
        if (requested == null) {
            return DEFAULT_LIMIT;
        }
        return Math.clamp(requested, 1, MAX_LIMIT);
    }
}
