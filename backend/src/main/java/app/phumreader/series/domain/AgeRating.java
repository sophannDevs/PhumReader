package app.phumreader.series.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Age rating of a series (A10: shown, no age gate in v1). Stored upper case, sent lower case: all
 * (all ages), teen (13+), teen16 (16+, V21-02) and mature (18+).
 */
public enum AgeRating {
    @JsonProperty("all")
    ALL,
    @JsonProperty("teen")
    TEEN,
    @JsonProperty("teen16")
    TEEN16,
    @JsonProperty("mature")
    MATURE
}
