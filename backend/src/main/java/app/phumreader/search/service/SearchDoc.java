package app.phumreader.search.service;

import java.util.UUID;

/**
 * What the search index knows about one published series.
 *
 * @param id the series id (the index's primary key)
 * @param title series title
 * @param creator the creator's pen name
 * @param genre genre name
 * @param type COMIC or NOVEL
 * @param views view count, used to rank equally good matches
 */
public record SearchDoc(
        UUID id, String title, String creator, String genre, String type, long views) {}
