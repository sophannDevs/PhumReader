package app.phumreader.series.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Who can see a series: only its creator (draft), everyone, or nobody (taken down by an admin). */
public enum SeriesVisibility {
    @JsonProperty("draft")
    DRAFT,
    @JsonProperty("published")
    PUBLISHED,
    @JsonProperty("hidden")
    HIDDEN
}
