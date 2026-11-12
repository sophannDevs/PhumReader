package app.phumreader.user.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** Comic image quality (Settings &gt; Reading); saver uses smaller images. */
public enum ImageQuality {
    @JsonProperty("auto")
    AUTO,
    @JsonProperty("high")
    HIGH,
    @JsonProperty("saver")
    SAVER
}
