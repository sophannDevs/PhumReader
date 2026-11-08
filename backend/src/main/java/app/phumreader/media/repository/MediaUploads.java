package app.phumreader.media.repository;

import app.phumreader.media.domain.UploadKind;
import app.phumreader.media.domain.UploadStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** The {@code media_uploads} table. */
@Repository
public class MediaUploads {

    public record Row(
            UUID id,
            UUID ownerId,
            UploadKind kind,
            UploadStatus status,
            String contentType,
            long declaredSize,
            String originalKey,
            @Nullable Integer width,
            @Nullable Integer height,
            List<Integer> variantWidths,
            @Nullable String rejectCode,
            @Nullable String rejectMessage) {}

    private final JdbcClient jdbc;

    public MediaUploads(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(
            UUID id, UUID owner, UploadKind kind, String contentType, long size, String key) {
        jdbc.sql(
                        "insert into media_uploads (id, owner_id, kind, content_type, declared_size,"
                                + " original_key) values (:id, :owner, :kind, :type, :size, :key)")
                .param("id", id)
                .param("owner", owner)
                .param("kind", kind.name())
                .param("type", contentType)
                .param("size", size)
                .param("key", key)
                .update();
    }

    public Optional<Row> find(UUID id) {
        return jdbc.sql("select * from media_uploads where id = :id")
                .param("id", id)
                .query((rs, n) -> {
                    Integer[] widths = (Integer[]) rs.getArray("variant_widths").getArray();
                    return new Row(
                            rs.getObject("id", UUID.class),
                            rs.getObject("owner_id", UUID.class),
                            UploadKind.valueOf(rs.getString("kind")),
                            UploadStatus.valueOf(rs.getString("status")),
                            rs.getString("content_type"),
                            rs.getLong("declared_size"),
                            rs.getString("original_key"),
                            (Integer) rs.getObject("width"),
                            (Integer) rs.getObject("height"),
                            List.of(widths),
                            rs.getString("reject_code"),
                            rs.getString("reject_message"));
                })
                .optional();
    }

    /** Several uploads in one query (the ones that exist; the order is not kept). */
    public List<Row> findAll(java.util.Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("select * from media_uploads where id = any(:ids)")
                .param("ids", ids.toArray(UUID[]::new))
                .query(MediaUploads::row)
                .list();
    }

    private static Row row(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        Integer[] widths = (Integer[]) rs.getArray("variant_widths").getArray();
        return new Row(
                rs.getObject("id", UUID.class),
                rs.getObject("owner_id", UUID.class),
                UploadKind.valueOf(rs.getString("kind")),
                UploadStatus.valueOf(rs.getString("status")),
                rs.getString("content_type"),
                rs.getLong("declared_size"),
                rs.getString("original_key"),
                (Integer) rs.getObject("width"),
                (Integer) rs.getObject("height"),
                List.of(widths),
                rs.getString("reject_code"),
                rs.getString("reject_message"));
    }

    public void markReady(UUID id, int width, int height, List<Integer> variantWidths) {
        jdbc.sql(
                        "update media_uploads set status = 'READY', width = :w, height = :h,"
                                + " variant_widths = :v, completed_at = now() where id = :id")
                .param("id", id)
                .param("w", width)
                .param("h", height)
                .param("v", variantWidths.toArray(Integer[]::new))
                .update();
    }

    public void markRejected(UUID id, String code, String message) {
        jdbc.sql(
                        "update media_uploads set status = 'REJECTED', reject_code = :code,"
                                + " reject_message = :message, completed_at = now() where id = :id")
                .param("id", id)
                .param("code", code)
                .param("message", message)
                .update();
    }
}
