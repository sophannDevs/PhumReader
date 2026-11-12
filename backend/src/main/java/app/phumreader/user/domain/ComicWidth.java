package app.phumreader.user.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Comic panel width on wide screens: fit the window or a narrow column. */
public enum ComicWidth {
    @JsonProperty("fit")
    FIT,
    @JsonProperty("narrow")
    NARROW
}
