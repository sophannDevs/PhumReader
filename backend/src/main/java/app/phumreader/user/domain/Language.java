package app.phumreader.user.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/** The site language (menus, buttons and emails). Stored and sent as the locale code. */
public enum Language {
    @JsonProperty("en")
    EN("en"),
    @JsonProperty("km")
    KM("km");

    private final String code;

    Language(String code) {
        this.code = code;
    }

    public String code() {
        return code;
    }

    public static Language ofCode(String code) {
        return "km".equals(code) ? KM : EN;
    }
}
