package app.phumreader.library.web;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.library.domain.LibraryOrder;
import app.phumreader.library.service.LibraryService;
import app.phumreader.library.service.LibraryViews.FollowState;
import app.phumreader.library.service.LibraryViews.FollowedCreator;
import app.phumreader.library.service.LibraryViews.HistoryEntry;
import app.phumreader.library.service.LibraryViews.RemovedHistory;
import app.phumreader.library.service.LibraryViews.RemovedHistoryEntry;
import app.phumreader.library.service.LibraryViews.RemovedSubscription;
import app.phumreader.library.service.LibraryViews.RemovedSubscriptions;
import app.phumreader.library.service.LibraryViews.SeriesViewer;
import app.phumreader.library.service.LibraryViews.SubscriptionEntry;
import app.phumreader.library.service.LibraryViews.SubscriptionState;
import app.phumreader.library.service.LibraryViews.UnlockedEntry;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Subscribe, follow, the reader's state on a series page and the library lists (plan P3-12). All of
 * it needs a signed-in reader.
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "library")
class LibraryController {

    private static final String CURSOR = "nextCursor of the previous page; omit for the first page";
    private static final String LIMIT = "Page size, 1-100 (default 20)";

    private final LibraryService library;

    LibraryController(LibraryService library) {
        this.library = library;
    }

    /** Series to remove from a library list (at most 100). */
    public record RemoveRequest(
            @NotEmpty @Size(max = LibraryService.MAX_BULK) List<@NotNull UUID> seriesIds) {}

    /** Entries returned by a remove, sent back to undo it. */
    public record RestoreSubscriptionsRequest(
            @NotEmpty @Size(max = LibraryService.MAX_BULK)
                    List<@NotNull @Valid RemovedSubscription> items) {}

    public record RestoreHistoryRequest(
            @NotEmpty @Size(max = LibraryService.MAX_BULK)
                    List<@NotNull @Valid RemovedHistoryEntry> items) {}

    // ---------- one series, one creator ----------

    @PutMapping("/series/{slug}/subscription")
    @Operation(summary = "Subscribe to a series")
    SubscriptionState subscribe(
            @PathVariable String slug,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.subscribe(user, slug, true);
    }

    @DeleteMapping("/series/{slug}/subscription")
    @Operation(summary = "Unsubscribe from a series")
    SubscriptionState unsubscribe(
            @PathVariable String slug,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.subscribe(user, slug, false);
    }

    @GetMapping("/series/{slug}/me")
    @Operation(
            summary = "The reader's own state on a series page (subscribed, read marks, unlocks)")
    SeriesViewer seriesState(
            @PathVariable String slug,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.seriesState(user, slug);
    }

    @PutMapping("/creators/{id}/follow")
    @Operation(summary = "Follow a creator")
    FollowState follow(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.follow(user, id, true);
    }

    @DeleteMapping("/creators/{id}/follow")
    @Operation(summary = "Stop following a creator")
    FollowState unfollow(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.follow(user, id, false);
    }

    // ---------- lists ----------

    @GetMapping("/me/history")
    @Operation(summary = "Continue reading / Recently read, most recent first or by title")
    CursorPage<HistoryEntry> history(
            @RequestParam(defaultValue = "recent")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {"recent", "title"},
                                            defaultValue = "recent"))
                    String sort,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT) @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.history(user, order(sort), cursor, limit);
    }

    @GetMapping("/me/subscriptions")
    @Operation(summary = "Subscribed series, most recent first or by title")
    CursorPage<SubscriptionEntry> subscriptions(
            @RequestParam(defaultValue = "recent")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {"recent", "title"},
                                            defaultValue = "recent"))
                    String sort,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT) @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.subscriptions(user, order(sort), cursor, limit);
    }

    @GetMapping("/me/unlocked")
    @Operation(summary = "Unlocked episodes, most recent first or by series title and number")
    CursorPage<UnlockedEntry> unlocked(
            @RequestParam(defaultValue = "recent")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {"recent", "title"},
                                            defaultValue = "recent"))
                    String sort,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT) @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.unlocked(user, order(sort), cursor, limit);
    }

    @GetMapping("/me/follows")
    @Operation(summary = "Followed creators, most recent first")
    CursorPage<FollowedCreator> follows(
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT) @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.follows(user, cursor, limit);
    }

    // ---------- remove with undo ----------

    @PostMapping("/me/subscriptions/remove")
    @Operation(summary = "Unsubscribe from several series; returns what to send back to undo")
    RemovedSubscriptions removeSubscriptions(
            @Valid @RequestBody RemoveRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.removeSubscriptions(user, request.seriesIds());
    }

    @PostMapping("/me/subscriptions/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Undo a remove: subscribe again with the original dates")
    void restoreSubscriptions(
            @Valid @RequestBody RestoreSubscriptionsRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        library.restoreSubscriptions(user, request.items());
    }

    @PostMapping("/me/history/remove")
    @Operation(
            summary = "Remove series from the reading history; returns what to send back to undo")
    RemovedHistory removeHistory(
            @Valid @RequestBody RemoveRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return library.removeHistory(user, request.seriesIds());
    }

    @PostMapping("/me/history/restore")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Undo a history remove")
    void restoreHistory(
            @Valid @RequestBody RestoreHistoryRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        library.restoreHistory(user, request.items());
    }

    private static LibraryOrder order(String sort) {
        return switch (sort) {
            case "recent" -> LibraryOrder.RECENT;
            case "title" -> LibraryOrder.TITLE;
            default ->
                    throw ApiException.invalidField(
                            "sort", "invalid_value", "Use one of: recent, title");
        };
    }
}
