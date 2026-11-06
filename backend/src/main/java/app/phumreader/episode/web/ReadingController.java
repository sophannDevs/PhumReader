package app.phumreader.episode.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.episode.service.ReadingService;
import app.phumreader.episode.service.ReadingViews.BookmarkState;
import app.phumreader.episode.service.ReadingViews.EpisodeContent;
import app.phumreader.episode.service.ReadingViews.EpisodeLikeState;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Comic and novel readers: content, progress, likes, bookmarks (plan P3-09). */
@RestController
@RequestMapping("/api/v1/series/{slug}")
@Tag(name = "reading")
class ReadingController {

    private final ReadingService reading;

    ReadingController(ReadingService reading) {
        this.reading = reading;
    }

    /**
     * @param episode the episode or chapter number opened
     * @param progress how far into it, 0 to 1
     */
    public record ProgressRequest(
            @NotNull @Min(1) Integer episode,
            @NotNull @DecimalMin("0") @DecimalMax("1") Double progress) {}

    @GetMapping("/episodes/{n}")
    @Operation(
            summary = "An episode or chapter to read",
            description =
                    "402 episode_locked (with price and freeOn) for a Fast Pass episode the reader"
                            + " has not unlocked; 404 for an unknown series or episode.")
    EpisodeContent content(
            @PathVariable String slug,
            @PathVariable int n,
            @Parameter(hidden = true) @AuthenticationPrincipal @Nullable CurrentUser user) {
        return reading.content(slug, n, user);
    }

    @PutMapping("/progress")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Save where the reader is in the series (Continue reading)")
    void progress(
            @PathVariable String slug,
            @Valid @RequestBody ProgressRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        reading.saveProgress(user, slug, request.episode(), request.progress());
    }

    @PutMapping("/episodes/{n}/like")
    @Operation(summary = "Like an episode")
    EpisodeLikeState like(
            @PathVariable String slug,
            @PathVariable int n,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return reading.like(user, slug, n, true);
    }

    @DeleteMapping("/episodes/{n}/like")
    @Operation(summary = "Take back an episode like")
    EpisodeLikeState unlike(
            @PathVariable String slug,
            @PathVariable int n,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return reading.like(user, slug, n, false);
    }

    @PutMapping("/episodes/{n}/bookmark")
    @Operation(summary = "Bookmark an episode or chapter")
    BookmarkState bookmark(
            @PathVariable String slug,
            @PathVariable int n,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return reading.bookmark(user, slug, n, true);
    }

    @DeleteMapping("/episodes/{n}/bookmark")
    @Operation(summary = "Remove a bookmark")
    BookmarkState unbookmark(
            @PathVariable String slug,
            @PathVariable int n,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return reading.bookmark(user, slug, n, false);
    }
}
