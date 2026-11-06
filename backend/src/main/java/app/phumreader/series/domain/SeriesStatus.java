package app.phumreader.series.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Whether new episodes still come. Stored upper case, sent lower case. */
public enum SeriesStatus {
    @JsonProperty("ongoing")
    ONGOING,
    @JsonProperty("completed")
    COMPLETED,
    @JsonProperty("hiatus")
    HIATUS
}
