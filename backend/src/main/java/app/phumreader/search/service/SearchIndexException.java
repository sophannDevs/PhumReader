package app.phumreader.search.service;

/** The search index could not be reached or refused a request. */
public class SearchIndexException extends RuntimeException {

    public SearchIndexException(String message, Throwable cause) {
        super(message, cause);
    }

    public SearchIndexException(String message) {
        super(message);
    }
}
