package app.phumreader.media.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.media.domain.UploadKind;
import app.phumreader.media.domain.UploadStatus;
import app.phumreader.media.repository.MediaUploads;
import app.phumreader.media.repository.MediaUploads.Row;
import app.phumreader.media.service.ImageProcessor.Inspected;
import app.phumreader.media.service.ImageProcessor.Rejected;
import app.phumreader.media.service.ImageProcessor.Variant;
import app.phumreader.media.service.MediaViews.ImageVariant;
import app.phumreader.media.service.MediaViews.UploadTicket;
import app.phumreader.media.service.MediaViews.UploadView;
import java.time.Clock;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Creator image uploads (plan P3-07): hand out a presigned URL, then check the original and make
 * its variants. Not transactional on purpose: no database connection is held while files move.
 */
@Service
public class MediaService {

    /** A19: JPG or PNG, 20 MB each. */
    public static final long MAX_BYTES = 20L * 1024 * 1024;

    static final Set<String> TYPES = Set.of("image/jpeg", "image/png");
    static final Duration TICKET_TTL = Duration.ofMinutes(15);

    private final MediaUploads uploads;
    private final ObjectStore store;
    private final ImageProcessor images;
    private final Clock clock;

    public MediaService(
            MediaUploads uploads, ObjectStore store, ImageProcessor images, Clock clock) {
        this.uploads = uploads;
        this.store = store;
        this.images = images;
        this.clock = clock;
    }

    public UploadTicket create(UUID owner, UploadKind kind, String contentType, long size) {
        if (!TYPES.contains(contentType)) {
            throw ApiException.invalidField(
                    "contentType", "unsupported_type", "Only JPG and PNG images are accepted.");
        }
        if (size < 1 || size > MAX_BYTES) {
            throw ApiException.invalidField(
                    "size", "file_too_large", "An image can be at most 20 MB.");
        }
        UUID id = UUID.randomUUID();
        String key = "uploads/" + kind.name().toLowerCase() + "/" + id + "/original";
        uploads.insert(id, owner, kind, contentType, size, key);
        ObjectStore.PresignedPut put = store.presignPut(key, contentType, size, TICKET_TTL);
        return new UploadTicket(id, put.url(), put.headers(), clock.instant().plus(TICKET_TTL));
    }

    public UploadView view(UUID owner, UUID id) {
        return toView(owned(owner, id));
    }

    /**
     * Checks the uploaded original and makes the variants. Safe to call again: a finished upload
     * answers the same. A rejected image answers 422 with the reason.
     */
    public UploadView complete(UUID owner, UUID id) {
        Row row = owned(owner, id);
        if (row.status() == UploadStatus.READY) {
            return toView(row);
        }
        if (row.status() == UploadStatus.REJECTED) {
            throw rejection(row.rejectCode(), row.rejectMessage());
        }
        Long size = store.size(row.originalKey()).orElse(null);
        if (size == null) {
            throw ApiException.conflict(
                    "upload_missing", "The file has not been uploaded yet. Upload it, then retry.");
        }
        try {
            if (size > MAX_BYTES || size != row.declaredSize()) {
                throw new Rejected(
                        "file_too_large",
                        "The file is not the size that was announced (max 20 MB).");
            }
            byte[] original = store.get(row.originalKey());
            Inspected inspected = images.inspect(original, row.kind());
            List<Variant> variants = images.variants(original, inspected);
            for (Variant v : variants) {
                store.put(variantKey(row, v.width()), v.webp(), "image/webp");
            }
            uploads.markReady(
                    id,
                    inspected.width(),
                    inspected.height(),
                    variants.stream().map(Variant::width).toList());
        } catch (Rejected rejected) {
            uploads.markRejected(id, rejected.code(), rejected.getMessage());
            store.delete(row.originalKey());
            throw rejection(rejected.code(), rejected.getMessage());
        }
        return toView(owned(owner, id));
    }

    private Row owned(UUID owner, UUID id) {
        return uploads.find(id)
                .filter(r -> r.ownerId().equals(owner))
                .orElseThrow(() -> ApiException.notFound("upload_not_found", "No such upload."));
    }

    private static ApiException rejection(String code, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, code, message, Map.of());
    }

    private static String variantKey(Row row, int width) {
        String folder = row.originalKey().substring(0, row.originalKey().lastIndexOf('/'));
        return folder + "/w" + width + ".webp";
    }

    private UploadView toView(Row row) {
        List<ImageVariant> variants =
                row.variantWidths().stream()
                        .sorted()
                        .map(w -> new ImageVariant(w, store.publicUrl(variantKey(row, w))))
                        .toList();
        String url = variants.isEmpty() ? null : variants.get(variants.size() - 1).url();
        return new UploadView(
                row.id(),
                row.kind(),
                row.status(),
                row.width(),
                row.height(),
                variants,
                url,
                row.rejectCode(),
                row.rejectMessage());
    }
}
