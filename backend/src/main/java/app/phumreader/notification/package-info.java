/**
 * Email and web push for new episodes (plan P3-16) and the in-app notifications inbox (V21-03).
 * Development prints emails in the console.
 *
 * <p>Layout inside a feature: {@code web} (controllers and request/response records) calls {@code
 * service}, which uses {@code repository} and {@code domain}. ArchitectureTest enforces it.
 */
package app.phumreader.notification;
