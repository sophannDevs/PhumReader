package app.phumreader.admin.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** What the automatic checks found on a series waiting for review (V21-01). */
public enum FlagKind {
    /** Contact details or links in the summary (@handles, URLs, phone numbers). */
    @JsonProperty("contact")
    CONTACT,
    /** A watermark on the cover or the images. Nothing detects it yet: never set. */
    @JsonProperty("watermark")
    WATERMARK,
    /** The title equals, contains or is inside a live series' title. */
    @JsonProperty("similar")
    SIMILAR
}
