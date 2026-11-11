package app.phumreader.notification.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/** Quiet hours (V21-03): whole hours in Phnom Penh, the window may wrap midnight. */
class QuietHoursTest {

    @Test
    void aWindowOverMidnightCoversTheLateAndTheEarlyHours() {
        QuietHours night = new QuietHours(true, 22, 7);
        assertThat(IntStream.range(0, 24).filter(night::covers).boxed())
                .containsExactly(0, 1, 2, 3, 4, 5, 6, 22, 23);
    }

    @Test
    void aWindowInsideOneDayCoversFromUpToButNotIncludingTo() {
        QuietHours afternoon = new QuietHours(true, 13, 17);
        assertThat(IntStream.range(0, 24).filter(afternoon::covers).boxed())
                .containsExactly(13, 14, 15, 16);
    }

    @Test
    void switchedOffOrTheSameHourTwiceMeansNoQuietTime() {
        assertThat(IntStream.range(0, 24).anyMatch(new QuietHours(false, 22, 7)::covers)).isFalse();
        assertThat(IntStream.range(0, 24).anyMatch(new QuietHours(true, 9, 9)::covers)).isFalse();
    }
}
