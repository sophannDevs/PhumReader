package app.phumreader.series.service;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.DayOfWeek;

/** A day of the week as the website writes it ("Mon" … "Sun"). */
public enum Weekday {
    @JsonProperty("Mon")
    MON(DayOfWeek.MONDAY, "Mon"),
    @JsonProperty("Tue")
    TUE(DayOfWeek.TUESDAY, "Tue"),
    @JsonProperty("Wed")
    WED(DayOfWeek.WEDNESDAY, "Wed"),
    @JsonProperty("Thu")
    THU(DayOfWeek.THURSDAY, "Thu"),
    @JsonProperty("Fri")
    FRI(DayOfWeek.FRIDAY, "Fri"),
    @JsonProperty("Sat")
    SAT(DayOfWeek.SATURDAY, "Sat"),
    @JsonProperty("Sun")
    SUN(DayOfWeek.SUNDAY, "Sun");

    private final DayOfWeek day;
    private final String label;

    Weekday(DayOfWeek day, String label) {
        this.day = day;
        this.label = label;
    }

    public static Weekday of(DayOfWeek day) {
        return values()[day.ordinal()];
    }

    public DayOfWeek day() {
        return day;
    }

    /** "Mon" … "Sun", the same text as in JSON. */
    public String label() {
        return label;
    }
}
