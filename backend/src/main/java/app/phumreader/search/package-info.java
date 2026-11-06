/**
 * Search with Meilisearch, kept in sync through outbox events (plan P3-15).
 *
 * <p>Layout inside a feature: {@code web} (controllers and request/response records) calls {@code
 * service}, which uses {@code repository} and {@code domain}. ArchitectureTest enforces it.
 */
package app.phumreader.search;
