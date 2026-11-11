package app.phumreader.user.repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Who blocked whom (plain SQL, V21-04). */
@Repository
public class BlockQueries {

    /** A blocked account as Settings lists it. */
    public record BlockedRow(
            UUID userId, String name, @Nullable String avatarUrl, OffsetDateTime blockedAt) {}

    private final JdbcClient jdbc;

    public BlockQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Blocks the account; {@code false} when it already was. */
    public boolean add(UUID blocker, UUID blocked, OffsetDateTime now) {
        return jdbc.sql(
                                "insert into user_blocks (blocker_id, blocked_id, created_at)"
                                        + " values (:a, :b, :now) on conflict do nothing")
                        .param("a", blocker)
                        .param("b", blocked)
                        .param("now", now)
                        .update()
                == 1;
    }

    /** Unblocks the account; {@code false} when it was not blocked. */
    public boolean remove(UUID blocker, UUID blocked) {
        return jdbc.sql("delete from user_blocks where blocker_id = :a and blocked_id = :b")
                        .param("a", blocker)
                        .param("b", blocked)
                        .update()
                == 1;
    }

    /** The accounts the user blocked, newest first. */
    public List<BlockedRow> list(UUID blocker) {
        return jdbc.sql(
                        "select u.id, u.display_name, u.avatar_url, b.created_at from user_blocks b"
                                + " join users u on u.id = b.blocked_id where b.blocker_id = :a"
                                + " order by b.created_at desc, u.id")
                .param("a", blocker)
                .query((rs, n) ->
                        new BlockedRow(
                                rs.getObject("id", UUID.class),
                                rs.getString("display_name"),
                                rs.getString("avatar_url"),
                                rs.getObject("created_at", OffsetDateTime.class)))
                .list();
    }

    /** Which of these accounts the user blocked. */
    public Set<UUID> blockedAmong(UUID blocker, Collection<UUID> candidates) {
        if (candidates.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(
                jdbc.sql(
                                "select blocked_id from user_blocks where blocker_id = :a"
                                        + " and blocked_id in (:ids)")
                        .param("a", blocker)
                        .param("ids", List.copyOf(candidates))
                        .query(UUID.class)
                        .list());
    }

    public boolean exists(UUID blocker, UUID blocked) {
        return jdbc.sql(
                        "select exists (select 1 from user_blocks where blocker_id = :a"
                                + " and blocked_id = :b)")
                .param("a", blocker)
                .param("b", blocked)
                .query(Boolean.class)
                .single();
    }

    public boolean userExists(UUID id) {
        return jdbc.sql(
                        "select exists (select 1 from users where id = :id"
                                + " and status in ('ACTIVE', 'BANNED', 'DELETION_PENDING'))")
                .param("id", id)
                .query(Boolean.class)
                .single();
    }
}
