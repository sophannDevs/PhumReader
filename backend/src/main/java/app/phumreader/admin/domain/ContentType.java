package app.phumreader.admin.domain;

import app.phumreader.common.error.ApiException;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * What an admin can hide: a series, an episode or a comment (A8). {@code table}, {@code column},
 * {@code live} and {@code hidden} name the stored state; they are fixed here and never come from a
 * request, so they are safe to put in SQL.
 */
public enum ContentType {
    @JsonProperty("series")
    SERIES("series", "visibility", "PUBLISHED", "HIDDEN"),
    @JsonProperty("episode")
    EPISODE("episodes", "status", "PUBLISHED", "HIDDEN"),
    @JsonProperty("comment")
    COMMENT("comments", "status", "VISIBLE", "HIDDEN");

    private final String table;
    private final String column;
    private final String live;
    private final String hidden;

    ContentType(String table, String column, String live, String hidden) {
        this.table = table;
        this.column = column;
        this.live = live;
        this.hidden = hidden;
    }

    /** Reads {@code series}, {@code episode} or {@code comment} (any case). */
    public static ContentType parse(String value) {
        for (ContentType t : values()) {
            if (t.name().equalsIgnoreCase(value)) {
                return t;
            }
        }
        throw ApiException.badRequest(
                "invalid_type", "The type must be series, episode or comment.");
    }

    public String table() {
        return table;
    }

    public String column() {
        return column;
    }

    /** The state of content readers can see. */
    public String live() {
        return live;
    }

    /** The state of content an admin took down. */
    public String hidden() {
        return hidden;
    }
}
