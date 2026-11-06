package app.phumreader.seed;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import org.junit.jupiter.api.Test;

class DemoRulesTest {

    @Test
    void parsesDisplayCountsLikeTheWebsite() {
        assertThat(DemoRules.parseCount("1.6M")).isEqualTo(1_600_000);
        assertThat(DemoRules.parseCount("3.6M")).isEqualTo(3_600_000);
        assertThat(DemoRules.parseCount("871K")).isEqualTo(871_000);
        assertThat(DemoRules.parseCount("47.8K")).isEqualTo(47_800);
        assertThat(DemoRules.parseCount("412")).isEqualTo(412);
        assertThat(DemoRules.parseCount("n/a")).isZero();
    }

    @Test
    void hashMatchesTheWebsite() {
        // Values from the website's hash() for the demo ids S1 and S7.
        assertThat(DemoRules.hash("S1")).isEqualTo(2_622);
        assertThat(DemoRules.hash("S7")).isEqualTo(2_628);
    }

    @Test
    void readsRankingMovement() {
        assertThat(DemoSeeder.previousPosition(1, "▲ 2")).isEqualTo(3);
        assertThat(DemoSeeder.previousPosition(4, "▼ 1")).isEqualTo(3);
        assertThat(DemoSeeder.previousPosition(2, "—")).isEqualTo(2);
        assertThat(DemoSeeder.previousPosition(5, "NEW")).isNull();
    }

    @Test
    void slugsAndTimes() {
        assertThat(DemoRules.genreSlug("Slice of life")).isEqualTo("slice-of-life");
        assertThat(DemoRules.slug("Pich & Co.")).isEqualTo("pich-co");
        assertThat(DemoRules.weekday("Thu")).isEqualTo("THURSDAY");
        assertThat(DemoRules.parseAgo("2h")).isEqualTo(Duration.ofHours(2));
        assertThat(DemoRules.parseAgo("1d")).isEqualTo(Duration.ofDays(1));
    }
}
