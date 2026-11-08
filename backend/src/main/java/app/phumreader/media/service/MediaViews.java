package app.phumreader.media.service;

import app.phumreader.media.domain.UploadKind;
import app.phumreader.media.domain.UploadStatus;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the upload endpoints answer with. */
public final class MediaViews {

    private MediaViews() {}

    /**
     * Where to send the original.
     *
     * @param uploadUrl PUT the file here
     * @param headers send these headers with the PUT, exactly
     * @param expiresAt the URL stops working at this time
     */
    public record UploadTicket(
            UUID id, String uploadUrl, Map<String, String> headers, Instant expiresAt) {}

    /** One processed copy. */
    public record ImageVariant(int width, String url) {}

    /**
     * @param width of the original, once checked
     * @param variants WebP copies, smallest first; empty until {@code READY}
     * @param url the largest variant (what a series or episode stores)
     * @param rejectCode why a {@code REJECTED} upload failed, a stable snake_case code
     */
    public record UploadView(
            UUID id,
            UploadKind kind,
            UploadStatus status,
            @Nullable Integer width,
            @Nullable Integer height,
            List<ImageVariant> variants,
            @Nullable String url,
            @Nullable String rejectCode,
            @Nullable String rejectMessage) {}
}
