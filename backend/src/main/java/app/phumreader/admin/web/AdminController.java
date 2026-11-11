package app.phumreader.admin.web;

import app.phumreader.admin.domain.ContentType;
import app.phumreader.admin.service.AdminService;
import app.phumreader.admin.service.AdminService.ReportAction;
import app.phumreader.admin.service.AdminViews.AdminContent;
import app.phumreader.admin.service.AdminViews.AdminOrder;
import app.phumreader.admin.service.AdminViews.AdminReport;
import app.phumreader.admin.service.AdminViews.AdminUser;
import app.phumreader.admin.service.AdminViews.AuditEntry;
import app.phumreader.admin.service.AdminViews.Overview;
import app.phumreader.admin.service.AdminViews.RefundResult;
import app.phumreader.admin.service.AdminViews.ReviewQueueItem;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.series.domain.ReviewItem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The admin area (plan P3-18; A8 and A9): users, content, the report queue, orders and refunds, the
 * series review queue (V21-01) and the audit log. Only the ADMIN role gets in (SecurityConfig);
 * every change is audited.
 */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "admin")
class AdminController {

    private static final String CURSOR = "nextCursor of the previous page; omit for the first page";
    private static final String LIMIT = "Page size, 1-100 (default 20)";

    private final AdminService admin;

    AdminController(AdminService admin) {
        this.admin = admin;
    }

    /**
     * @param reason why; kept in the audit log
     */
    public record ReasonRequest(@NotBlank @Size(max = 500) String reason) {}

    /**
     * @param reason optional note for the audit log
     */
    public record OptionalReasonRequest(@Nullable @Size(max = 500) String reason) {}

    /**
     * @param action dismiss (no violation), resolve (handled), hide (remove the target),
     *     remove_warn (remove and warn) or suspend (remove and suspend the account)
     * @param note optional; kept with the report and in the audit log
     * @param days suspend only: 1-365, default 7
     */
    public record SettleRequest(
            @NotNull ReportAction action,
            @Nullable @Size(max = 1000) String note,
            @Nullable Integer days) {}

    /**
     * @param items what the creator must change: 1 to 5 different keys (contact, cover, title, age,
     *     images)
     * @param note optional note to the creator, at most 300 characters
     */
    public record ChangesRequest(
            @NotNull @Size(min = 1, max = 5) List<@NotNull ReviewItem> items,
            @Nullable @Size(max = 300) String note) {}

    /**
     * @param note optional note to the creator, at most 300 characters
     */
    public record DecisionNoteRequest(@Nullable @Size(max = 300) String note) {}

    @GetMapping("/overview")
    @Operation(summary = "Counts for the admin start page")
    Overview overview() {
        return admin.overview();
    }

    // ---------- users ----------

    @GetMapping("/users")
    @Operation(summary = "Users, newest first; search by email or name")
    CursorPage<AdminUser> users(
            @RequestParam(required = false) @Nullable String q,
            @RequestParam(required = false)
                    @Parameter(description = "active, banned, deletion_pending or deleted")
                    @Nullable String status,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        return admin.users(q, status, cursor, limit);
    }

    @PostMapping("/users/{id}/ban")
    @Operation(summary = "Suspend an account and sign it out everywhere")
    AdminUser ban(
            @PathVariable UUID id,
            @Valid @RequestBody ReasonRequest body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return admin.ban(user, id, body.reason());
    }

    @PostMapping("/users/{id}/unban")
    @Operation(summary = "Lift a suspension")
    AdminUser unban(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) @Nullable OptionalReasonRequest body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return admin.unban(user, id, body == null ? null : body.reason());
    }

    // ---------- content ----------

    @GetMapping("/content")
    @Operation(summary = "Series, episodes or comments, newest first")
    CursorPage<AdminContent> content(
            @RequestParam @Parameter(description = "series, episode or comment") String type,
            @RequestParam(required = false) @Nullable String q,
            @RequestParam(required = false)
                    @Parameter(description = "A state of that type, e.g. published or hidden")
                    @Nullable String status,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        return admin.content(ContentType.parse(type), q, status, cursor, limit);
    }

    @PostMapping("/content/{type}/{id}/hide")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Take live content down; its open reports are resolved")
    void hide(
            @PathVariable String type,
            @PathVariable UUID id,
            @Valid @RequestBody ReasonRequest body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        admin.hide(user, ContentType.parse(type), id, body.reason());
    }

    @PostMapping("/content/{type}/{id}/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Put hidden content back")
    void restore(
            @PathVariable String type,
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) @Nullable OptionalReasonRequest body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        admin.restore(user, ContentType.parse(type), id, body == null ? null : body.reason());
    }

    // ---------- reports ----------

    @GetMapping("/reports")
    @Operation(summary = "The report queue, newest first")
    CursorPage<AdminReport> reports(
            @RequestParam(required = false)
                    @Parameter(description = "open, resolved or dismissed; omit for all")
                    @Nullable String status,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        return admin.reports(status, cursor, limit);
    }

    @PostMapping("/reports/{id}/settle")
    @Operation(summary = "Dismiss, resolve or hide the reported content")
    AdminReport settle(
            @PathVariable UUID id,
            @Valid @RequestBody SettleRequest body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return admin.settle(user, id, body.action(), body.note(), body.days());
    }

    // ---------- series review ----------

    @GetMapping("/series-review")
    @Operation(
            summary = "Series waiting for review, oldest first, with the automatic checks",
            description =
                    "flags: contact (contact details or links in the summary: @handles, URLs, www.,"
                            + " t.me/, 9-10 digit phone numbers; detail is the first one found)"
                            + " and similar (the title equals, contains or is inside a live"
                            + " series' title, case and spacing ignored, 4+ characters; detail is"
                            + " that title). watermark is never set yet.")
    CursorPage<ReviewQueueItem> seriesReview(
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        return admin.reviewQueue(cursor, limit);
    }

    @PostMapping("/series/{id}/approve")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Approve a series in review: it goes live",
            description =
                    "Sets its launch date the first time. 409 not_in_review when it no longer"
                            + " waits for a review (another admin decided); 404 series_not_found.")
    void approve(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        admin.approve(user, id);
    }

    @PostMapping("/series/{id}/request-changes")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Send a series in review back with the changes to make",
            description =
                    "The creator marks each item fixed and submits again. 400 validation_failed"
                            + " for no items, more than 5 or a note over 300 characters,"
                            + " duplicate_item for a key given twice, malformed_request for an"
                            + " unknown key; 409 not_in_review when it no longer waits for a"
                            + " review; 404 series_not_found.")
    void requestChanges(
            @PathVariable UUID id,
            @Valid @RequestBody ChangesRequest body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        admin.requestChanges(user, id, body.items(), body.note());
    }

    @PostMapping("/series/{id}/reject")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Reject a series in review: it goes back to a draft",
            description =
                    "409 not_in_review when it no longer waits for a review; 404"
                            + " series_not_found.")
    void reject(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) @Nullable DecisionNoteRequest body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        admin.reject(user, id, body == null ? null : body.note());
    }

    // ---------- orders ----------

    @GetMapping("/orders")
    @Operation(summary = "Coin orders, newest first; search by order number, email or name")
    CursorPage<AdminOrder> orders(
            @RequestParam(required = false) @Nullable String q,
            @RequestParam(required = false)
                    @Parameter(
                            description = "pending, paid, failed, cancelled, expired or refunded")
                    @Nullable String status,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        return admin.orders(q, status, cursor, limit);
    }

    @PostMapping("/orders/{id}/refund")
    @Operation(summary = "Refund a paid order: its coins are taken back through the ledger")
    RefundResult refund(
            @PathVariable UUID id,
            @Valid @RequestBody ReasonRequest body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return admin.refund(user, id, body.reason());
    }

    // ---------- audit log ----------

    @GetMapping("/audit")
    @Operation(summary = "The audit log, newest first")
    CursorPage<AuditEntry> audit(
            @RequestParam(required = false)
                    @Parameter(description = "Action prefix, e.g. user. or order.refund")
                    @Nullable String action,
            @RequestParam(required = false) @Nullable UUID actor,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        return admin.auditLog(action, actor, cursor, limit);
    }
}
