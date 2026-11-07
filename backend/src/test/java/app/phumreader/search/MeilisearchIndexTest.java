package app.phumreader.search;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import app.phumreader.search.domain.SearchFilter;
import app.phumreader.search.domain.SearchSort;
import app.phumreader.search.service.MeilisearchIndex;
import app.phumreader.search.service.SearchDoc;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Runs against a real Meilisearch (MEILI_TEST_URL, default http://127.0.0.1:7700, key
 * MEILI_TEST_KEY or phumreader-dev-meili-key) in a throw-away index. Skipped when none answers, so
 * {@code ./gradlew check} still needs no services.
 */
class MeilisearchIndexTest {

    private static final String URL =
            System.getenv().getOrDefault("MEILI_TEST_URL", "http://127.0.0.1:7700");
    private static final String KEY =
            System.getenv().getOrDefault("MEILI_TEST_KEY", "phumreader-dev-meili-key");

    private final String uid = "test_" + UUID.randomUUID().toString().replace('-', '_');
    private MeilisearchIndex index;

    @BeforeEach
    void connect() {
        try {
            HttpResponse<String> r =
                    HttpClient.newHttpClient()
                            .send(
                                    HttpRequest.newBuilder(URI.create(URL + "/health")).build(),
                                    HttpResponse.BodyHandlers.ofString());
            assumeTrue(r.statusCode() == 200, "Meilisearch is not healthy");
        } catch (Exception e) {
            assumeTrue(false, "no Meilisearch at " + URL);
        }
        index = new MeilisearchIndex(URL, KEY, uid);
    }

    @AfterEach
    void dropIndex() throws Exception {
        if (index != null) {
            HttpClient.newHttpClient()
                    .send(
                            HttpRequest.newBuilder(URI.create(URL + "/indexes/" + uid))
                                    .header("Authorization", "Bearer " + KEY)
                                    .DELETE()
                                    .build(),
                            HttpResponse.BodyHandlers.ofString());
        }
    }

    private static SearchDoc doc(String title, String creator, String genre, long views) {
        return new SearchDoc(UUID.randomUUID(), title, creator, genre, "COMIC", views);
    }

    @Test
    void findsByTitleCreatorAndGenreWithTyposAndPrefixes() {
        SearchDoc glass = doc("Glass Compass", "Chan Sreyleak", "Sci-fi", 100);
        SearchDoc tigers = doc("Paper Tigers", "Vann Dara", "Action", 500);
        index.upsert(List.of(glass, tigers));

        assertThat(index.search("glass", 8)).containsExactly(glass.id());
        assertThat(index.search("Glass comp", 8)).containsExactly(glass.id());
        assertThat(index.search("compas", 8)).containsExactly(glass.id()); // typo
        assertThat(index.search("sreyleak", 8)).containsExactly(glass.id()); // creator
        assertThat(index.search("action", 8)).containsExactly(tigers.id()); // genre
        assertThat(index.search("zzzzqq", 8)).isEmpty();
        assertThat(index.count()).isEqualTo(2);
    }

    @Test
    void moreViewedSeriesComesFirstWhenMatchesAreEqual() {
        SearchDoc quiet = doc("Moon Garden", "Sok A", "Fantasy", 10);
        SearchDoc popular = doc("Moon Garden", "Sok B", "Fantasy", 9000);
        index.upsert(List.of(quiet, popular));

        assertThat(index.search("moon garden", 8)).containsExactly(popular.id(), quiet.id());
    }

    @Test
    void deleteAndReplaceAllRemoveDocuments() {
        SearchDoc a = doc("Alpha Tale", "X", "Drama", 1);
        SearchDoc b = doc("Beta Tale", "Y", "Drama", 2);
        SearchDoc c = doc("Gamma Tale", "Z", "Drama", 3);
        index.upsert(List.of(a, b, c));

        index.delete(List.of(a.id()));
        assertThat(index.search("tale", 8)).containsExactlyInAnyOrder(b.id(), c.id());

        index.replaceAll(List.of(c));
        assertThat(index.search("tale", 8)).containsExactly(c.id());
        assertThat(index.count()).isEqualTo(1);
    }

    private static SearchDoc full(
            String title,
            String genre,
            String slug,
            String type,
            String status,
            long views,
            long launched) {
        return new SearchDoc(
                UUID.randomUUID(), title, "Creator", genre, slug, type, status, views, launched);
    }

    @Test
    void filtersByTypeGenreAndStatusAndSortsByViewsOrLaunchDate() {
        SearchDoc oldHit = full("Star Road", "Sci-fi", "sci-fi", "COMIC", "COMPLETED", 900, 1_000);
        SearchDoc newHit = full("Star Harbor", "Sci-fi", "sci-fi", "NOVEL", "ONGOING", 50, 3_000);
        SearchDoc midHit =
                full("Star Garden", "Fantasy", "fantasy", "COMIC", "ONGOING", 500, 2_000);
        index.upsert(List.of(oldHit, newHit, midHit));

        assertThat(
                        index.search(
                                "star",
                                new SearchFilter("NOVEL", null, null, SearchSort.RELEVANCE),
                                8))
                .containsExactly(newHit.id());
        assertThat(
                        index.search(
                                "star",
                                new SearchFilter(null, "fantasy", null, SearchSort.RELEVANCE),
                                8))
                .containsExactly(midHit.id());
        assertThat(
                        index.search(
                                "star",
                                new SearchFilter(null, null, "COMPLETED", SearchSort.RELEVANCE),
                                8))
                .containsExactly(oldHit.id());
        assertThat(
                        index.search(
                                "star",
                                new SearchFilter(
                                        "COMIC", "sci-fi", "ONGOING", SearchSort.RELEVANCE),
                                8))
                .isEmpty();
        // An empty query lists what the filter allows (browsing).
        assertThat(index.search("", new SearchFilter("COMIC", null, null, SearchSort.POPULAR), 8))
                .containsExactly(oldHit.id(), midHit.id());

        assertThat(index.search("star", new SearchFilter(null, null, null, SearchSort.POPULAR), 8))
                .containsExactly(oldHit.id(), midHit.id(), newHit.id());
        assertThat(index.search("star", new SearchFilter(null, null, null, SearchSort.NEWEST), 8))
                .containsExactly(newHit.id(), midHit.id(), oldHit.id());
    }

    @Test
    void aFilterValueCannotInjectAnotherCondition() {
        SearchDoc a = full("Star Road", "Sci-fi", "sci-fi", "COMIC", "ONGOING", 1, 1);
        index.upsert(List.of(a));

        assertThat(
                        index.search(
                                "star",
                                new SearchFilter(
                                        null, "x\" OR type = \"COMIC", null, SearchSort.RELEVANCE),
                                8))
                .isEmpty();
    }

    @Test
    void khmerTitlesCreatorsAndPartsOfWordsAreFound() {
        SearchDoc village = doc("ដំណើរផ្សងព្រេងនៃភូមិ", "សុខា", "Fantasy", 10);
        SearchDoc other = doc("កំណត់ហេតុអ្នកបណ្ដាញ", "ដារា", "Drama", 20);
        index.upsert(List.of(village, other));

        assertThat(index.search("ភូមិ", 8)).containsExactly(village.id());
        assertThat(index.search("ផ្សងព្រេង", 8)).containsExactly(village.id());
        assertThat(index.search("សុខា", 8)).containsExactly(village.id());
        assertThat(index.search("ដារ", 8)).containsExactly(other.id());
    }
}
