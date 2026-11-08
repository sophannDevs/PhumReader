package app.phumreader.media.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Uses the S3 API when {@code phumreader.storage.endpoint} is set, otherwise keeps images in memory
 * (tests, and development without MinIO).
 */
@Configuration
class StorageConfig {

    private static final Logger log = LoggerFactory.getLogger(StorageConfig.class);

    @Bean
    ObjectStore objectStore(
            @Value("${phumreader.storage.endpoint:}") String endpoint,
            @Value("${phumreader.storage.region:auto}") String region,
            @Value("${phumreader.storage.bucket:phumreader-dev}") String bucket,
            @Value("${phumreader.storage.access-key:}") String accessKey,
            @Value("${phumreader.storage.secret-key:}") String secretKey,
            @Value("${phumreader.storage.public-base-url:}") String publicBaseUrl,
            @Value("${phumreader.storage.create-bucket:false}") boolean createBucket) {
        if (endpoint.isBlank()) {
            log.warn("No object storage (phumreader.storage.endpoint): images stay in memory.");
            return new InMemoryObjectStore();
        }
        String base = publicBaseUrl.isBlank() ? endpoint + "/" + bucket : publicBaseUrl;
        S3ObjectStore store =
                new S3ObjectStore(endpoint, region, bucket, accessKey, secretKey, base);
        if (createBucket) {
            try {
                store.createBucketForDevelopment();
            } catch (RuntimeException e) {
                log.warn("Could not prepare bucket {}: {}", bucket, e.toString());
            }
        }
        return store;
    }
}
