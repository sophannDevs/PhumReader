package app.phumreader.admin.repository;

import app.phumreader.admin.domain.ContentType;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * What the admin area reads and moderates (plain SQL): users, content, the report queue, orders and
 * the audit log. Lists are newest first and page by (created_at, id).
 */
@Repository
public class AdminQueries {

    /** Where the previous page ended. */
    public record Key(OffsetDateTime createdAt, UUID id) {}

    public record UserRow(
            UUID id,
            String email,
            String displayName,
            String status,
            List<String> roles,
            OffsetDateTime createdAt,
            @Nullable OffsetDateTime lastLoginAt) {}

    public record ContentRow(
            ContentType type,
            UUID id,
            String title,
            String owner,
            String status,
            String seriesSlug,
            @Nullable Integer episodeNumber,
            OffsetDateTime createdAt,
            long openReports) {}

    public record ReportRow(
            UUID id,
            ContentType targetType,
            UUID targetId,
            String reason,
            @Nullable String details,
            String status,
            String reporter,
            OffsetDateTime createdAt,
            @Nullable OffsetDateTime resolvedAt,
            @Nullable String resolvedBy,
            @Nullable String note,
            @Nullable String targetTitle,
            @Nullable String targetStatus,
            @Nullable String seriesSlug,
            @Nullable Integer episodeNumber) {}

    public record OrderRow(
            UUID id,
            String orderNumber,
            UUID userId,
            String email,
            String displayName,
            int coins,
            String method,
            String status,
            @Nullable Integer priceUsdCents,
            @Nullable Integer priceKhr,
            OffsetDateTime createdAt,
            @Nullable OffsetDateTime paidAt,
            @Nullable OffsetDateTime refundedAt) {}

    public record AuditRow(
            long id,
            @Nullable UUID actorId,
            @Nullable String actorName,
            String action,
            String targetType,
            @Nullable String targetId,
            String details,
            @Nullable String requestId,
            OffsetDateTime createdAt) {}

    /** A report still waiting for an admin, with its target. */
    public record OpenReport(UUID id, ContentType targetType, UUID targetId, String status) {}

    public record Counts(
            long openReports,
            long bannedUsers,
            long hiddenSeries,
            long hiddenEpisodes,
            long hiddenComments,
            long refundedOrders) {}

    private final JdbcClient jdbc;

    public AdminQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- users ----------

    public List<UserRow> users(
            @Nullable String q, @Nullable String status, @Nullable Key after, int limit) {
        StringBuilder sql =
                new StringBuilder(
                        "select u.id, u.email, u.display_name, u.status, u.created_at,"
                                + " u.last_login_at,"
                                + " array(select role from user_roles r where r.user_id = u.id"
                                + " order by role) as roles"
                                + " from users u where true");
        if (q != null) {
            sql.append(" and (u.email ilike :q or u.display_name ilike :q)");
        }
        if (status != null) {
            sql.append(" and u.status = :status");
        }
        if (after != null) {
            sql.append(" and (u.created_at, u.id) < (:t, :id)");
        }
        sql.append(" order by u.created_at desc, u.id desc limit :limit");
        return page(jdbc.sql(sql.toString()), q, status, after, limit)
                .query((rs, n) ->
                        new UserRow(
                                rs.getObject("id", UUID.class),
                                rs.getString("email"),
                                rs.getString("display_name"),
                                rs.getString("status"),
                                strings(rs.getArray("roles")),
                                rs.getObject("created_at", OffsetDateTime.class),
                                rs.getObject("last_login_at", OffsetDateTime.class)))
                .list();
    }

    public Optional<UserRow> user(UUID id) {
        return jdbc.sql(
                        "select u.id, u.email, u.display_name, u.status, u.created_at,"
                                + " u.last_login_at, array(select role from user_roles r"
                                + " where r.user_id = u.id order by role) as roles"
                                + " from users u where u.id = :id")
                .param("id", id)
                .query((rs, n) ->
                        new UserRow(
                                rs.getObject("id", UUID.class),
                                rs.getString("email"),
                                rs.getString("display_name"),
                                rs.getString("status"),
                                strings(rs.getArray("roles")),
                                rs.getObject("created_at", OffsetDateTime.class),
                                rs.getObject("last_login_at", OffsetDateTime.class)))
                .optional();
    }

    // ---------- content ----------

    public List<ContentRow> content(
            ContentType type,
            @Nullable String q,
            @Nullable String status,
            @Nullable Key after,
            int limit) {
        String select =
                switch (type) {
                    case SERIES ->
                            "select 'SERIES' as type, s.id, s.title, cp.pen_name as owner,"
                                    + " lower(s.visibility) as status, s.slug, null::int as number,"
                                    + " s.created_at from series s"
                                    + " join creator_profiles cp on cp.user_id = s.creator_id"
                                    + " where true"
                                    + (q == null ? "" : " and s.title ilike :q")
                                    + (status == null ? "" : " and lower(s.visibility) = :status")
                                    + (after == null
                                            ? ""
                                            : " and (s.created_at, s.id) < (:t, :id)");
                    case EPISODE ->
                            "select 'EPISODE' as type, e.id, e.title, s.title as owner,"
                                    + " lower(e.status) as status, s.slug, e.number,"
                                    + " e.created_at from episodes e"
                                    + " join series s on s.id = e.series_id where true"
                                    + (q == null
                                            ? ""
                                            : " and (e.title ilike :q or s.title ilike :q)")
                                    + (status == null ? "" : " and lower(e.status) = :status")
                                    + (after == null
                                            ? ""
                                            : " and (e.created_at, e.id) < (:t, :id)");
                    case COMMENT ->
                            "select 'COMMENT' as type, c.id, left(c.body, 200) as title,"
                                    + " u.display_name as owner, lower(c.status) as status,"
                                    + " s.slug, ep.number, c.created_at from comments c"
                                    + " join users u on u.id = c.author_id"
                                    + " join series s on s.id = c.series_id"
                                    + " left join episodes ep on ep.id = c.episode_id where true"
                                    + (q == null ? "" : " and c.body ilike :q")
                                    + (status == null ? "" : " and lower(c.status) = :status")
                                    + (after == null
                                            ? ""
                                            : " and (c.created_at, c.id) < (:t, :id)");
                };
        String sql =
                "select x.*, (select count(*) from reports r where r.target_type = x.type"
                        + " and r.target_id = x.id and r.status = 'OPEN') as open_reports from ("
                        + select
                        + " order by created_at desc, id desc limit :limit) x"
                        + " order by x.created_at desc, x.id desc";
        return page(jdbc.sql(sql), q, status, after, limit)
                .query((rs, n) ->
                        new ContentRow(
                                ContentType.valueOf(rs.getString("type")),
                                rs.getObject("id", UUID.class),
                                rs.getString("title"),
                                rs.getString("owner"),
                                rs.getString("status"),
                                rs.getString("slug"),
                                rs.getObject("number", Integer.class),
                                rs.getObject("created_at", OffsetDateTime.class),
                                rs.getLong("open_reports")))
                .list();
    }

    /** The series an item belongs to (for search and cache updates), when the item exists. */
    public Optional<UUID> seriesOf(ContentType type, UUID id) {
        String sql =
                switch (type) {
                    case SERIES -> "select id from series where id = :id";
                    case EPISODE -> "select series_id from episodes where id = :id";
                    case COMMENT -> "select series_id from comments where id = :id";
                };
        return jdbc.sql(sql).param("id", id).query(UUID.class).optional();
    }

    /** The stored state of an item, or empty when it does not exist. */
    public Optional<String> state(ContentType type, UUID id) {
        return jdbc.sql(
                        "select "
                                + type.column()
                                + " from "
                                + type.table()
                                + " where id = :id for update")
                .param("id", id)
                .query(String.class)
                .optional();
    }

    /** Moves an item from one state to another; {@code false} when it was not in {@code from}. */
    public boolean changeState(ContentType type, UUID id, String from, String to) {
        return jdbc.sql(
                                "update "
                                        + type.table()
                                        + " set "
                                        + type.column()
                                        + " = :to where id = :id and "
                                        + type.column()
                                        + " = :from")
                        .param("id", id)
                        .param("from", from)
                        .param("to", to)
                        .update()
                == 1;
    }

    // ---------- reports ----------

    private static final String REPORT_SELECT =
            "select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,"
                    + " r.resolved_at, r.resolution_note, rep.display_name as reporter,"
                    + " res.display_name as resolver,"
                    + " case r.target_type when 'SERIES' then ts.title"
                    + "   when 'EPISODE' then te.title else left(tc.body, 200) end as target_title,"
                    + " case r.target_type when 'SERIES' then lower(ts.visibility)"
                    + "   when 'EPISODE' then lower(te.status) else lower(tc.status) end"
                    + "   as target_status,"
                    + " coalesce(ts.slug, tes.slug, tcs.slug) as series_slug,"
                    + " coalesce(te.number, tce.number) as episode_number"
                    + " from reports r join users rep on rep.id = r.reporter_id"
                    + " left join users res on res.id = r.resolved_by"
                    + " left join series ts on r.target_type = 'SERIES' and ts.id = r.target_id"
                    + " left join episodes te on r.target_type = 'EPISODE' and te.id = r.target_id"
                    + " left join series tes on tes.id = te.series_id"
                    + " left join comments tc on r.target_type = 'COMMENT' and tc.id = r.target_id"
                    + " left join series tcs on tcs.id = tc.series_id"
                    + " left join episodes tce on tce.id = tc.episode_id";

    public List<ReportRow> reports(@Nullable String status, @Nullable Key after, int limit) {
        String sql =
                REPORT_SELECT
                        + " where true"
                        + (status == null ? "" : " and r.status = :status")
                        + (after == null ? "" : " and (r.created_at, r.id) < (:t, :id)")
                        + " order by r.created_at desc, r.id desc limit :limit";
        return page(jdbc.sql(sql), null, status, after, limit).query((rs, n) -> report(rs)).list();
    }

    public Optional<ReportRow> report(UUID id) {
        return jdbc.sql(REPORT_SELECT + " where r.id = :id")
                .param("id", id)
                .query((rs, n) -> report(rs))
                .optional();
    }

    /** The report, locked until the transaction ends. */
    public Optional<OpenReport> lockReport(UUID id) {
        return jdbc.sql(
                        "select id, target_type, target_id, status from reports where id = :id"
                                + " for update")
                .param("id", id)
                .query((rs, n) ->
                        new OpenReport(
                                rs.getObject("id", UUID.class),
                                ContentType.valueOf(rs.getString("target_type")),
                                rs.getObject("target_id", UUID.class),
                                rs.getString("status")))
                .optional();
    }

    /**
     * Closes every open report on one target.
     *
     * @return how many were closed
     */
    public int closeReportsOn(
            ContentType type,
            UUID targetId,
            String status,
            UUID admin,
            @Nullable String note,
            OffsetDateTime now) {
        return jdbc.sql(
                        "update reports set status = :status, resolved_by = :admin,"
                                + " resolved_at = :now, resolution_note = :note"
                                + " where target_type = :type and target_id = :target"
                                + " and status = 'OPEN'")
                .param("status", status)
                .param("admin", admin)
                .param("now", now)
                .param("note", note, Types.VARCHAR)
                .param("type", type.name())
                .param("target", targetId)
                .update();
    }

    /** Closes one report. */
    public void closeReport(
            UUID id, String status, UUID admin, @Nullable String note, OffsetDateTime now) {
        jdbc.sql(
                        "update reports set status = :status, resolved_by = :admin,"
                                + " resolved_at = :now, resolution_note = :note where id = :id")
                .param("status", status)
                .param("admin", admin)
                .param("now", now)
                .param("note", note, Types.VARCHAR)
                .param("id", id)
                .update();
    }

    // ---------- orders ----------

    public List<OrderRow> orders(
            @Nullable String q, @Nullable String status, @Nullable Key after, int limit) {
        String sql =
                "select o.id, o.order_number, o.user_id, u.email, u.display_name,"
                        + " o.coins + o.bonus_coins + o.first_bonus_coins as total, o.method,"
                        + " o.status, o.price_usd_cents, o.price_khr, o.created_at, o.paid_at,"
                        + " o.refunded_at from payment_orders o join users u on u.id = o.user_id"
                        + " where true"
                        + (q == null
                                ? ""
                                : " and (o.order_number ilike :q or u.email ilike :q"
                                        + " or u.display_name ilike :q)")
                        + (status == null ? "" : " and lower(o.status) = :status")
                        + (after == null ? "" : " and (o.created_at, o.id) < (:t, :id)")
                        + " order by o.created_at desc, o.id desc limit :limit";
        return page(jdbc.sql(sql), q, status, after, limit).query((rs, n) -> order(rs)).list();
    }

    public Optional<OrderRow> order(UUID id) {
        return jdbc.sql(
                        "select o.id, o.order_number, o.user_id, u.email, u.display_name,"
                                + " o.coins + o.bonus_coins + o.first_bonus_coins as total,"
                                + " o.method, o.status, o.price_usd_cents, o.price_khr,"
                                + " o.created_at, o.paid_at, o.refunded_at from payment_orders o"
                                + " join users u on u.id = o.user_id where o.id = :id")
                .param("id", id)
                .query((rs, n) -> order(rs))
                .optional();
    }

    // ---------- audit ----------

    public void audit(
            @Nullable UUID actor,
            String action,
            String targetType,
            @Nullable String targetId,
            String detailsJson,
            @Nullable String requestId,
            OffsetDateTime now) {
        jdbc.sql(
                        "insert into audit_log (actor_id, action, target_type, target_id, details,"
                                + " request_id, created_at) values (:actor, :action, :type,"
                                + " :target, cast(:details as jsonb), :request, :now)")
                .param("actor", actor, Types.OTHER)
                .param("action", action)
                .param("type", targetType)
                .param("target", targetId, Types.VARCHAR)
                .param("details", detailsJson)
                .param("request", requestId, Types.VARCHAR)
                .param("now", now)
                .update();
    }

    public List<AuditRow> auditLog(
            @Nullable String action, @Nullable UUID actor, @Nullable Long beforeId, int limit) {
        String sql =
                "select a.id, a.actor_id, u.display_name, a.action, a.target_type, a.target_id,"
                        + " a.details::text as details, a.request_id, a.created_at"
                        + " from audit_log a left join users u on u.id = a.actor_id where true"
                        + (action == null ? "" : " and a.action like :action")
                        + (actor == null ? "" : " and a.actor_id = :actor")
                        + (beforeId == null ? "" : " and a.id < :before")
                        + " order by a.id desc limit :limit";
        JdbcClient.StatementSpec spec = jdbc.sql(sql).param("limit", limit);
        if (action != null) {
            spec = spec.param("action", action);
        }
        if (actor != null) {
            spec = spec.param("actor", actor);
        }
        if (beforeId != null) {
            spec = spec.param("before", beforeId);
        }
        return spec.query((rs, n) ->
                        new AuditRow(
                                rs.getLong("id"),
                                rs.getObject("actor_id", UUID.class),
                                rs.getString("display_name"),
                                rs.getString("action"),
                                rs.getString("target_type"),
                                rs.getString("target_id"),
                                rs.getString("details"),
                                rs.getString("request_id"),
                                rs.getObject("created_at", OffsetDateTime.class)))
                .list();
    }

    // ---------- overview ----------

    public Counts counts() {
        return jdbc.sql(
                        "select (select count(*) from reports where status = 'OPEN') as reports,"
                                + " (select count(*) from users where status = 'BANNED') as banned,"
                                + " (select count(*) from series where visibility = 'HIDDEN') as s,"
                                + " (select count(*) from episodes where status = 'HIDDEN') as e,"
                                + " (select count(*) from comments where status = 'HIDDEN') as c,"
                                + " (select count(*) from payment_orders where status = 'REFUNDED')"
                                + " as refunds")
                .query((rs, n) ->
                        new Counts(
                                rs.getLong("reports"),
                                rs.getLong("banned"),
                                rs.getLong("s"),
                                rs.getLong("e"),
                                rs.getLong("c"),
                                rs.getLong("refunds")))
                .single();
    }

    // ---------- helpers ----------

    private static JdbcClient.StatementSpec page(
            JdbcClient.StatementSpec spec,
            @Nullable String q,
            @Nullable String status,
            @Nullable Key after,
            int limit) {
        JdbcClient.StatementSpec s = spec.param("limit", limit);
        if (q != null) {
            s =
                    s.param(
                            "q",
                            "%"
                                    + q.replace("\\", "\\\\")
                                            .replace("%", "\\%")
                                            .replace("_", "\\_")
                                    + "%");
        }
        if (status != null) {
            s = s.param("status", status);
        }
        if (after != null) {
            s = s.param("t", after.createdAt()).param("id", after.id());
        }
        return s;
    }

    private static List<String> strings(Array array) throws SQLException {
        return Arrays.asList((String[]) array.getArray());
    }

    private static ReportRow report(ResultSet rs) throws SQLException {
        return new ReportRow(
                rs.getObject("id", UUID.class),
                ContentType.valueOf(rs.getString("target_type")),
                rs.getObject("target_id", UUID.class),
                rs.getString("reason"),
                rs.getString("details"),
                rs.getString("status"),
                rs.getString("reporter"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("resolved_at", OffsetDateTime.class),
                rs.getString("resolver"),
                rs.getString("resolution_note"),
                rs.getString("target_title"),
                rs.getString("target_status"),
                rs.getString("series_slug"),
                rs.getObject("episode_number", Integer.class));
    }

    private static OrderRow order(ResultSet rs) throws SQLException {
        return new OrderRow(
                rs.getObject("id", UUID.class),
                rs.getString("order_number"),
                rs.getObject("user_id", UUID.class),
                rs.getString("email"),
                rs.getString("display_name"),
                rs.getInt("total"),
                rs.getString("method"),
                rs.getString("status"),
                rs.getObject("price_usd_cents", Integer.class),
                rs.getObject("price_khr", Integer.class),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("paid_at", OffsetDateTime.class),
                rs.getObject("refunded_at", OffsetDateTime.class));
    }
}
