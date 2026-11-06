package app.phumreader.payment.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Badge on a coin pack ("Popular", "Best value" on the website). */
public enum PackTag {
    @JsonProperty("popular")
    POPULAR,
    @JsonProperty("best_value")
    BEST_VALUE
}
