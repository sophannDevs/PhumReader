package app.phumreader.series.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Age rating of a series (A10: shown, no age gate in v1). Stored upper case, sent lower case. */
public enum AgeRating {
    @JsonProperty("all")
    ALL,
    @JsonProperty("teen")
    TEEN,
    @JsonProperty("mature")
    MATURE
}
