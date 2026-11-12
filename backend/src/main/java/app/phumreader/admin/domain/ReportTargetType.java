package app.phumreader.admin.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.jspecify.annotations.Nullable;

/**
 * What a report points at: content (a series, an episode or a comment) or an account. The names are
 * the stored {@code reports.target_type} values.
 */
public enum ReportTargetType {
    @JsonProperty("series")
    SERIES(ContentType.SERIES),
    @JsonProperty("episode")
    EPISODE(ContentType.EPISODE),
    @JsonProperty("comment")
    COMMENT(ContentType.COMMENT),
    /** An account (the creator profile's Report); the account is also the accused. */
    @JsonProperty("user")
    USER(null);

    private final @Nullable ContentType content;

    ReportTargetType(@Nullable ContentType content) {
        this.content = content;
    }

    /** The content an admin can hide, or {@code null} for an account. */
    public @Nullable ContentType content() {
        return content;
    }
}
