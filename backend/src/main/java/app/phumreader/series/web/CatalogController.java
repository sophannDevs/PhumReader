package app.phumreader.series.web;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.common.views.ViewRecorder;
import app.phumreader.common.web.Viewer;
import app.phumreader.series.domain.SeriesOrder;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.service.CatalogService;
import app.phumreader.series.service.CatalogService.EpisodeOrder;
import app.phumreader.series.service.CatalogService.RankingKind;
import app.phumreader.series.service.CatalogViews.EpisodeSummary;
import app.phumreader.series.service.CatalogViews.GenreItem;
import app.phumreader.series.service.CatalogViews.HomeFeed;
import app.phumreader.series.service.CatalogViews.RankingEntry;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import app.phumreader.series.service.CatalogViews.SeriesDetail;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The public catalog: anyone may call these, signed in or not (plan P3-06). */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "catalog")
class CatalogController {

    private static final String CURSOR = "nextCursor of the previous page; omit for the first page";
    private static final String LIMIT = "Page size, 1-100 (default 20)";

    private final CatalogService catalog;

    private final ViewRecorder views;

    CatalogController(CatalogService catalog, ViewRecorder views) {
        this.catalog = catalog;
        this.views = views;
    }

    @GetMapping("/home")
    @Operation(summary = "Home feed: hero, daily updates, rankings, genres, web novels")
    HomeFeed home() {
        return catalog.home();
    }

    @GetMapping("/rankings")
    @Operation(summary = "A ranking, best first")
    CursorPage<RankingEntry> rankings(
            @RequestParam(defaultValue = "comics")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {"comics", "novels"},
                                            defaultValue = "comics"))
                    String kind,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        RankingKind rankingKind =
                pick(
                        "kind",
                        kind,
                        Map.of("comics", RankingKind.COMICS, "novels", RankingKind.NOVELS));
        return catalog.rankings(rankingKind, cursor, limit);
    }

    @GetMapping("/genres")
    @Operation(summary = "All genres in display order")
    List<GenreItem> genres() {
        return catalog.genres();
    }

    @GetMapping("/genres/{slug}")
    @Operation(summary = "One genre (404 when unknown)")
    GenreItem genre(@PathVariable String slug) {
        return catalog.genre(slug);
    }

    @GetMapping("/series")
    @Operation(summary = "Published series, optionally of one type and one genre")
    CursorPage<SeriesCard> seriesList(
            @RequestParam(required = false)
                    @Parameter(schema = @Schema(allowableValues = {"comic", "novel"}))
                    @Nullable String type,
            @RequestParam(required = false)
                    @Parameter(description = "Genre slug, e.g. slice-of-life")
                    @Nullable String genre,
            @RequestParam(defaultValue = "popular")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {"popular", "newest"},
                                            defaultValue = "popular"))
                    String sort,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        SeriesType seriesType =
                type == null
                        ? null
                        : pick(
                                "type",
                                type,
                                Map.of("comic", SeriesType.COMIC, "novel", SeriesType.NOVEL));
        SeriesOrder order =
                pick(
                        "sort",
                        sort,
                        Map.of("popular", SeriesOrder.POPULAR, "newest", SeriesOrder.NEWEST));
        return catalog.series(seriesType, genre, order, cursor, limit);
    }

    @GetMapping("/series/{slug}")
    @Operation(summary = "The series page (404 when unknown)")
    SeriesDetail series(
            @PathVariable String slug,
            @Parameter(hidden = true) @AuthenticationPrincipal @Nullable CurrentUser user,
            @Parameter(hidden = true) HttpServletRequest request) {
        SeriesDetail detail = catalog.series(slug);
        views.series(detail.series().id(), Viewer.of(user, request));
        return detail;
    }

    @GetMapping("/series/{slug}/episodes")
    @Operation(summary = "Released episodes of a series (404 when the series is unknown)")
    CursorPage<EpisodeSummary> episodes(
            @PathVariable String slug,
            @RequestParam(defaultValue = "oldest")
                    @Parameter(
                            schema =
                                    @Schema(
                                            allowableValues = {"oldest", "newest"},
                                            defaultValue = "oldest"))
                    String sort,
            @RequestParam(required = false) @Parameter(description = CURSOR)
                    @Nullable String cursor,
            @RequestParam(required = false) @Parameter(description = LIMIT)
                    @Nullable Integer limit) {
        EpisodeOrder order =
                pick(
                        "sort",
                        sort,
                        Map.of("oldest", EpisodeOrder.OLDEST, "newest", EpisodeOrder.NEWEST));
        return catalog.episodes(slug, order, cursor, limit);
    }

    /** The value for {@code text}, or 400 naming the parameter. */
    private static <T> T pick(String parameter, String text, Map<String, T> values) {
        T value = values.get(text);
        if (value == null) {
            throw ApiException.invalidField(
                    parameter,
                    "invalid_value",
                    "Use one of: " + String.join(", ", values.keySet().stream().sorted().toList()));
        }
        return value;
    }
}
