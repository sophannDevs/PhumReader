package app.phumreader.media.service;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/** Object storage (MinIO locally, Cloudflare R2 in production), reached through the S3 API. */
public interface ObjectStore {

    /**
     * A URL the browser PUTs the file to.
     *
     * @param headers headers the PUT must send exactly as given
     */
    record PresignedPut(String url, Map<String, String> headers) {}

    /** Presigned PUT that only accepts this content type and exactly this many bytes. */
    PresignedPut presignPut(String key, String contentType, long size, Duration ttl);

    /** Size in bytes of the stored object, if there is one. */
    Optional<Long> size(String key);

    byte[] get(String key);

    void put(String key, byte[] data, String contentType);

    void delete(String key);

    /** Public (CDN) address of a stored object. */
    String publicUrl(String key);
}
