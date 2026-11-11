package app.phumreader.series.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Who can see a series. Only {@code PUBLISHED} reaches readers; the creator sees the others: a
 * draft, a series waiting for an admin's review ({@code REVIEW}), one the admin sent back with
 * requested changes ({@code CHANGES}), and one an admin took down ({@code HIDDEN}).
 */
public enum SeriesVisibility {
    @JsonProperty("draft")
    DRAFT,
    @JsonProperty("review")
    REVIEW,
    @JsonProperty("changes")
    CHANGES,
    @JsonProperty("published")
    PUBLISHED,
    @JsonProperty("hidden")
    HIDDEN
}
