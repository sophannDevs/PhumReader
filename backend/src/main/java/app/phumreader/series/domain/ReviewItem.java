package app.phumreader.series.domain;

import app.phumreader.common.error.ApiException;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Locale;

/**
 * Something an admin asks the creator to change before a series can go live (V21-01): the five
 * reasons of the admin page. They travel and are stored as lower-case keys ({@link #key()}); the
 * website translates them.
 */
public enum ReviewItem {
    /** Contact details or links in the summary. */
    @JsonProperty("contact")
    CONTACT,
    @JsonProperty("cover")
    COVER,
    @JsonProperty("title")
    TITLE,
    /** The age rating does not fit the content. */
    @JsonProperty("age")
    AGE,
    @JsonProperty("images")
    IMAGES;

    /** The key the website and the database use, e.g. {@code contact}. */
    public String key() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** Reads a stored key. */
    public static ReviewItem ofKey(String key) {
        return valueOf(key.toUpperCase(Locale.ROOT));
    }

    /**
     * Reads a key from a request (any case).
     *
     * @throws ApiException 400 {@code invalid_item} for anything else
     */
    public static ReviewItem parse(String value) {
        for (ReviewItem item : values()) {
            if (item.name().equalsIgnoreCase(value)) {
                return item;
            }
        }
        throw ApiException.badRequest(
                "invalid_item", "The item must be contact, cover, title, age or images.");
    }
}
