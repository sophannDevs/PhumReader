package app.phumreader.library.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.library.domain.LibraryOrder;
import app.phumreader.library.repository.LibraryQueries;
import app.phumreader.library.repository.LibraryQueries.FollowRow;
import app.phumreader.library.repository.LibraryQueries.HistoryRow;
import app.phumreader.library.repository.LibraryQueries.Key;
import app.phumreader.library.repository.LibraryQueries.SubscriptionRow;
import app.phumreader.library.repository.LibraryQueries.UnlockRow;
import app.phumreader.library.service.LibraryViews.FollowState;
import app.phumreader.library.service.LibraryViews.FollowedCreator;
import app.phumreader.library.service.LibraryViews.HistoryEntry;
import app.phumreader.library.service.LibraryViews.RemovedHistory;
import app.phumreader.library.service.LibraryViews.RemovedHistoryEntry;
import app.phumreader.library.service.LibraryViews.RemovedSubscription;
import app.phumreader.library.service.LibraryViews.RemovedSubscriptions;
import app.phumreader.library.service.LibraryViews.SeriesViewer;
import app.phumreader.library.service.LibraryViews.SubscriptionEntry;
import app.phumreader.library.service.LibraryViews.SubscriptionState;
import app.phumreader.library.service.LibraryViews.UnlockedEntry;
import app.phumreader.series.service.CatalogRefs.EpisodeInSeries;
import app.phumreader.series.service.CatalogRefs.SeriesRef;
import app.phumreader.series.service.CatalogService;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A reader's library (plan P3-12): subscriptions, followed creators, reading history (Continue
 * reading / Recently read) and unlocked episodes, with paging, sort options and remove with undo.
 */
@Service
public class LibraryService {

    /** At most this many series per remove or restore request. */
    public static final int MAX_BULK = 100;

    private final LibraryQueries queries;
    private final CatalogService catalog;
    private final Clock clock;

    public LibraryService(LibraryQueries queries, CatalogService catalog, Clock clock) {
        this.queries = queries;
        this.catalog = catalog;
        this.clock = clock;
    }

    // ---------- one series ----------

    @Transactional
    public SubscriptionState subscribe(CurrentUser user, String slug, boolean subscribed) {
        SeriesRef series = catalog.require(slug);
        if (subscribed) {
            queries.subscribe(user.id(), series.id(), now());
        } else {
            queries.unsubscribe(user.id(), series.id());
        }
        return new SubscriptionState(subscribed, queries.subscribers(series.id()));
    }

    @Transactional
    public FollowState follow(CurrentUser user, UUID creatorId, boolean following) {
        queries.creator(creatorId)
                .orElseThrow(
                        () -> ApiException.notFound("creator_not_found", "Creator not found."));
        if (following) {
            queries.follow(user.id(), creatorId, now());
        } else {
            queries.unfollow(user.id(), creatorId);
        }
        return new FollowState(following, queries.followers(creatorId));
    }

    /** The reader's state on a series page: subscribed, following, read marks, unlocks. */
    public SeriesViewer seriesState(CurrentUser user, String slug) {
        SeriesRef series = catalog.require(slug);
        var progress = queries.progress(user.id(), series.id());
        return new SeriesViewer(
                queries.isSubscribed(user.id(), series.id()),
                queries.isFollowing(user.id(), series.creatorId()),
                progress.map(LibraryQueries.ProgressRow::lastRead).orElse(0),
                progress.map(LibraryQueries.ProgressRow::episode).orElse(null),
                progress.map(p -> (double) p.progress()).orElse(null),
                queries.unlockedNumbers(user.id(), series.id()));
    }

    // ---------- lists ----------

    public CursorPage<HistoryEntry> history(
            CurrentUser user,
            LibraryOrder order,
            @Nullable String cursor,
            @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<HistoryRow> rows =
                queries.history(user.id(), order, readKey(cursor, "h", order, false), size + 1);
        Map<UUID, SeriesCard> cards = catalog.cards(ids(rows, HistoryRow::seriesId));
        return page(
                rows,
                size,
                r -> key("h", order, r.readAt(), r.seriesId(), r.title(), null),
                r -> {
                    SeriesCard card = cards.get(r.seriesId());
                    return card == null
                            ? null
                            : new HistoryEntry(
                                    card.slug(),
                                    r.episode(),
                                    r.progress(),
                                    r.lastRead(),
                                    r.readAt().toInstant(),
                                    card);
                });
    }

    public CursorPage<SubscriptionEntry> subscriptions(
            CurrentUser user,
            LibraryOrder order,
            @Nullable String cursor,
            @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<SubscriptionRow> rows =
                queries.subscriptions(
                        user.id(), order, readKey(cursor, "s", order, false), size + 1);
        Map<UUID, SeriesCard> cards = catalog.cards(ids(rows, SubscriptionRow::seriesId));
        return page(
                rows,
                size,
                r -> key("s", order, r.subscribedAt(), r.seriesId(), r.title(), null),
                r -> {
                    SeriesCard card = cards.get(r.seriesId());
                    return card == null
                            ? null
                            : new SubscriptionEntry(r.subscribedAt().toInstant(), card);
                });
    }

    public CursorPage<UnlockedEntry> unlocked(
            CurrentUser user,
            LibraryOrder order,
            @Nullable String cursor,
            @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<UnlockRow> rows =
                queries.unlocked(user.id(), order, readKey(cursor, "u", order, true), size + 1);
        Map<UUID, EpisodeInSeries> episodes =
                catalog.episodesByIds(ids(rows, UnlockRow::episodeId));
        return page(
                rows,
                size,
                r ->
                        key(
                                "u",
                                order,
                                r.unlockedAt(),
                                order == LibraryOrder.RECENT ? r.unlockId() : r.seriesId(),
                                r.title(),
                                r.number()),
                r -> {
                    EpisodeInSeries e = episodes.get(r.episodeId());
                    return e == null
                            ? null
                            : new UnlockedEntry(
                                    r.unlockedAt().toInstant(),
                                    e.series(),
                                    e.episode().summary(),
                                    r.coins());
                });
    }

    public CursorPage<FollowedCreator> follows(
            CurrentUser user, @Nullable String cursor, @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<FollowRow> rows =
                queries.follows(
                        user.id(), readKey(cursor, "f", LibraryOrder.RECENT, false), size + 1);
        return page(
                rows,
                size,
                r -> key("f", LibraryOrder.RECENT, r.followedAt(), r.creatorId(), null, null),
                r ->
                        new FollowedCreator(
                                r.creatorId(),
                                r.name(),
                                r.seriesCount(),
                                r.followedAt().toInstant()));
    }

    // ---------- remove with undo ----------

    @Transactional
    public RemovedSubscriptions removeSubscriptions(CurrentUser user, List<UUID> seriesIds) {
        return new RemovedSubscriptions(
                queries.removeSubscriptions(user.id(), seriesIds).stream()
                        .map(r ->
                                new RemovedSubscription(r.seriesId(), r.subscribedAt().toInstant()))
                        .toList());
    }

    /** Undo: subscribes again with the original dates (published series only). */
    @Transactional
    public void restoreSubscriptions(CurrentUser user, List<RemovedSubscription> items) {
        Map<UUID, SeriesCard> published =
                catalog.cards(items.stream().map(RemovedSubscription::seriesId).toList());
        for (RemovedSubscription item : items) {
            if (published.containsKey(item.seriesId())) {
                queries.subscribe(user.id(), item.seriesId(), utc(item.subscribedAt()));
            }
        }
    }

    @Transactional
    public RemovedHistory removeHistory(CurrentUser user, List<UUID> seriesIds) {
        return new RemovedHistory(
                queries.removeHistory(user.id(), seriesIds).stream()
                        .map(r ->
                                new RemovedHistoryEntry(
                                        r.seriesId(),
                                        r.episode(),
                                        (double) r.progress(),
                                        r.lastRead(),
                                        r.readAt().toInstant()))
                        .toList());
    }

    /** Undo: puts the history entries back (published series only). */
    @Transactional
    public void restoreHistory(CurrentUser user, List<RemovedHistoryEntry> items) {
        Map<UUID, SeriesCard> published =
                catalog.cards(items.stream().map(RemovedHistoryEntry::seriesId).toList());
        for (RemovedHistoryEntry item : items) {
            if (published.containsKey(item.seriesId())) {
                queries.restoreHistory(
                        user.id(),
                        item.seriesId(),
                        item.episode(),
                        item.progress().floatValue(),
                        Math.max(item.lastRead(), item.episode()),
                        utc(item.readAt()));
            }
        }
    }

    // ---------- paging helpers ----------

    /**
     * One page: {@code size + 1} rows came back when there is more. Rows whose series is no longer
     * published map to null and are left out (the cursor still moves past them).
     */
    private static <R, T> CursorPage<T> page(
            List<R> rows, int size, Function<R, String> cursorOf, Function<R, T> map) {
        List<R> pageRows = rows.size() > size ? rows.subList(0, size) : rows;
        List<T> items = new ArrayList<>();
        for (R row : pageRows) {
            T item = map.apply(row);
            if (item != null) {
                items.add(item);
            }
        }
        String next = rows.size() > size ? cursorOf.apply(pageRows.getLast()) : null;
        return new CursorPage<>(items, next);
    }

    /** Cursor text: list prefix, order, then the sort values of the last row. */
    private static String key(
            String list,
            LibraryOrder order,
            OffsetDateTime at,
            UUID id,
            @Nullable String title,
            @Nullable Integer number) {
        if (order == LibraryOrder.RECENT) {
            return Cursors.encode(list + "|r|" + at.toInstant() + "|" + id);
        }
        String lower = title == null ? "" : title.toLowerCase(Locale.ROOT);
        return Cursors.encode(
                list + "|t|" + id + "|" + (number == null ? "" : number) + "|" + lower);
    }

    private static @Nullable Key readKey(
            @Nullable String cursor, String list, LibraryOrder order, boolean withNumber) {
        String text = Cursors.decode(cursor);
        if (text == null) {
            return null;
        }
        try {
            if (order == LibraryOrder.RECENT) {
                String[] parts = text.split("\\|", 4);
                if (parts.length == 4 && parts[0].equals(list) && parts[1].equals("r")) {
                    return new Key(
                            utc(Instant.parse(parts[2])), UUID.fromString(parts[3]), null, null);
                }
            } else {
                String[] parts = text.split("\\|", 5);
                if (parts.length == 5 && parts[0].equals(list) && parts[1].equals("t")) {
                    Integer number = withNumber ? Integer.valueOf(parts[3]) : null;
                    return new Key(null, UUID.fromString(parts[2]), parts[4], number);
                }
            }
        } catch (IllegalArgumentException | DateTimeParseException ignored) {
            // falls through to the error below
        }
        throw ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
    }

    private static <R> List<UUID> ids(Collection<R> rows, Function<R, UUID> id) {
        return rows.stream().map(id).distinct().toList();
    }

    private OffsetDateTime now() {
        return utc(clock.instant());
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }
}
