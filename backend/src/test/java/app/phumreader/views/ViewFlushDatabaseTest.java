package app.phumreader.views;

import static org.assertj.core.api.Assertions.assertThat;

import app.phumreader.common.views.ViewCounter;
import app.phumreader.common.views.ViewKind;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.series.service.ViewFlushService;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.SeededDemo;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;

/** Counted views end up in {@code series.view_count} and {@code episodes.view_count}. */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class ViewFlushDatabaseTest {

    @Autowired ViewCounter counter;
    @Autowired ViewFlushService flush;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired PlatformTransactionManager transactions;

    @Test
    void flushAddsCountedViewsToTheStoredTotals() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        counter.clear();
        UUID series =
                jdbc.sql("select id from series where visibility = 'PUBLISHED' limit 1")
                        .query(UUID.class)
                        .single();
        long seriesBefore =
                jdbc.sql("select view_count from series where id = :id")
                        .param("id", series)
                        .query(Long.class)
                        .single();
        long episodeBefore =
                jdbc.sql("select view_count from episodes where series_id = :id and number = 1")
                        .param("id", series)
                        .query(Long.class)
                        .single();

        for (int i = 0; i < 5; i++) {
            counter.record(ViewKind.SERIES, series.toString(), "ip:" + i);
        }
        for (int i = 0; i < 3; i++) {
            counter.record(ViewKind.EPISODE, series + ":1", "ip:" + i);
        }

        assertThat(flush.flush()).isEqualTo(8);

        assertThat(
                        jdbc.sql("select view_count from series where id = :id")
                                .param("id", series)
                                .query(Long.class)
                                .single())
                .isEqualTo(seriesBefore + 5);
        assertThat(
                        jdbc.sql(
                                        "select view_count from episodes where series_id = :id and number = 1")
                                .param("id", series)
                                .query(Long.class)
                                .single())
                .isEqualTo(episodeBefore + 3);
        assertThat(flush.flush()).isZero();
    }
}
