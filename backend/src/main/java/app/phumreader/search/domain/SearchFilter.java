package app.phumreader.search.domain;

import org.jspecify.annotations.Nullable;

/**
 * What a search may be narrowed to, and how it is ordered.
 *
 * @param type COMIC or NOVEL, or null for both
 * @param genreSlug a genre slug such as {@code slice-of-life}, or null for all
 * @param status ONGOING, COMPLETED or HIATUS, or null for all
 * @param sort the order of the results
 */
public record SearchFilter(
        @Nullable String type,
        @Nullable String genreSlug,
        @Nullable String status,
        SearchSort sort) {

    public static final SearchFilter NONE =
            new SearchFilter(null, null, null, SearchSort.RELEVANCE);

    /** True when nothing narrows the search and the order is by relevance. */
    public boolean isPlain() {
        return type == null && genreSlug == null && status == null && sort == SearchSort.RELEVANCE;
    }

    /** True when the search is narrowed (the order alone does not narrow it). */
    public boolean narrows() {
        return type != null || genreSlug != null || status != null;
    }
}
