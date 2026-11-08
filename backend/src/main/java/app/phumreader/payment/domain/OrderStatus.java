package app.phumreader.payment.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * PENDING, then PAID (later REFUNDED by an admin), FAILED, CANCELLED or EXPIRED. Stored upper case,
 * sent lower case.
 */
public enum OrderStatus {
    @JsonProperty("pending")
    PENDING,
    @JsonProperty("paid")
    PAID,
    @JsonProperty("failed")
    FAILED,
    @JsonProperty("cancelled")
    CANCELLED,
    @JsonProperty("expired")
    EXPIRED,
    @JsonProperty("refunded")
    REFUNDED
}
