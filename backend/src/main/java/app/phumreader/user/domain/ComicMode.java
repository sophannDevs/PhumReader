package app.phumreader.user.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** How the comic reader shows episodes: one long scroll or page by page. */
public enum ComicMode {
    @JsonProperty("scroll")
    SCROLL,
    @JsonProperty("page")
    PAGE
}
