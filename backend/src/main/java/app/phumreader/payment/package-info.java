/**
 * Coin packs, orders, ABA PayWay (KHQR, ABA Pay, hosted card page), webhooks and purchase history
 * (plan P3-11).
 *
 * <p>Layout inside a feature: {@code web} (controllers and request/response records) calls {@code
 * service}, which uses {@code repository} and {@code domain}. ArchitectureTest enforces it.
 */
package app.phumreader.payment;
