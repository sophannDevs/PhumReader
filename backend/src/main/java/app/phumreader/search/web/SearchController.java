package app.phumreader.search.web;

import app.phumreader.series.service.CatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Search box and command dialog. For now a PostgreSQL search by title, creator or genre; P3-15
 * moves it to Meilisearch (filters, sort, suggestions) behind the same address.
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
            summary = "Series by title, creator or genre",
            description = "An empty query returns the 6 most viewed series (\"Popular now\").")
    SearchResults search(
            @RequestParam(defaultValue = "") @Size(max = 100) String q,
            @RequestParam(required = false) @Parameter(description = "1-20 (default 8)")
                    @Nullable Integer limit) {
        return new SearchResults(catalog.search(q, limit));
    }
}
