package app.phumreader.media.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Runs against a real MinIO (S3_TEST_ENDPOINT, default http://127.0.0.1:9000; keys S3_TEST_KEY /
 * S3_TEST_SECRET or the development ones) in the development bucket. Skipped when none answers, so
 * {@code ./gradlew check} still needs no services.
 */
class S3ObjectStoreTest {

    private static final String ENDPOINT =
            System.getenv().getOrDefault("S3_TEST_ENDPOINT", "http://127.0.0.1:9000");

    private S3ObjectStore store;

    @BeforeEach
    void connect() {
        try {
            HttpClient.newHttpClient()
                    .send(
                            HttpRequest.newBuilder(URI.create(ENDPOINT + "/minio/health/live"))
                                    .build(),
                            HttpResponse.BodyHandlers.discarding());
        } catch (Exception e) {
            assumeTrue(false, "No MinIO at " + ENDPOINT);
        }
        store =
                new S3ObjectStore(
                        ENDPOINT,
                        "us-east-1",
                        "phumreader-dev",
                        System.getenv().getOrDefault("S3_TEST_KEY", "phumreader"),
                        System.getenv().getOrDefault("S3_TEST_SECRET", "phumreader-dev-secret"),
                        ENDPOINT + "/phumreader-dev");
        store.createBucketForDevelopment();
    }

    @Test
    void aPresignedPutStoresTheFileAndOnlyThatFile() throws Exception {
        String key = "tests/" + UUID.randomUUID() + "/original";
        byte[] data = "hello".getBytes();
        var put = store.presignPut(key, "image/png", data.length, Duration.ofMinutes(1));
        HttpClient http = HttpClient.newHttpClient();

        // A different size than signed is refused by the storage.
        HttpResponse<String> wrong =
                http.send(
                        HttpRequest.newBuilder(URI.create(put.url()))
                                .header("Content-Type", "image/png")
                                .PUT(
                                        HttpRequest.BodyPublishers.ofByteArray(
                                                "hello world".getBytes()))
                                .build(),
                        HttpResponse.BodyHandlers.ofString());
        assertThat(wrong.statusCode()).isGreaterThanOrEqualTo(400);
        assertThat(store.size(key)).isEmpty();

        HttpResponse<String> ok =
                http.send(
                        HttpRequest.newBuilder(URI.create(put.url()))
                                .header("Content-Type", "image/png")
                                .PUT(HttpRequest.BodyPublishers.ofByteArray(data))
                                .build(),
                        HttpResponse.BodyHandlers.ofString());
        assertThat(ok.statusCode()).isEqualTo(200);
        assertThat(store.size(key)).contains(5L);
        assertThat(store.get(key)).isEqualTo(data);

        // Public read (development bucket policy).
        HttpResponse<byte[]> read =
                http.send(
                        HttpRequest.newBuilder(URI.create(store.publicUrl(key))).build(),
                        HttpResponse.BodyHandlers.ofByteArray());
        assertThat(read.statusCode()).isEqualTo(200);

        store.delete(key);
        assertThat(store.size(key)).isEmpty();
    }
}
