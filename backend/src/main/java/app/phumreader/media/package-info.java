/**
 * Images: R2 storage, presigned uploads and processing (plan P3-07, P3-08; not in Stage 1).
 *
 * <p>Layout inside a feature: {@code web} (controllers and request/response records) calls {@code
 * service}, which uses {@code repository} and {@code domain}. ArchitectureTest enforces it.
 */
package app.phumreader.media;
