package app.phumreader.series.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Comic (images) or web novel (chapter text). Stored upper case, sent lower case. */
public enum SeriesType {
    @JsonProperty("comic")
    COMIC,
    @JsonProperty("novel")
    NOVEL
}
