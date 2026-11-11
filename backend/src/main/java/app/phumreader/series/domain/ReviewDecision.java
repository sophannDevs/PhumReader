package app.phumreader.series.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * How an admin settled a series submitted for review (V21-01). Stored upper case, sent lower case.
 */
public enum ReviewDecision {
    /** The series went live. */
    @JsonProperty("approved")
    APPROVED,
    /** The creator must change the requested items and submit again. */
    @JsonProperty("changes")
    CHANGES,
    /** The series went back to a draft. */
    @JsonProperty("rejected")
    REJECTED
}
