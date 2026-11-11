package app.phumreader.admin.service;

import app.phumreader.admin.domain.ContentType;
import app.phumreader.admin.repository.AdminQueries;
import app.phumreader.admin.repository.AdminQueries.AuditRow;
import app.phumreader.admin.repository.AdminQueries.ContentRow;
import app.phumreader.admin.repository.AdminQueries.Key;
import app.phumreader.admin.repository.AdminQueries.LiveTitle;
import app.phumreader.admin.repository.AdminQueries.OpenReport;
import app.phumreader.admin.repository.AdminQueries.OrderRow;
import app.phumreader.admin.repository.AdminQueries.QueueRow;
import app.phumreader.admin.repository.AdminQueries.ReportRow;
import app.phumreader.admin.repository.AdminQueries.ReviewTarget;
import app.phumreader.admin.repository.AdminQueries.UserRow;
import app.phumreader.admin.service.AdminViews.AdminContent;
import app.phumreader.admin.service.AdminViews.AdminOrder;
import app.phumreader.admin.service.AdminViews.AdminReport;
import app.phumreader.admin.service.AdminViews.AdminUser;
import app.phumreader.admin.service.AdminViews.AuditEntry;
import app.phumreader.admin.service.AdminViews.Overview;
import app.phumreader.admin.service.AdminViews.RefundResult;
import app.phumreader.admin.service.AdminViews.ReportTarget;
import app.phumreader.admin.service.AdminViews.ReviewQueueItem;
import app.phumreader.auth.service.TokenService;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.notification.service.NotificationInbox;
import app.phumreader.payment.service.PaymentService;
import app.phumreader.payment.service.PaymentService.Refund;
import app.phumreader.search.service.SearchEvents;
import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.ReviewDecision;
import app.phumreader.series.domain.ReviewItem;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.domain.SeriesVisibility;
import app.phumreader.series.service.CatalogService;
import app.phumreader.user.domain.Role;
import app.phumreader.user.service.UserService;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * The admin area (plan P3-18, A8 and A9): users, content, the report queue, orders and the series
 * review queue (V21-01). Every change writes its audit row in the same transaction. The controller
 * lets only the ADMIN role in.
 */
@Service
@Transactional(readOnly = true)
public class AdminService {

    private static final String OPEN = "OPEN";
    private static final String SERIES = ContentType.SERIES.name();
    private static final String RESOLVED = "RESOLVED";
    private static final String DISMISSED = "DISMISSED";

    private final AdminQueries queries;
    private final AuditService audit;
    private final UserService users;
    private final TokenService tokens;
    private final PaymentService payments;
    private final CatalogService catalog;
    private final SearchEvents searchEvents;
    private final NotificationInbox inbox;
    private final JsonMapper json;
    private final Clock clock;

    public AdminService(
            AdminQueries queries,
            AuditService audit,
            UserService users,
            TokenService tokens,
            PaymentService payments,
            CatalogService catalog,
            SearchEvents searchEvents,
            NotificationInbox inbox,
            JsonMapper json,
            Clock clock) {
        this.queries = queries;
        this.audit = audit;
        this.users = users;
        this.tokens = tokens;
        this.payments = payments;
        this.catalog = catalog;
        this.searchEvents = searchEvents;
        this.inbox = inbox;
        this.json = json;
        this.clock = clock;
    }

    // ---------- overview ----------

    public Overview overview() {
        var c = queries.counts();
        return new Overview(
                c.openReports(),
                c.bannedUsers(),
                c.hiddenSeries(),
                c.hiddenEpisodes(),
                c.hiddenComments(),
                c.refundedOrders(),
                c.seriesInReview(),
                c.oldestReviewAt() == null ? null : c.oldestReviewAt().toInstant());
    }

    // ---------- users ----------

    public CursorPage<AdminUser> users(
            @Nullable String q,
            @Nullable String status,
            @Nullable String cursor,
            @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<UserRow> rows = queries.users(text(q), upper(status), key(cursor), size + 1);
        return page(rows, size, UserRow::createdAt, UserRow::id, AdminService::view);
    }

    /** Suspends an account: it can no longer sign in or refresh, and its devices are signed out. */
    @Transactional
    public AdminUser ban(CurrentUser admin, UUID userId, String reason) {
        UserRow target = requireUser(userId);
        if (target.roles().contains(Role.ADMIN.name())) {
            throw ApiException.conflict(
                    "cannot_ban_admin", "An admin account cannot be suspended here.");
        }
        if (!users.ban(userId)) {
            throw ApiException.conflict("already_banned", "This account is already suspended.");
        }
        tokens.revokeAll(userId);
        audit.record(
                admin.id(),
                "user.ban",
                "USER",
                userId.toString(),
                details("reason", reason, "email", target.email(), "was", target.status()));
        return view(requireUser(userId));
    }

    @Transactional
    public AdminUser unban(CurrentUser admin, UUID userId, @Nullable String reason) {
        UserRow target = requireUser(userId);
        if (!users.unban(userId)) {
            throw ApiException.conflict("not_banned", "This account is not suspended.");
        }
        audit.record(
                admin.id(),
                "user.unban",
                "USER",
                userId.toString(),
                details("reason", reason, "email", target.email()));
        return view(requireUser(userId));
    }

    // ---------- content ----------

    public CursorPage<AdminContent> content(
            ContentType type,
            @Nullable String q,
            @Nullable String status,
            @Nullable String cursor,
            @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<ContentRow> rows =
                queries.content(type, text(q), lower(status), key(cursor), size + 1);
        return page(
                rows,
                size,
                ContentRow::createdAt,
                ContentRow::id,
                r ->
                        new AdminContent(
                                r.type(),
                                r.id(),
                                r.title(),
                                r.owner(),
                                r.status(),
                                r.seriesSlug(),
                                r.episodeNumber(),
                                r.createdAt().toInstant(),
                                r.openReports()));
    }

    /**
     * Takes live content down. Readers no longer see it, its creator cannot put it back, and the
     * open reports on it are resolved (each reporter gets a notification, V21-03).
     */
    @Transactional
    public void hide(CurrentUser admin, ContentType type, UUID id, String reason) {
        change(admin, type, id, type.live(), type.hidden(), "content.hide", reason);
        closeOpenReports(admin, type, id, "Hidden: " + reason);
    }

    /** Puts hidden content back. */
    @Transactional
    public void restore(CurrentUser admin, ContentType type, UUID id, @Nullable String reason) {
        change(admin, type, id, type.hidden(), type.live(), "content.restore", reason);
    }

    private void change(
            CurrentUser admin,
            ContentType type,
            UUID id,
            String from,
            String to,
            String action,
            @Nullable String reason) {
        String state =
                queries.state(type, id)
                        .orElseThrow(() ->
                                ApiException.notFound(
                                        "content_not_found", "No such " + name(type) + "."));
        if (!state.equals(from) || !queries.changeState(type, id, from, to)) {
            throw ApiException.conflict(
                    to.equals(type.hidden()) ? "not_hideable" : "not_hidden",
                    to.equals(type.hidden())
                            ? "Only live content can be hidden; this "
                                    + name(type)
                                    + " is "
                                    + state.toLowerCase(Locale.ROOT)
                                    + "."
                            : "This " + name(type) + " is not hidden.");
        }
        audit.record(
                admin.id(),
                action,
                type.name(),
                id.toString(),
                details("reason", reason, "from", from.toLowerCase(Locale.ROOT)));
        queries.seriesOf(type, id)
                .ifPresent(series -> searchEvents.seriesChanged("CHANGED", List.of(series)));
        catalog.refreshHome();
    }

    // ---------- series review (V21-01) ----------

    /** Series waiting for review, oldest first, with the automatic checks' flags. */
    public CursorPage<ReviewQueueItem> reviewQueue(
            @Nullable String cursor, @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<QueueRow> rows = queries.reviewQueue(key(cursor), size + 1);
        List<LiveTitle> live = rows.isEmpty() ? List.of() : queries.liveTitles();
        return page(rows, size, QueueRow::submittedAt, QueueRow::id, r -> view(r, live));
    }

    /** The series goes live, like a creator's publish (search, home feed, launch date). */
    @Transactional
    public void approve(CurrentUser admin, UUID seriesId) {
        String title = decide(admin, seriesId, ReviewDecision.APPROVED, List.of(), null);
        audit.record(
                admin.id(), "series.approve", SERIES, seriesId.toString(), details("title", title));
        searchEvents.seriesChanged("CHANGED", List.of(seriesId));
        catalog.refreshHome();
    }

    /** Sends the series back to its creator, who fixes the items and submits it again. */
    @Transactional
    public void requestChanges(
            CurrentUser admin, UUID seriesId, List<ReviewItem> items, @Nullable String note) {
        if (new HashSet<>(items).size() != items.size()) {
            throw ApiException.invalidField(
                    "items", "duplicate_item", "Choose each change only once.");
        }
        List<String> keys = items.stream().map(ReviewItem::key).toList();
        String clean = text(note);
        String title = decide(admin, seriesId, ReviewDecision.CHANGES, keys, clean);
        audit.record(
                admin.id(),
                "series.changes",
                SERIES,
                seriesId.toString(),
                details("title", title, "items", keys, "note", clean));
    }

    /** Turns the series down: it goes back to a draft. */
    @Transactional
    public void reject(CurrentUser admin, UUID seriesId, @Nullable String note) {
        String clean = text(note);
        String title = decide(admin, seriesId, ReviewDecision.REJECTED, List.of(), clean);
        audit.record(
                admin.id(),
                "series.reject",
                SERIES,
                seriesId.toString(),
                details("title", title, "note", clean));
    }

    /**
     * Settles the series' open submission and moves the series on; 404 when it does not exist, 409
     * {@code not_in_review} when it no longer waits (another admin decided, or a double click).
     *
     * @return the series' title, for the audit log
     */
    private String decide(
            CurrentUser admin,
            UUID seriesId,
            ReviewDecision decision,
            List<String> items,
            @Nullable String note) {
        ReviewTarget target =
                queries.lockSeries(seriesId)
                        .orElseThrow(
                                () -> ApiException.notFound("series_not_found", "No such series."));
        SeriesVisibility to =
                switch (decision) {
                    case APPROVED -> SeriesVisibility.PUBLISHED;
                    case CHANGES -> SeriesVisibility.CHANGES;
                    case REJECTED -> SeriesVisibility.DRAFT;
                };
        if (!target.visibility().equals(SeriesVisibility.REVIEW.name())) {
            throw notInReview();
        }
        long review =
                queries.closeReview(seriesId, decision.name(), admin.id(), note, now())
                        .orElseThrow(AdminService::notInReview);
        queries.addReviewItems(review, items);
        // The series row is locked, so it is still in review.
        queries.leaveReview(seriesId, to.name(), now());
        inbox.seriesReviewed(seriesId, review, decision, items, note, admin.id());
        return target.title();
    }

    private static ApiException notInReview() {
        return ApiException.conflict(
                "not_in_review",
                "This series is no longer waiting for a review; another admin may have decided.");
    }

    // ---------- reports ----------

    public CursorPage<AdminReport> reports(
            @Nullable String status, @Nullable String cursor, @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<ReportRow> rows = queries.reports(upper(status), key(cursor), size + 1);
        return page(rows, size, ReportRow::createdAt, ReportRow::id, AdminService::view);
    }

    /**
     * Settles a report: {@code dismiss} (nothing wrong), {@code resolve} (handled), or {@code hide}
     * (the target is taken down, which also resolves every other open report on it). The reporters
     * get a notification (V21-03).
     */
    @Transactional
    public AdminReport settle(
            CurrentUser admin, UUID reportId, ReportAction action, @Nullable String note) {
        OpenReport report =
                queries.lockReport(reportId)
                        .orElseThrow(
                                () -> ApiException.notFound("report_not_found", "No such report."));
        if (!report.status().equals(OPEN)) {
            throw ApiException.conflict(
                    "report_closed", "This report was already settled by another admin.");
        }
        switch (action) {
            case HIDE -> {
                String reason = note == null || note.isBlank() ? "Reported" : note;
                var state = queries.state(report.targetType(), report.targetId());
                if (state.isPresent() && state.get().equals(report.targetType().live())) {
                    hide(admin, report.targetType(), report.targetId(), reason);
                }
                // Hidden by hand or by another report meanwhile: this one is still handled.
                queries.closeReport(reportId, RESOLVED, admin.id(), note, now());
                inbox.reportsResolved(List.of(reportId), true, admin.id());
            }
            case RESOLVE -> {
                queries.closeReport(reportId, RESOLVED, admin.id(), note, now());
                inbox.reportsResolved(List.of(reportId), false, admin.id());
            }
            case DISMISS -> {
                queries.closeReport(reportId, DISMISSED, admin.id(), note, now());
                inbox.reportDismissed(reportId, admin.id());
            }
        }
        audit.record(
                admin.id(),
                action == ReportAction.DISMISS ? "report.dismiss" : "report.resolve",
                "REPORT",
                reportId.toString(),
                details(
                        "action",
                        action.name().toLowerCase(Locale.ROOT),
                        "note",
                        note,
                        "targetType",
                        report.targetType().name(),
                        "targetId",
                        report.targetId().toString()));
        return view(queries.report(reportId).orElseThrow());
    }

    /** What an admin can do with a report. */
    public enum ReportAction {
        @JsonProperty("dismiss")
        DISMISS,
        @JsonProperty("resolve")
        RESOLVE,
        @JsonProperty("hide")
        HIDE
    }

    /** Resolves the open reports on content that was taken down; the reporters hear it. */
    private void closeOpenReports(CurrentUser admin, ContentType type, UUID id, String note) {
        List<UUID> closed = queries.closeReportsOn(type, id, RESOLVED, admin.id(), note, now());
        if (!closed.isEmpty()) {
            audit.record(
                    admin.id(),
                    "report.resolve",
                    type.name(),
                    id.toString(),
                    details("reports", closed.size(), "note", note));
            inbox.reportsResolved(closed, true, admin.id());
        }
    }

    // ---------- orders ----------

    public CursorPage<AdminOrder> orders(
            @Nullable String q,
            @Nullable String status,
            @Nullable String cursor,
            @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<OrderRow> rows = queries.orders(text(q), lower(status), key(cursor), size + 1);
        return page(rows, size, OrderRow::createdAt, OrderRow::id, AdminService::view);
    }

    /** Refunds a paid order to the ledger: the coins it credited are taken back. */
    @Transactional
    public RefundResult refund(CurrentUser admin, UUID orderId, String reason) {
        OrderRow before =
                queries.order(orderId)
                        .orElseThrow(
                                () -> ApiException.notFound("order_not_found", "No such order."));
        Refund refund = payments.refund(orderId, reason);
        audit.record(
                admin.id(),
                "order.refund",
                "ORDER",
                orderId.toString(),
                details(
                        "reason",
                        reason,
                        "orderNumber",
                        before.orderNumber(),
                        "userId",
                        before.userId().toString(),
                        "coins",
                        refund.coins()));
        return new RefundResult(view(queries.order(orderId).orElseThrow()), refund.coins());
    }

    // ---------- audit log ----------

    public CursorPage<AuditEntry> auditLog(
            @Nullable String action,
            @Nullable UUID actor,
            @Nullable String cursor,
            @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<AuditRow> rows =
                queries.auditLog(
                        text(action) == null ? null : text(action) + "%",
                        actor,
                        auditBefore(cursor),
                        size + 1);
        List<AuditRow> shown = rows.size() > size ? rows.subList(0, size) : rows;
        String next = rows.size() > size ? Cursors.encode("a|" + shown.getLast().id()) : null;
        return new CursorPage<>(shown.stream().map(this::view).toList(), next);
    }

    private @Nullable Long auditBefore(@Nullable String cursor) {
        String text = Cursors.decode(cursor);
        if (text == null) {
            return null;
        }
        String[] parts = text.split("\\|", -1);
        try {
            if (parts.length == 2 && parts[0].equals("a")) {
                return Long.parseLong(parts[1]);
            }
        } catch (NumberFormatException ignored) {
            // falls through to the error below
        }
        throw ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
    }

    // ---------- helpers ----------

    private UserRow requireUser(UUID id) {
        return queries.user(id)
                .orElseThrow(() -> ApiException.notFound("user_not_found", "No such account."));
    }

    private static String name(ContentType type) {
        return type.name().toLowerCase(Locale.ROOT);
    }

    private static @Nullable String text(@Nullable String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static @Nullable String upper(@Nullable String value) {
        String t = text(value);
        return t == null ? null : t.toUpperCase(Locale.ROOT);
    }

    private static @Nullable String lower(@Nullable String value) {
        String t = text(value);
        return t == null ? null : t.toLowerCase(Locale.ROOT);
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }

    /** Alternating key, value pairs; null values are left out. */
    private static Map<String, Object> details(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            if (pairs[i + 1] != null) {
                map.put((String) pairs[i], pairs[i + 1]);
            }
        }
        return map;
    }

    private static @Nullable Key key(@Nullable String cursor) {
        String text = Cursors.decode(cursor);
        if (text == null) {
            return null;
        }
        String[] parts = text.split("\\|", -1);
        try {
            if (parts.length == 3 && parts[0].equals("c")) {
                return new Key(
                        OffsetDateTime.parse(parts[1]).withOffsetSameInstant(ZoneOffset.UTC),
                        UUID.fromString(parts[2]));
            }
        } catch (RuntimeException ignored) {
            // falls through to the error below
        }
        throw ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
    }

    private static <R, V> CursorPage<V> page(
            List<R> rows,
            int size,
            Function<R, OffsetDateTime> created,
            Function<R, UUID> id,
            Function<R, V> view) {
        List<R> shown = rows.size() > size ? rows.subList(0, size) : rows;
        String next = null;
        if (rows.size() > size) {
            R last = shown.getLast();
            next = Cursors.encode("c|" + created.apply(last).toInstant() + "|" + id.apply(last));
        }
        return new CursorPage<>(shown.stream().map(view).toList(), next);
    }

    private static AdminUser view(UserRow r) {
        return new AdminUser(
                r.id(),
                r.email(),
                r.displayName(),
                r.status().toLowerCase(Locale.ROOT),
                r.roles(),
                r.createdAt().toInstant(),
                r.lastLoginAt() == null ? null : r.lastLoginAt().toInstant());
    }

    private static ReviewQueueItem view(QueueRow r, List<LiveTitle> live) {
        return new ReviewQueueItem(
                r.id(),
                r.slug(),
                r.title(),
                r.creator(),
                SeriesType.valueOf(r.type()),
                r.genre(),
                AgeRating.valueOf(r.ageRating()),
                r.languages(),
                r.episodeCount(),
                r.coverUrl(),
                r.summary(),
                r.submittedAt().toInstant(),
                ReviewChecks.flags(r.id(), r.title(), r.summary(), live));
    }

    private static AdminReport view(ReportRow r) {
        return new AdminReport(
                r.id(),
                r.reason(),
                r.details(),
                r.status().toLowerCase(Locale.ROOT),
                r.reporter(),
                r.createdAt().toInstant(),
                r.resolvedAt() == null ? null : r.resolvedAt().toInstant(),
                r.resolvedBy(),
                r.note(),
                new ReportTarget(
                        r.targetType(),
                        r.targetId(),
                        r.targetTitle(),
                        r.targetStatus(),
                        r.seriesSlug(),
                        r.episodeNumber()));
    }

    private static AdminOrder view(OrderRow r) {
        return new AdminOrder(
                r.id(),
                r.orderNumber(),
                r.userId(),
                r.email(),
                r.displayName(),
                r.coins(),
                r.method().toLowerCase(Locale.ROOT),
                r.status().toLowerCase(Locale.ROOT),
                r.priceUsdCents(),
                r.priceKhr(),
                r.createdAt().toInstant(),
                r.paidAt() == null ? null : r.paidAt().toInstant(),
                r.refundedAt() == null ? null : r.refundedAt().toInstant(),
                r.status().equals("PAID"));
    }

    @SuppressWarnings("unchecked")
    private AuditEntry view(AuditRow r) {
        Map<String, Object> details;
        try {
            details = json.readValue(r.details(), Map.class);
        } catch (JacksonException e) {
            details = Map.of();
        }
        return new AuditEntry(
                r.id(),
                r.actorId(),
                r.actorName(),
                r.action(),
                r.targetType(),
                r.targetId(),
                details,
                r.requestId(),
                r.createdAt().toInstant());
    }
}
