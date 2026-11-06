package app.phumreader.comment.web;

import app.phumreader.comment.domain.CommentOrder;
import app.phumreader.comment.service.CommentService;
import app.phumreader.comment.service.CommentService.TargetType;
import app.phumreader.comment.service.CommentViews.CommentLikeState;
import app.phumreader.comment.service.CommentViews.CommentView;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
 * Comment threads on series pages and episodes, comment likes and reports (plan P3-13). Reading a
 * thread is public; everything else needs a signed-in reader.
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "comments")
class CommentController {

    private static final String CURSOR = "nextCursor of the previous page; omit for the first page";
    private static final String LIMIT = "Page size, 1-100 (default 20)";

    private final CommentService comments;

    CommentController(CommentService comments) {
        this.comments = comments;
    }

    /**
     * @param body the comment, 1-500 characters after trimming
     */
    public record CommentRequest(@NotNull @Size(max = 2000) String body) {}

    /**
     * @param reason short reason, e.g. "spam"
     * @param details optional longer explanation
     */
    public record ReportRequest(
            @NotBlank @Size(max = 50) String reason, @Nullable @Size(max = 1000) String details) {}

    // ---------- threads ----------

    @GetMapping("/series/{slug}/comments")
    @Operation(summary = "Comments on the series page")
    CursorPage<CommentView> seriesThread(
            @PathVariable String slug,
            @RequestParam(defaultValue = "top")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {"top", "newest"},
                                            defaultValue = "top"))
                    String sort,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT) @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal @Nullable CurrentUser user) {
        return comments.list(slug, null, order(sort), cursor, limit, user);
    }

    @GetMapping("/series/{slug}/episodes/{n}/comments")
    @Operation(summary = "Comments on an episode")
    CursorPage<CommentView> episodeThread(
            @PathVariable String slug,
            @PathVariable int n,
            @RequestParam(defaultValue = "top")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {"top", "newest"},
                                            defaultValue = "top"))
                    String sort,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT) @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal @Nullable CurrentUser user) {
        return comments.list(slug, n, order(sort), cursor, limit, user);
    }

    @PostMapping("/series/{slug}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Comment on the series page")
    CommentView postOnSeries(
            @PathVariable String slug,
            @Valid @RequestBody CommentRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return comments.post(user, slug, null, request.body());
    }

    @PostMapping("/series/{slug}/episodes/{n}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Comment on an episode",
            description =
                    "402 when the reader may not read the episode; 403 comments_disabled when the"
                            + " creator turned comments off.")
    CommentView postOnEpisode(
            @PathVariable String slug,
            @PathVariable int n,
            @Valid @RequestBody CommentRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return comments.post(user, slug, n, request.body());
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a comment (its author, the series' creator or an admin)")
    void delete(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        comments.delete(user, id);
    }

    @PutMapping("/comments/{id}/like")
    @Operation(summary = "Like a comment")
    CommentLikeState like(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return comments.like(user, id, true);
    }

    @DeleteMapping("/comments/{id}/like")
    @Operation(summary = "Take back a comment like")
    CommentLikeState unlike(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return comments.like(user, id, false);
    }

    // ---------- reports ----------

    @PostMapping("/series/{slug}/report")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Report a series to the admins")
    void reportSeries(
            @PathVariable String slug,
            @Valid @RequestBody ReportRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        comments.report(
                user, TargetType.SERIES, slug, null, null, request.reason(), request.details());
    }

    @PostMapping("/series/{slug}/episodes/{n}/report")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Report an episode to the admins")
    void reportEpisode(
            @PathVariable String slug,
            @PathVariable int n,
            @Valid @RequestBody ReportRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        comments.report(
                user, TargetType.EPISODE, slug, n, null, request.reason(), request.details());
    }

    @PostMapping("/comments/{id}/report")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Report a comment to the admins")
    void reportComment(
            @PathVariable UUID id,
            @Valid @RequestBody ReportRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        comments.report(
                user, TargetType.COMMENT, null, null, id, request.reason(), request.details());
    }

    private static CommentOrder order(String sort) {
        return switch (sort) {
            case "top" -> CommentOrder.TOP;
            case "newest" -> CommentOrder.NEWEST;
            default ->
                    throw ApiException.invalidField(
                            "sort", "invalid_value", "Use one of: newest, top");
        };
    }
}
