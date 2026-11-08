package app.phumreader.search.web;

import app.phumreader.common.error.ApiException;
import app.phumreader.search.domain.SearchFilter;
import app.phumreader.search.domain.SearchSort;
import app.phumreader.series.service.CatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Search box, command dialog and the search page (plan P3-15): Meilisearch when it is set up
 * (typos, prefixes, Khmer), PostgreSQL otherwise, behind the same addresses.
 */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "search")
class SearchController {

    private final CatalogService catalog;

    SearchController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/search")
    @Operation(
            summary = "Series by title, creator or genre, with filters and sort",
            description =
                    "An empty query with no filter returns the 6 most viewed series (\"Popular"
                            + " now\"); an empty query with a filter lists the matching series."
                            + " 400 invalid_value (field: the parameter) for an unknown filter or"
                            + " sort.")
    SearchResults search(
            @RequestParam(defaultValue = "") @Size(max = 100) String q,
            @RequestParam(required = false) @Parameter(description = "1-20 (default 8)")
                    @Nullable Integer limit,
            @RequestParam(required = false)
                    @Parameter(schema = @Schema(allowableValues = {"comic", "novel"}))
                    @Nullable String type,
            @RequestParam(required = false)
                    @Parameter(description = "Genre slug, e.g. action")
                    @Size(max = 60)
                    @Nullable String genre,
            @RequestParam(required = false)
                    @Parameter(
                            schema = @Schema(allowableValues = {"ongoing", "completed", "hiatus"}))
                    @Nullable String status,
            @RequestParam(defaultValue = "relevance")
                    @Parameter(
                            schema = @Schema(allowableValues = {"relevance", "popular", "newest"}))
                    String sort) {
        SearchFilter filter =
                new SearchFilter(
                        type == null ? null : pick("type", type, TYPES),
                        genre == null || genre.isBlank()
                                ? null
                                : genre.strip().toLowerCase(Locale.ROOT),
                        status == null ? null : pick("status", status, STATUSES),
                        pick("sort", sort, SORTS));
        return new SearchResults(catalog.search(q, filter, limit));
    }

    @GetMapping("/search/suggestions")
    @Operation(
            summary = "Up to 6 series titles for search-as-you-type",
            description = "An empty query returns the titles of the most viewed series.")
    Suggestions suggestions(@RequestParam(defaultValue = "") @Size(max = 100) String q) {
        return new Suggestions(catalog.suggestions(q));
    }

    /**
     * @param items titles, best first
     */
    record Suggestions(List<String> items) {}

    private static final Map<String, String> TYPES = Map.of("comic", "COMIC", "novel", "NOVEL");
    private static final Map<String, String> STATUSES =
            Map.of("ongoing", "ONGOING", "completed", "COMPLETED", "hiatus", "HIATUS");
    private static final Map<String, SearchSort> SORTS =
            Map.of(
                    "relevance", SearchSort.RELEVANCE,
                    "popular", SearchSort.POPULAR,
                    "newest", SearchSort.NEWEST);

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
