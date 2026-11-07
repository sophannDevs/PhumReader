package app.phumreader.media.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.phumreader.support.MutableClock;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class ImageUrlSignerTest {

    private static final String KEY =
            "uploads/panel/11111111-2222-3333-4444-555555555555/w800.webp";

    private final MutableClock clock = new MutableClock();
    private final ObjectStore store = new InMemoryObjectStore();

    @Test
    void theTokenMatchesTheVectorTheWorkerIsTestedWith() {
        // infra/image-worker/test/worker.test.ts asserts the same value.
        assertThat(ImageUrlSigner.token("test-secret-for-vectors", "/" + KEY, 1893456000L))
                .isEqualTo("1893456000.OqzLHg13SPK07ExM9Jy5YvxQnKMovjZtFsoFp0LOQuM");
    }

    @Test
    void aSignedAddressLastsFiveMinutes() {
        clock.set(Instant.parse("2026-11-07T10:00:00Z"));
        ImageUrlSigner signer =
                new ImageUrlSigner(store, clock, "secret", "https://img.phumreader.test/");

        String url = signer.sign(KEY);

        long exp = Instant.parse("2026-11-07T10:05:00Z").getEpochSecond();
        assertThat(url)
                .isEqualTo(
                        "https://img.phumreader.test/"
                                + KEY
                                + "?t="
                                + ImageUrlSigner.token("secret", "/" + KEY, exp));
        assertThat(signer.enabled()).isTrue();
    }

    @Test
    void differentImagesAndSecretsGiveDifferentTokens() {
        String a = ImageUrlSigner.token("secret", "/a.webp", 100);
        assertThat(a).isNotEqualTo(ImageUrlSigner.token("secret", "/b.webp", 100));
        assertThat(a).isNotEqualTo(ImageUrlSigner.token("other", "/a.webp", 100));
        assertThat(a).isNotEqualTo(ImageUrlSigner.token("secret", "/a.webp", 101));
    }

    @Test
    void withoutASecretAddressesAreThePlainPublicOnes() {
        ImageUrlSigner signer = new ImageUrlSigner(store, clock, "", "");

        assertThat(signer.enabled()).isFalse();
        assertThat(signer.sign(KEY)).isEqualTo(store.publicUrl(KEY)).doesNotContain("?t=");
    }

    @Test
    void aSecretWithoutTheWorkersAddressIsAConfigurationError() {
        assertThatThrownBy(() -> new ImageUrlSigner(store, clock, "secret", ""))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("IMAGE_CDN_URL");
    }
}
