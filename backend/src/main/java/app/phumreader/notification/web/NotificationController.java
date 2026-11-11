package app.phumreader.notification.web;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.notification.domain.InboxTab;
import app.phumreader.notification.service.InboxViews.NotificationItem;
import app.phumreader.notification.service.InboxViews.UnreadCount;
import app.phumreader.notification.service.NotificationInbox;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Arrays;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Notifications page and the header bell (V21-03). Signed in only; another account's item
 * answers 404 like one that does not exist.
 */
@RestController
@RequestMapping("/api/v1/me/notifications")
@Tag(name = "notifications")
class NotificationController {

    private static final String CURSOR = "nextCursor of the previous page; omit for the first page";
    private static final String LIMIT = "Page size, 1-100 (default 20)";
    private static final String NOT_FOUND = "404 notification_not_found for another's item.";

    private final NotificationInbox inbox;

    NotificationController(NotificationInbox inbox) {
        this.inbox = inbox;
    }

    @GetMapping
    @Operation(
            summary = "The inbox, newest first",
            description =
                    "tab: all (default), unread, episodes, comments or coins; removed items are"
                            + " left out. 400 invalid_value (field tab), invalid_cursor.")
    CursorPage<NotificationItem> list(
            @RequestParam(defaultValue = "all")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {
                                                "all",
                                                "unread",
                                                "episodes",
                                                "comments",
                                                "coins"
                                            },
                                            defaultValue = "all"))
                    String tab,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT) @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return inbox.list(user.id(), tab(tab), cursor, limit);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "How many items are unread (the bell)")
    UnreadCount unreadCount(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return inbox.unreadCount(user.id());
    }

    @PutMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Marks an item read (again: no change)", description = NOT_FOUND)
    void markRead(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        inbox.markRead(user.id(), id, true);
    }

    @DeleteMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Marks an item unread", description = NOT_FOUND)
    void markUnread(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        inbox.markRead(user.id(), id, false);
    }

    @PostMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Marks every item read")
    void markAllRead(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        inbox.markAllRead(user.id());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Removes an item",
            description =
                    "Restorable for 7 days (the page's Undo), then deleted. Removing again: no"
                            + " change. "
                            + NOT_FOUND)
    void remove(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        inbox.remove(user.id(), id);
    }

    @PostMapping("/{id}/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Brings a removed item back (Undo)",
            description = "Restoring an item that is not removed: no change. " + NOT_FOUND)
    void restore(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        inbox.restore(user.id(), id);
    }

    private static InboxTab tab(String value) {
        return Arrays.stream(InboxTab.values())
                .filter(t -> t.key().equals(value))
                .findFirst()
                .orElseThrow(() ->
                        ApiException.invalidField(
                                "tab",
                                "invalid_value",
                                "Use one of: all, unread, episodes, comments, coins"));
    }
}
