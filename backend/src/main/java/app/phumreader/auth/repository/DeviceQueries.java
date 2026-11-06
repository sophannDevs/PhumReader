package app.phumreader.auth.repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Signed-in devices: one per refresh-token family that is neither signed out nor expired. The
 * family's newest token tells the browser and when the device last refreshed its sign-in.
 */
@Repository
public class DeviceQueries {

    /**
     * @param familyId the device's id
     * @param userAgent browser of the newest sign-in or refresh
     * @param signedInAt when the device logged in
     * @param lastActiveAt the latest refresh (every 15 minutes while the site is open)
     */
    public record DeviceRow(
            UUID familyId, @Nullable String userAgent, Instant signedInAt, Instant lastActiveAt) {}

    private final JdbcClient jdbc;

    public DeviceQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The user's signed-in devices, most recently active first. */
    public List<DeviceRow> active(UUID userId, Instant now) {
        return jdbc.sql(
                        """
                        select family_id,
                               (array_agg(device_name order by created_at desc))[1] as device_name,
                               min(created_at) as signed_in_at,
                               max(created_at) as last_active_at
                        from refresh_tokens
                        where user_id = :user
                        group by family_id
                        having count(*) filter (where revoked_at is not null) = 0
                           and max(expires_at) > :now
                        order by max(created_at) desc, family_id
                        """)
                .param("user", userId)
                .param("now", now.atOffset(ZoneOffset.UTC))
                .query((rs, n) ->
                        new DeviceRow(
                                rs.getObject("family_id", UUID.class),
                                rs.getString("device_name"),
                                rs.getObject("signed_in_at", OffsetDateTime.class).toInstant(),
                                rs.getObject("last_active_at", OffsetDateTime.class).toInstant()))
                .list();
    }
}
