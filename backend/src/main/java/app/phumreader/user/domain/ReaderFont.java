package app.phumreader.user.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Typeface of the web novel reader. */
public enum ReaderFont {
    @JsonProperty("sans")
    SANS,
    @JsonProperty("serif")
    SERIF
}
