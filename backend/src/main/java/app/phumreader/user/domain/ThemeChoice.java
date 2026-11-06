package app.phumreader.user.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Settings > Appearance. Sent as the website's theme names (next-themes). */
public enum ThemeChoice {
    @JsonProperty("system")
    SYSTEM,
    @JsonProperty("light")
    LIGHT,
    @JsonProperty("dark")
    DARK
}
