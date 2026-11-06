package app.phumreader.coin.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Why a ledger row changed a balance. Stored upper case, sent lower case. */
public enum LedgerReason {
    /** Coins bought with an order. */
    @JsonProperty("purchase")
    PURCHASE,
    /** Pack bonus, first-purchase bonus or welcome coins. */
    @JsonProperty("bonus")
    BONUS,
    /** Coins spent on a Fast Pass unlock. */
    @JsonProperty("unlock")
    UNLOCK,
    /** Coins given back. */
    @JsonProperty("refund")
    REFUND,
    /** A correction by an admin. */
    @JsonProperty("adjustment")
    ADJUSTMENT
}
