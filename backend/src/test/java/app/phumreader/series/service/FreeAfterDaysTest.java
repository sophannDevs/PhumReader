package app.phumreader.series.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/**
 * The series' Fast Pass (V21-02): a new Fast Pass episode is free after ceil(ahead × 7 ÷ update
 * days) days, so readers can buy {@code ahead} episodes ahead whatever the schedule.
 */
class FreeAfterDaysTest {

    @ParameterizedTest(name = "{0} ahead, {1} update days: {2} days")
    @CsvSource({
        "3, 1, 21", // weekly, the design's example
        "3, 2, 11", // twice a week: 10.5 rounded up
        "2, 3, 5", // 14 / 3 = 4.67
        "1, 7, 1", // daily
        "5, 7, 5",
        "5, 1, 35",
        "5, 0, 35", // no schedule counts as weekly
        "1, 0, 7"
    })
    void freeAfterDays(int ahead, int updateDays, int expected) {
        assertThat(CreatorContentService.freeAfterDays(ahead, updateDays)).isEqualTo(expected);
    }
}
