package app.phumreader.search.service;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * The series search index (Meilisearch). Absent when {@code phumreader.search.url} is not set; the
 * catalog then searches PostgreSQL. Methods throw {@link SearchIndexException} when the index
 * cannot be reached.
 */
public interface SearchIndex {

    /** Series ids that match {@code query}, best first (typos and prefixes allowed). */
    List<UUID> search(String query, int limit);

    /** Adds or replaces documents. */
    void upsert(Collection<SearchDoc> docs);

    /** Removes documents (a series that was unpublished or deleted). */
    void delete(Collection<UUID> ids);

    /** Makes the index hold exactly {@code docs}: adds or updates them and removes the rest. */
    void replaceAll(Collection<SearchDoc> docs);

    /** Number of documents in the index. */
    long count();
}
