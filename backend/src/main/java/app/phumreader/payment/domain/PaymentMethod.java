package app.phumreader.payment.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** How an order is paid (A5: cards on the provider's hosted page). Sent as the website's ids. */
public enum PaymentMethod {
    @JsonProperty("khqr")
    KHQR,
    @JsonProperty("aba")
    ABA_PAY,
    @JsonProperty("card")
    CARD
}
