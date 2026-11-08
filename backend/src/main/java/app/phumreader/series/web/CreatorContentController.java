package app.phumreader.series.web;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.series.domain.SeriesVisibility;
import app.phumreader.series.service.CreatorContentService;
import app.phumreader.series.service.CreatorInput.EpisodeInput;
import app.phumreader.series.service.CreatorInput.SeriesInput;
import app.phumreader.series.service.CreatorService;
import app.phumreader.series.service.CreatorViews.CreatorEpisode;
import app.phumreader.series.service.CreatorViews.CreatorSeries;
import app.phumreader.series.service.CreatorViews.EpisodeEdit;
import app.phumreader.series.service.CreatorViews.SeriesEdit;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
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
 * Creators write series and episodes (plan P3-14). Another creator's series answers 403, an unknown
 * one 404.
 */
@RestController
@RequestMapping("/api/v1/creator/series")
@PreAuthorize("hasRole('CREATOR')")
@Tag(name = "creator")
class CreatorContentController {

    private final CreatorContentService content;
    private final CreatorService creators;

    CreatorContentController(CreatorContentService content, CreatorService creators) {
        this.content = content;
        this.creators = creators;
    }

    // ---------- series ----------

    @GetMapping
    @Operation(
            summary = "My series, with a text filter and a visibility filter",
            description = "q matches the title; visibility is draft, published or hidden.")
    List<CreatorSeries> list(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String visibility) {
        SeriesVisibility wanted = null;
        if (visibility != null && !visibility.isBlank()) {
            try {
                wanted = SeriesVisibility.valueOf(visibility.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                throw ApiException.invalidField(
                        "visibility", "invalid", "Use draft, published or hidden.");
            }
        }
        SeriesVisibility filter = wanted;
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        return creators.dashboard(user.id()).series().stream()
                .filter(s -> filter == null || s.visibility() == filter)
                .filter(s ->
                        needle.isEmpty()
                                || s.series().title().toLowerCase(Locale.ROOT).contains(needle))
                .toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Create a series as a draft",
            description =
                    "cover / banner come from finished uploads (POST /creator/uploads). The slug is"
                            + " made from the title and never changes.")
    SeriesEdit create(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody SeriesInput body) {
        return content.createSeries(user, body);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Edit a series",
            description = "Leave the upload ids out to keep the current cover / banner.")
    SeriesEdit update(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @Valid @RequestBody SeriesInput body) {
        return content.updateSeries(user, id, body);
    }

    @PostMapping("/{id}/publish")
    @Operation(
            summary = "Put the series live",
            description = "Needs a summary and a cover. 403 hidden_by_admin when an admin hid it.")
    SeriesEdit publish(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return content.publishSeries(user, id);
    }

    @PostMapping("/{id}/unpublish")
    @Operation(summary = "Take the series back to a draft")
    SeriesEdit unpublish(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return content.unpublishSeries(user, id);
    }

    // ---------- episodes ----------

    @GetMapping("/{id}/episodes")
    @Operation(summary = "Every episode of the series, newest first, drafts and scheduled too")
    List<CreatorEpisode> episodes(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return content.episodes(user, id);
    }

    @GetMapping("/{id}/episodes/{number}")
    @Operation(summary = "One episode as the edit form shows it")
    EpisodeEdit episode(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable int number) {
        return content.episode(user, id, number);
    }

    @PostMapping("/{id}/episodes")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Add an episode (comic) or chapter (novel)",
            description =
                    "publish.mode is DRAFT, NOW or SCHEDULED (with publish.at, an instant in the"
                            + " future). Comics send imageUploadIds in reading order (at most 100,"
                            + " 200 MB), novels send blocks. fastPass null means free; otherwise 3-10"
                            + " coins and free after 1-90 days (defaults 5 and 7). number null takes"
                            + " the next free number.")
    EpisodeEdit createEpisode(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @Valid @RequestBody EpisodeInput body) {
        return content.createEpisode(user, id, body);
    }

    @PutMapping("/{id}/episodes/{number}")
    @Operation(
            summary = "Edit an episode",
            description =
                    "Send the whole episode. A published episode stays published (publish.mode NOW);"
                            + " drafts and scheduled episodes can change mode.")
    EpisodeEdit updateEpisode(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable int number,
            @Valid @RequestBody EpisodeInput body) {
        return content.updateEpisode(user, id, number, body);
    }

    @DeleteMapping("/{id}/episodes/{number}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Delete a draft or scheduled episode",
            description = "409 episode_published for a live episode.")
    void deleteEpisode(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable int number) {
        content.deleteEpisode(user, id, number);
    }
}
