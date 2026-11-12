package app.phumreader.user.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Background colour around comic panels. */
public enum ComicBackground {
    @JsonProperty("dark")
    DARK,
    @JsonProperty("light")
    LIGHT
}
