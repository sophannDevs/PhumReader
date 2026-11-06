package app.phumreader.coin.service;

import app.phumreader.coin.domain.LedgerReason;
import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** What the coin endpoints return (plan P3-10). */
public final class CoinViews {

    private CoinViews() {}

    /**
     * The signed-in reader's coins.
     *
     * @param balance coins now (the sum of the reader's ledger)
     * @param firstPurchaseBonus the first-purchase bonus (double coins) is still on offer
     */
    public record Wallet(int balance, boolean firstPurchaseBonus) {}

    /**
     * An unlock.
     *
     * @param coins coins charged by this request (0 when the episode was already unlocked)
     * @param balance coins left
     * @param alreadyUnlocked the reader had unlocked this episode before
     */
    public record UnlockResult(int episode, int coins, int balance, boolean alreadyUnlocked) {}

    /**
     * One change to the reader's coins, newest first.
     *
     * @param amount coins added (positive) or spent (negative)
     * @param orderNumber the order, for purchases and their bonuses
     * @param episode the episode, for unlocks
     */
    public record LedgerEntry(
            long id,
            int amount,
            int balanceAfter,
            LedgerReason reason,
            @Nullable String note,
            Instant createdAt,
            @Nullable String orderNumber,
            @Nullable LedgerEpisode episode) {}

    /**
     * @param series the series' slug
     */
    public record LedgerEpisode(String series, String title, int n) {}
}
