package app.phumreader.series.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.phumreader.config.AppProperties;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.repository.CatalogQueries;
import app.phumreader.series.repository.CatalogRows.GenreRow;
import app.phumreader.series.repository.CatalogRows.HeroRow;
import app.phumreader.series.repository.CatalogRows.RankingRow;
import app.phumreader.series.repository.SeriesRow;
import app.phumreader.support.MutableClock;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

/** The in-memory home feed cache: kept for the TTL, rebuilt at midnight in Phnom Penh. */
class HomeFeedCacheTest {

    /** Counts how often the home feed is built (one hero query per build). */
    static final class CountingQueries extends CatalogQueries {
        int builds;

        CountingQueries() {
            super(null);
        }

        @Override
        public List<HeroRow> heroSlides(OffsetDateTime now) {
            builds++;
            return List.of();
        }

        @Override
        public List<SeriesRow> mostViewedPerDay(int perDay, OffsetDateTime now) {
            return List.of();
        }

        @Override
        public List<SeriesRow> mostViewedPerGenre(int perGenre, OffsetDateTime now) {
            return List.of();
        }

        @Override
        public List<SeriesRow> mostViewed(
                @Nullable SeriesType type, int limit, OffsetDateTime now) {
            return List.of();
        }

        @Override
        public List<RankingRow> rankings(
                String kind, int afterPosition, int limit, OffsetDateTime now) {
            return List.of();
        }

        @Override
        public List<GenreRow> genres() {
            return List.of();
        }
    }

    private final CountingQueries queries = new CountingQueries();
    private final MutableClock clock = new MutableClock();

    @Test
    void theFeedIsReusedUntilTheTtlEnds() {
        clock.set(Instant.parse("2026-11-05T05:00:00Z"));
        CatalogService catalog = catalog(Duration.ofSeconds(60));

        catalog.home();
        catalog.home();
        assertThat(queries.builds).isEqualTo(1);

        clock.advance(Duration.ofSeconds(59));
        catalog.home();
        assertThat(queries.builds).isEqualTo(1);

        clock.advance(Duration.ofSeconds(1));
        catalog.home();
        assertThat(queries.builds).isEqualTo(2);
    }

    @Test
    void aNewDayInPhnomPenhBuildsTheFeedAgain() {
        // 23:59:30 on Thursday in Phnom Penh, then 30 seconds later it is Friday.
        clock.set(Instant.parse("2026-11-05T16:59:30Z"));
        CatalogService catalog = catalog(Duration.ofSeconds(60));

        assertThat(catalog.home().today()).isEqualTo(Weekday.THU);
        clock.advance(Duration.ofSeconds(30));
        assertThat(catalog.home().today()).isEqualTo(Weekday.FRI);
        assertThat(queries.builds).isEqualTo(2);
    }

    @Test
    void aZeroTtlTurnsTheCacheOff() {
        clock.set(Instant.parse("2026-11-05T05:00:00Z"));
        CatalogService catalog = catalog(Duration.ZERO);

        catalog.home();
        catalog.home();
        assertThat(queries.builds).isEqualTo(2);
    }

    private CatalogService catalog(Duration ttl) {
        AppProperties properties =
                new AppProperties(
                        "http://localhost:3000",
                        new AppProperties.Auth(
                                Duration.ofMinutes(15),
                                Duration.ofDays(30),
                                Duration.ofSeconds(20),
                                false,
                                null,
                                true,
                                null),
                        new AppProperties.Catalog(ttl),
                        new AppProperties.Payments(false, Duration.ofMinutes(10)),
                        new AppProperties.Views(
                                false, Duration.ofMinutes(30), Duration.ofSeconds(60)));
        return new CatalogService(queries, clock, properties);
    }
}
