/**
 * Coin wallet, append-only ledger, unlocks and creator earnings (plan P3-10).
 *
 * <p>Layout inside a feature: {@code web} (controllers and request/response records) calls {@code
 * service}, which uses {@code repository} and {@code domain}. ArchitectureTest enforces it.
 */
package app.phumreader.coin;
