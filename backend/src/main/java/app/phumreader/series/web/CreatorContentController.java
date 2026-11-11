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

    private static final String ITEM = "contact, cover, title, age or images";

    private static final String FIELDS =
            "secondGenre: another genre's slug or null (400 fields.secondGenre = unknown_genre /"
                    + " same_as_genre). ageRating: all, teen (13+), teen16 (16+) or mature (18+)."
                    + " updateDays: Mon ... Sun, each at most once (400 fields.updateDays ="
                    + " duplicate_day), sent back in week order. releaseHour: 0-23 in"
                    + " Asia/Phnom_Penh. fastPass: { on, ahead 1-5 }, default on with 3 ahead: the"
                    + " defaults for new episodes. commentsEnabled: default true. breakMessage: up"
                    + " to 120 characters, kept only while the status is hiatus.";

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
            description =
                    "q matches the title; visibility is draft, review, changes, published or"
                            + " hidden. review is the latest submission for review (null when the"
                            + " series was never submitted).")
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
                        "visibility",
                        "invalid",
                        "Use draft, review, changes, published or hidden.");
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
                            + " made from the title and never changes. "
                            + FIELDS)
    SeriesEdit create(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody SeriesInput body) {
        return content.createSeries(user, body);
    }

    @PutMapping("/{id}")
    @Operation(
            summary = "Edit a series",
            description =
                    "Send the whole series: a field left out or null takes its default. Leave the"
                            + " upload ids out to keep the current cover / banner. "
                            + FIELDS)
    SeriesEdit update(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @Valid @RequestBody SeriesInput body) {
        return content.updateSeries(user, id, body);
    }

    @PostMapping("/{id}/publish")
    @Operation(
            summary = "Put a series live again that an admin approved before",
            description =
                    "Only for a series that went live once and was taken off (unpublish): a new"
                            + " series answers 409 review_required and goes through POST"
                            + " /{id}/submit. Needs a summary and a cover. 403 hidden_by_admin"
                            + " when an admin hid it; 409 already_in_review while it waits for a"
                            + " review, changes_requested while the admin's changes are open.")
    SeriesEdit publish(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return content.publishSeries(user, id);
    }

    @PostMapping("/{id}/unpublish")
    @Operation(
            summary = "Take the series back to a draft",
            description =
                    "403 hidden_by_admin when an admin hid it; 409 already_in_review while it"
                            + " waits for a review, changes_requested while the admin's changes"
                            + " are open.")
    SeriesEdit unpublish(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return content.unpublishSeries(user, id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Delete a series for good",
            description =
                    "Only while none of its episodes was ever published (live, hidden, released or"
                            + " unlocked): drafts and scheduled episodes go with it. 409"
                            + " has_published_episodes otherwise (such a series can only be"
                            + " hidden); 403 not_your_series for another creator's series.")
    void deleteSeries(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        content.deleteSeries(user, id);
    }

    // ---------- review ----------

    @PostMapping("/{id}/submit")
    @Operation(
            summary = "Submit the series for review (Submit for review / Resubmit)",
            description =
                    "draft or changes -> review: the series joins the admins' queue and goes live"
                            + " when an admin approves it. Needs a summary and a cover (400 with"
                            + " fields.summary / fields.coverUploadId = required). From changes,"
                            + " every requested change must be marked fixed first (409"
                            + " changes_not_fixed). 409 already_in_review when it already waits,"
                            + " already_published when it is live; 403 hidden_by_admin when an"
                            + " admin hid it.")
    SeriesEdit submit(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return content.submitSeries(user, id);
    }

    @PutMapping("/{id}/review/items/{item}")
    @Operation(
            summary = "Mark a requested change fixed",
            description =
                    "Saved, so it shows on every device; marking it again keeps the first time."
                            + " 409 no_changes_requested unless the series waits for changes"
                            + " (visibility changes), 404 item_not_requested when the admin did"
                            + " not ask for this item, 400 invalid_item for an unknown key.")
    SeriesEdit markFixed(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable @Parameter(description = ITEM) String item) {
        return content.markFixed(user, id, item);
    }

    @DeleteMapping("/{id}/review/items/{item}")
    @Operation(
            summary = "Undo Mark fixed",
            description =
                    "409 no_changes_requested unless the series waits for changes (visibility"
                            + " changes), 404 item_not_requested when the admin did not ask for"
                            + " this item, 400 invalid_item for an unknown key.")
    SeriesEdit markNotFixed(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable @Parameter(description = ITEM) String item) {
        return content.markNotFixed(user, id, item);
    }

    // ---------- episodes ----------

    @GetMapping("/{id}/episodes")
    @Operation(
            summary = "Every episode of the series, newest first, drafts and scheduled too",
            description =
                    "hiddenAt is set while the creator hides a published episode from readers;"
                            + " status hidden means an admin took it down.")
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
                            + " coins and free after 1-90 days (defaults 5 and 7). useSeriesFastPass"
                            + " true takes the series' Fast Pass instead (fastPass must be null, 400"
                            + " fields.fastPass = not_with_series_fast_pass): on, 5 coins and free"
                            + " after ceil(ahead x 7 / max(1, update days)) days; off, free. number"
                            + " null takes the next free number.")
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
                            + " drafts and scheduled episodes can change mode. useSeriesFastPass"
                            + " true answers 400 fields.useSeriesFastPass = new_episodes_only. A"
                            + " hidden episode stays hidden.")
    EpisodeEdit updateEpisode(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable int number,
            @Valid @RequestBody EpisodeInput body) {
        return content.updateEpisode(user, id, number, body);
    }

    @PostMapping("/{id}/episodes/{number}/hide")
    @Operation(
            summary = "Hide a published episode from readers",
            description =
                    "Readers no longer see it, also those who unlocked it (no refund), until it is"
                            + " shown again; numbers don't shift. Hiding it again keeps hiddenAt."
                            + " 409 episode_not_published for drafts and scheduled episodes,"
                            + " episode_hidden when an admin took it down.")
    CreatorEpisode hideEpisode(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable int number) {
        return content.hideEpisode(user, id, number);
    }

    @PostMapping("/{id}/episodes/{number}/show")
    @Operation(
            summary = "Show a hidden episode to readers again",
            description =
                    "Showing a visible episode changes nothing. 409 episode_not_published for"
                            + " drafts and scheduled episodes, episode_hidden when an admin took it"
                            + " down (only an admin can put it back).")
    CreatorEpisode showEpisode(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id,
            @PathVariable int number) {
        return content.showEpisode(user, id, number);
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
