package app.phumreader.search.service;

import java.util.Locale;
import java.util.UUID;

/**
 * What the search index knows about one published series.
 *
 * @param id the series id (the index's primary key)
 * @param title series title
 * @param creator the creator's pen name
 * @param genre genre name
 * @param genreSlug genre slug, for filtering
 * @param type COMIC or NOVEL
 * @param status ONGOING, COMPLETED or HIATUS
 * @param views view count, used to rank equally good matches
 * @param launchedAt when the series went live, seconds since 1970 (for "newest")
 */
public record SearchDoc(
        UUID id,
        String title,
        String creator,
        String genre,
        String genreSlug,
        String type,
        String status,
        long views,
        long launchedAt) {

    /** A document without filter fields (tests): ongoing, genre slug from the name. */
    public SearchDoc(UUID id, String title, String creator, String genre, String type, long views) {
        this(id, title, creator, genre, genre.toLowerCase(Locale.ROOT), type, "ONGOING", views, 0);
    }
}
