package app.phumreader.views;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import app.phumreader.common.views.InMemoryViewCounter;
import app.phumreader.common.views.ViewKind;
import app.phumreader.config.AppProperties;
import app.phumreader.search.service.SearchEvents;
import app.phumreader.series.repository.ViewCounts;
import app.phumreader.series.service.ViewFlushService;
import app.phumreader.support.MutableClock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionTemplate;

class ViewCountingTest {

    private final MutableClock clock = new MutableClock();
    private final AppProperties props =
            new AppProperties(
                    "http://localhost:3000",
                    new AppProperties.Auth(
                            Duration.ofMinutes(15),
                            Duration.ofDays(30),
                            Duration.ofSeconds(20),
                            false,
                            null,
                            true,
                            null,
                            AppProperties.Auth.Social.none()),
                    new AppProperties.Catalog(Duration.ZERO),
                    new AppProperties.Payments(false, Duration.ofMinutes(10)),
                    new AppProperties.Views(true, Duration.ofMinutes(30), Duration.ofSeconds(60)));
    private InMemoryViewCounter counter;

    @BeforeEach
    void setUp() {
        clock.set(Instant.parse("2026-11-05T05:00:00Z"));
        counter = new InMemoryViewCounter(clock, props);
    }

    @Test
    void sameViewerCountsOncePerWindowAndAgainAfterIt() {
        assertThat(counter.record(ViewKind.SERIES, "s1", "ip:1")).isTrue();
        assertThat(counter.record(ViewKind.SERIES, "s1", "ip:1")).isFalse();
        assertThat(counter.record(ViewKind.SERIES, "s1", "ip:2")).isTrue();
        assertThat(counter.record(ViewKind.SERIES, "s2", "ip:1")).isTrue();
        assertThat(counter.record(ViewKind.EPISODE, "s1:1", "ip:1")).isTrue();

        clock.set(clock.instant().plus(Duration.ofMinutes(31)));
        assertThat(counter.record(ViewKind.SERIES, "s1", "ip:1")).isTrue();

        assertThat(counter.drain(ViewKind.SERIES)).containsEntry("s1", 3L).containsEntry("s2", 1L);
        assertThat(counter.drain(ViewKind.SERIES)).isEmpty();
        assertThat(counter.drain(ViewKind.EPISODE)).containsEntry("s1:1", 1L);
    }

    @Test
    void restoreAddsCountsBack() {
        counter.record(ViewKind.SERIES, "s1", "ip:1");
        Map<String, Long> taken = counter.drain(ViewKind.SERIES);
        counter.record(ViewKind.SERIES, "s1", "ip:2");
        counter.restore(ViewKind.SERIES, taken);
        assertThat(counter.drain(ViewKind.SERIES)).containsEntry("s1", 2L);
    }

    @Test
    void failedDatabaseWriteKeepsTheCountsForTheNextFlush() {
        UUID series = UUID.randomUUID();
        ViewCounts counts = mock(ViewCounts.class);
        SearchEvents events = mock(SearchEvents.class);
        TransactionTemplate tx = new TransactionTemplate(new NoTransactions());
        ViewFlushService flush = new ViewFlushService(counter, counts, events, tx);
        counter.record(ViewKind.SERIES, series.toString(), "ip:1");
        counter.record(ViewKind.EPISODE, series + ":3", "ip:1");
        doThrow(new IllegalStateException("db down")).when(counts).addSeries(any());

        assertThat(flush.flush()).isZero();

        org.mockito.Mockito.doNothing().when(counts).addSeries(any());
        assertThat(flush.flush()).isEqualTo(2);
        verify(counts).addEpisode(series, 3, 1L);
        verify(events).seriesChanged("VIEWS_CHANGED", java.util.Set.of(series));
        assertThat(flush.flush()).isZero();
    }

    /** Runs the callback without a database transaction. */
    private static final class NoTransactions
            extends org.springframework.transaction.support.AbstractPlatformTransactionManager {
        @Override
        protected Object doGetTransaction() {
            return new Object();
        }

        @Override
        protected void doBegin(
                Object transaction, org.springframework.transaction.TransactionDefinition d) {}

        @Override
        protected void doCommit(
                org.springframework.transaction.support.DefaultTransactionStatus s) {}

        @Override
        protected void doRollback(
                org.springframework.transaction.support.DefaultTransactionStatus s) {}
    }
}
