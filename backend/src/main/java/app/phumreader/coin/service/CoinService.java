package app.phumreader.coin.service;

import app.phumreader.coin.domain.LedgerReason;
import app.phumreader.coin.repository.CoinQueries;
import app.phumreader.coin.repository.CoinQueries.LedgerRow;
import app.phumreader.coin.service.CoinViews.LedgerEntry;
import app.phumreader.coin.service.CoinViews.LedgerEpisode;
import app.phumreader.coin.service.CoinViews.UnlockResult;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.error.LockedException;
import app.phumreader.common.idempotency.IdempotencyKeys;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.series.service.CatalogRefs.EpisodeRef;
import app.phumreader.series.service.CatalogRefs.SeriesRef;
import app.phumreader.series.service.CatalogService;
import app.phumreader.user.domain.Role;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coins (plan P3-10): the balance, Fast Pass unlocks and the ledger. Every change locks the
 * reader's wallet row, writes the ledger and the new balance in one transaction, so the balance
 * always equals the ledger and never goes below zero.
 */
@Service
public class CoinService {

    static final String UNLOCK_SCOPE = "unlock";

    private final CoinQueries queries;
    private final CatalogService catalog;
    private final IdempotencyKeys idempotency;
    private final Clock clock;

    public CoinService(
            CoinQueries queries, CatalogService catalog, IdempotencyKeys idempotency, Clock clock) {
        this.queries = queries;
        this.catalog = catalog;
        this.idempotency = idempotency;
        this.clock = clock;
    }

    public int balance(UUID userId) {
        return queries.balance(userId);
    }

    /**
     * Unlocks a Fast Pass episode for its price in coins, at most once: a retry with the same
     * {@code Idempotency-Key}, or a second unlock of the same episode, charges nothing.
     *
     * @throws LockedException 402 {@code not_enough_coins} (with the price and the free date)
     * @throws ApiException 409 {@code episode_not_locked} when the episode is free (or the reader
     *     is its creator or an admin)
     */
    @Transactional
    public UnlockResult unlock(CurrentUser user, String slug, int number, String key) {
        SeriesRef series = catalog.require(slug);
        EpisodeRef episode = catalog.requireEpisode(series, number);
        OffsetDateTime now = now();
        int balance = queries.lockWallet(user.id(), now);

        String request = "unlock|" + episode.id();
        Optional<UnlockResult> repeated =
                idempotency.find(user.id(), UNLOCK_SCOPE, key, request, UnlockResult.class);
        if (repeated.isPresent()) {
            return repeated.get();
        }
        boolean owner = user.id().equals(series.creatorId()) || user.hasRole(Role.ADMIN.name());
        if (!episode.needsUnlock() || owner) {
            throw ApiException.conflict(
                    "episode_not_locked", "This episode can already be read without coins.");
        }

        UnlockResult result;
        if (queries.hasUnlock(user.id(), episode.id())) {
            result = new UnlockResult(number, 0, balance, true);
        } else {
            Integer price = episode.summary().price();
            int coins = price == null ? 0 : price;
            if (balance < coins) {
                throw new LockedException(
                        "not_enough_coins",
                        "You need " + (coins - balance) + " more coins to unlock this episode.",
                        coins,
                        episode.summary().date());
            }
            UUID unlockId = queries.insertUnlock(user.id(), episode.id(), coins, now);
            int after = balance - coins;
            queries.appendLedger(
                    user.id(),
                    -coins,
                    after,
                    LedgerReason.UNLOCK,
                    null,
                    unlockId,
                    series.title() + " · " + episode.summary().title(),
                    now);
            queries.setBalance(user.id(), after, now);
            queries.insertEarning(series.creatorId(), unlockId, episode.id(), coins, now);
            result = new UnlockResult(number, coins, after, false);
        }
        idempotency.save(user.id(), UNLOCK_SCOPE, key, request, result);
        return result;
    }

    /**
     * Locks the wallet for a balance change in the caller's transaction (payments) and returns the
     * balance.
     */
    public int lockWallet(UUID userId) {
        return queries.lockWallet(userId, now());
    }

    /**
     * Adds coins: one ledger row and the new balance. The caller holds the wallet lock ({@link
     * #lockWallet}) and passes the balance it got.
     *
     * @return the new balance
     */
    public int credit(
            UUID userId,
            int balance,
            int amount,
            LedgerReason reason,
            @Nullable UUID orderId,
            @Nullable String note) {
        if (amount <= 0) {
            return balance;
        }
        OffsetDateTime now = now();
        int after = balance + amount;
        queries.appendLedger(userId, amount, after, reason, orderId, null, note, now);
        queries.setBalance(userId, after, now);
        return after;
    }

    /** The reader's coin history, newest first. */
    public CursorPage<LedgerEntry> ledger(
            CurrentUser user, @Nullable String cursor, @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        Long before = beforeId(cursor);
        List<LedgerRow> rows = queries.ledger(user.id(), before, size + 1);
        List<LedgerRow> page = rows.size() > size ? rows.subList(0, size) : rows;
        List<LedgerEntry> items =
                page.stream()
                        .map(r ->
                                new LedgerEntry(
                                        r.id(),
                                        r.amount(),
                                        r.balanceAfter(),
                                        r.reason(),
                                        r.note(),
                                        r.createdAt().toInstant(),
                                        r.orderNumber(),
                                        r.seriesSlug() == null || r.episode() == null
                                                ? null
                                                : new LedgerEpisode(
                                                        r.seriesSlug(),
                                                        String.valueOf(r.seriesTitle()),
                                                        r.episode())))
                        .toList();
        String next = rows.size() > size ? Cursors.encode("l|" + page.getLast().id()) : null;
        return new CursorPage<>(items, next);
    }

    private static @Nullable Long beforeId(@Nullable String cursor) {
        String text = Cursors.decode(cursor);
        if (text == null) {
            return null;
        }
        String[] parts = text.split("\\|", -1);
        try {
            if (parts.length == 2 && parts[0].equals("l")) {
                return Long.parseLong(parts[1]);
            }
        } catch (NumberFormatException ignored) {
            // falls through to the error below
        }
        throw ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }
}
