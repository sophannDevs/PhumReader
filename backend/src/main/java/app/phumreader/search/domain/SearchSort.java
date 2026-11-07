package app.phumreader.search.domain;

/** Order of search results. */
public enum SearchSort {
    /** Best match first; equally good matches by views. */
    RELEVANCE,
    /** Most viewed first. */
    POPULAR,
    /** Most recently launched first. */
    NEWEST
}
