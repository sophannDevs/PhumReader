package app.phumreader.user.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Page colours of the web novel reader. */
public enum ReaderTheme {
    @JsonProperty("light")
    LIGHT,
    @JsonProperty("sepia")
    SEPIA,
    @JsonProperty("dark")
    DARK
}
