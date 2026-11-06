package app.phumreader.search;

import static org.assertj.core.api.Assertions.assertThat;

import app.phumreader.search.repository.OutboxEvents;
import app.phumreader.search.service.SearchDoc;
import app.phumreader.search.service.SearchIndex;
import app.phumreader.search.service.SearchIndexException;
import app.phumreader.search.service.SearchSyncService;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.series.service.CatalogService;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.SeededDemo;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** The outbox keeps the search index in line with the database (index replaced by a fake). */
@IntegrationTest
@Import(AuthTestConfig.class)
class SearchSyncTest {

    @Autowired CatalogService catalog;
    @Autowired OutboxEvents outbox;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired PlatformTransactionManager transactions;

    private final FakeIndex index = new FakeIndex();
    private SearchSyncService sync;

    @BeforeEach
    void setUp() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        jdbc.sql("delete from outbox_events").update();
        sync = new SearchSyncService(index, catalog, outbox, new TransactionTemplate(transactions));
    }

    @AfterEach
    void cleanUp() {
        jdbc.sql("delete from outbox_events").update();
    }

    @Test
    void fullSyncIndexesEveryPublishedSeries() {
        sync.syncAll();
        assertThat(index.docs).hasSize(48);
        assertThat(index.docs.values())
                .allMatch(d -> !d.title().isBlank() && !d.creator().isBlank());
    }

    @Test
    void publishedSeriesIsIndexedAndMissingOneIsRemoved() {
        UUID published =
                jdbc.sql("select id from series where visibility = 'PUBLISHED' limit 1")
                        .query(UUID.class)
                        .single();
        UUID missing = UUID.randomUUID();
        index.docs.put(missing, new SearchDoc(missing, "Old", "Nobody", "Fantasy", "COMIC", 1));
        outbox.add("SERIES_PUBLISHED", published);
        outbox.add("SERIES_UNPUBLISHED", missing);

        assertThat(sync.processOutbox()).isEqualTo(2);

        assertThat(index.docs).containsKey(published).doesNotContainKey(missing);
        assertThat(
                        jdbc.sql("select count(*) from outbox_events where processed_at is null")
                                .query(Long.class)
                                .single())
                .isZero();
        assertThat(sync.processOutbox()).isZero();
    }

    @Test
    void failedEventsAreKeptAndRetriedThenGiveUp() {
        UUID published =
                jdbc.sql("select id from series where visibility = 'PUBLISHED' limit 1")
                        .query(UUID.class)
                        .single();
        outbox.add("SERIES_PUBLISHED", published);
        index.failing = true;

        assertThat(sync.processOutbox()).isZero();
        assertThat(jdbc.sql("select attempts from outbox_events").query(Integer.class).single())
                .isEqualTo(1);
        assertThat(jdbc.sql("select last_error from outbox_events").query(String.class).single())
                .contains("down");

        index.failing = false;
        assertThat(sync.processOutbox()).isEqualTo(1);
        assertThat(index.docs).containsKey(published);

        // After the maximum number of attempts an event is left alone.
        outbox.add("SERIES_PUBLISHED", published);
        index.failing = true;
        for (int i = 0; i < OutboxEvents.MAX_ATTEMPTS + 2; i++) {
            sync.processOutbox();
        }
        assertThat(
                        jdbc.sql("select attempts from outbox_events where processed_at is null")
                                .query(Integer.class)
                                .single())
                .isEqualTo(OutboxEvents.MAX_ATTEMPTS);
    }

    private static final class FakeIndex implements SearchIndex {
        final Map<UUID, SearchDoc> docs = new LinkedHashMap<>();
        boolean failing;

        private void check() {
            if (failing) {
                throw new SearchIndexException("index is down");
            }
        }

        @Override
        public List<UUID> search(String query, int limit) {
            check();
            return new ArrayList<>(docs.keySet());
        }

        @Override
        public void upsert(Collection<SearchDoc> d) {
            check();
            d.forEach(x -> docs.put(x.id(), x));
        }

        @Override
        public void delete(Collection<UUID> ids) {
            check();
            ids.forEach(docs::remove);
        }

        @Override
        public void replaceAll(Collection<SearchDoc> d) {
            check();
            docs.clear();
            upsert(d);
        }

        @Override
        public long count() {
            return docs.size();
        }
    }
}
