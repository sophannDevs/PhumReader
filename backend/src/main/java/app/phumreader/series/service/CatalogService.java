package app.phumreader.series.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.config.AppProperties;
import app.phumreader.series.domain.SeriesOrder;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.repository.CatalogQueries;
import app.phumreader.series.repository.CatalogRows.EpisodeRow;
import app.phumreader.series.repository.CatalogRows.GenreRow;
import app.phumreader.series.repository.CatalogRows.RankingRow;
import app.phumreader.series.repository.CatalogRows.SeriesKey;
import app.phumreader.series.repository.SeriesRow;
import app.phumreader.series.service.CatalogViews.Badges;
import app.phumreader.series.service.CatalogViews.EpisodeAccess;
import app.phumreader.series.service.CatalogViews.EpisodeSummary;
import app.phumreader.series.service.CatalogViews.GenreItem;
import app.phumreader.series.service.CatalogViews.HeroSlide;
import app.phumreader.series.service.CatalogViews.HomeFeed;
import app.phumreader.series.service.CatalogViews.HomeRankings;
import app.phumreader.series.service.CatalogViews.RankingEntry;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import app.phumreader.series.service.CatalogViews.SeriesDetail;
import app.phumreader.series.service.CatalogViews.SeriesStats;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

/**
 * The public catalog: home feed, rankings, genres, series lists and pages, episode lists and the
 * PostgreSQL search stand-in (plan P3-06; Meilisearch replaces the search in P3-15).
 *
 * <p>Badges and access follow the real clock in Asia/Phnom_Penh. The home feed is kept in memory
 * for {@code phumreader.catalog.home-cache-ttl} (Redis takes over in Stage 1 step 3).
 */
@Service
public class CatalogService {

    /** Where readers are: "today", UP badges and episode dates use this zone. */
    public static final ZoneId ZONE = ZoneId.of("Asia/Phnom_Penh");

    static final int DAILY_PER_DAY = 6;
    static final int HOME_PER_GENRE = 12;
    static final int HOME_NOVELS = 6;
    static final int HOME_RANKING = 8;
    static final int CREATOR_COVERS = 3;
    static final int RELATED = 4;
    static final int SEARCH_DEFAULT = 8;
    static final int SEARCH_MAX = 20;
    static final int SEARCH_POPULAR = 6;

    /** A series keeps the NEW badge this long after launch. */
    static final Duration NEW_FOR = Duration.ofDays(30);

    /** UP badges need a release this recent. */
    static final Duration UP_FOR = Duration.ofDays(7);

    private final CatalogQueries queries;
    private final Clock clock;
    private final Duration homeCacheTtl;
    private final AtomicReference<CachedHome> cachedHome = new AtomicReference<>();

    public CatalogService(CatalogQueries queries, Clock clock, AppProperties properties) {
        this.queries = queries;
        this.clock = clock;
        this.homeCacheTtl = properties.catalog().homeCacheTtl();
    }

    /** Kinds of ranking ("comics", "novels"). */
    public enum RankingKind {
        COMICS,
        NOVELS
    }

    /** Episode list order. */
    public enum EpisodeOrder {
        OLDEST,
        NEWEST
    }

    // ---------- home ----------

    public HomeFeed home() {
        Instant now = clock.instant();
        Weekday today = Weekday.of(now.atZone(ZONE).getDayOfWeek());
        CachedHome cached = cachedHome.get();
        if (cached != null && cached.isFresh(now, today, homeCacheTtl)) {
            return cached.feed();
        }
        HomeFeed feed = buildHome(now, today);
        if (homeCacheTtl.isPositive()) {
            cachedHome.set(new CachedHome(now, today, feed));
        }
        return feed;
    }

    private HomeFeed buildHome(Instant now, Weekday today) {
        OffsetDateTime at = utc(now);
        Cards cards = new Cards(now, today);

        List<HeroSlide> hero =
                queries.heroSlides(at).stream()
                        .map(h ->
                                new HeroSlide(
                                        h.series().slug(),
                                        h.tag(),
                                        h.blurb(),
                                        cards.of(h.series())))
                        .toList();

        List<SeriesCard> scheduled = cards.of(queries.mostViewedPerDay(DAILY_PER_DAY, at));
        Map<String, List<SeriesCard>> daily = new LinkedHashMap<>();
        List<SeriesCard> upSeries =
                scheduled.stream()
                        .filter(c -> c.badges().up())
                        .sorted(Comparator.comparingLong(SeriesCard::views).reversed())
                        .toList();
        for (Weekday day : Weekday.values()) {
            List<SeriesCard> list = new ArrayList<>();
            scheduled.stream().filter(c -> c.updateDay() == day).forEach(list::add);
            for (SeriesCard up : upSeries) {
                if (list.size() >= DAILY_PER_DAY) {
                    break;
                }
                if (!list.contains(up)) {
                    list.add(up);
                }
            }
            daily.put(day.label(), List.copyOf(list));
        }

        List<String> genres = queries.genres().stream().map(GenreRow::name).toList();
        Map<String, List<SeriesCard>> byGenre = new LinkedHashMap<>();
        genres.forEach(g -> byGenre.put(g, new ArrayList<>()));
        for (SeriesRow row : queries.mostViewedPerGenre(HOME_PER_GENRE, at)) {
            byGenre.computeIfAbsent(row.genreName(), g -> new ArrayList<>()).add(cards.of(row));
        }
        byGenre.replaceAll((g, list) -> List.copyOf(list));

        HomeRankings rankings =
                new HomeRankings(
                        ranking(RankingKind.COMICS, 0, HOME_RANKING, cards, at),
                        ranking(RankingKind.NOVELS, 0, HOME_RANKING, cards, at));

        return new HomeFeed(
                today,
                hero,
                daily,
                rankings,
                genres,
                byGenre,
                cards.of(queries.mostViewed(SeriesType.NOVEL, HOME_NOVELS, at)),
                cards.of(queries.mostViewed(SeriesType.COMIC, CREATOR_COVERS, at)));
    }

    // ---------- rankings and genres ----------

    public CursorPage<RankingEntry> rankings(
            RankingKind kind, @Nullable String cursor, @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        Integer after = cursorNumber(cursor, "r");
        Instant now = clock.instant();
        List<RankingEntry> entries =
                ranking(
                        kind,
                        after == null ? 0 : after,
                        size + 1,
                        new Cards(now, today(now)),
                        utc(now));
        return page(entries, size, e -> Cursors.encode("r|" + e.rank()));
    }

    private List<RankingEntry> ranking(
            RankingKind kind, int after, int limit, Cards cards, OffsetDateTime at) {
        return queries.rankings(kind.name(), after, limit, at).stream()
                .map((RankingRow r) ->
                        new RankingEntry(r.position(), r.previousPosition(), cards.of(r.series())))
                .toList();
    }

    public List<GenreItem> genres() {
        return queries.genres().stream().map(CatalogService::genre).toList();
    }

    /** One genre by slug; 404 when there is none. */
    public GenreItem genre(String slug) {
        return queries.genre(slug)
                .map(CatalogService::genre)
                .orElseThrow(() -> ApiException.notFound("genre_not_found", "Genre not found."));
    }

    private static GenreItem genre(GenreRow g) {
        return new GenreItem(g.slug(), g.name(), g.seriesCount());
    }

    // ---------- series ----------

    /** Published series, optionally of one type and genre; 400 for an unknown genre. */
    public CursorPage<SeriesCard> series(
            @Nullable SeriesType type,
            @Nullable String genreSlug,
            SeriesOrder order,
            @Nullable String cursor,
            @Nullable Integer limit) {
        if (genreSlug != null && queries.genre(genreSlug).isEmpty()) {
            throw ApiException.invalidField("genre", "unknown_genre", "There is no such genre.");
        }
        int size = Cursors.limit(limit);
        SeriesKey after = seriesCursor(cursor, order);
        Instant now = clock.instant();
        Cards cards = new Cards(now, today(now));
        List<SeriesRow> rows =
                queries.seriesPage(type, genreSlug, order, after, size + 1, utc(now));
        CursorPage<SeriesRow> page = page(rows, size, r -> seriesCursorOf(r, order));
        return new CursorPage<>(cards.of(page.items()), page.nextCursor());
    }

    /** The series page; 404 when the slug is unknown or the series is not published. */
    public SeriesDetail series(String slug) {
        Instant now = clock.instant();
        OffsetDateTime at = utc(now);
        Cards cards = new Cards(now, today(now));
        SeriesRow row = queries.seriesBySlug(slug, at).orElseThrow(CatalogService::seriesNotFound);
        return new SeriesDetail(
                cards.of(row),
                row.summary(),
                new SeriesStats(row.subscribers(), queries.visibleComments(row.id())),
                cards.of(queries.related(row.id(), RELATED, at)),
                queries.publishedSeriesOfCreator(row.creatorId()));
    }

    /** Released episodes of a series, oldest or newest first; 404 for an unknown series. */
    public CursorPage<EpisodeSummary> episodes(
            String slug, EpisodeOrder order, @Nullable String cursor, @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        boolean newestFirst = order == EpisodeOrder.NEWEST;
        String prefix = newestFirst ? "en" : "eo";
        Integer after = cursorNumber(cursor, prefix);
        Instant now = clock.instant();
        OffsetDateTime at = utc(now);
        SeriesRow series =
                queries.seriesBySlug(slug, at).orElseThrow(CatalogService::seriesNotFound);
        List<EpisodeSummary> episodes =
                queries.episodes(series.id(), newestFirst, after, size + 1, at).stream()
                        .map(e -> episode(e, series, now))
                        .toList();
        return page(episodes, size, e -> Cursors.encode(prefix + "|" + e.n()));
    }

    /**
     * Search by title, creator or genre (PostgreSQL stand-in for P3-15). An empty query returns the
     * most viewed series ("Popular now").
     */
    public List<SeriesCard> search(@Nullable String query, @Nullable Integer limit) {
        Instant now = clock.instant();
        OffsetDateTime at = utc(now);
        Cards cards = new Cards(now, today(now));
        String q = query == null ? "" : query.strip().toLowerCase(Locale.ROOT);
        if (q.isEmpty()) {
            return cards.of(queries.mostViewed(null, SEARCH_POPULAR, at));
        }
        int size = limit == null ? SEARCH_DEFAULT : Math.clamp(limit, 1, SEARCH_MAX);
        return cards.of(queries.search(q, size, at));
    }

    // ---------- rules ----------

    /** An episode as listed: access, its free date and the UP mark at {@code now}. */
    static EpisodeSummary episode(EpisodeRow e, SeriesRow series, Instant now) {
        boolean fastPass = e.freeAt() != null && e.freeAt().toInstant().isAfter(now);
        OffsetDateTime freeFrom = e.freeAt() != null ? e.freeAt() : e.publishedAt();
        boolean up =
                !fastPass
                        && series.latestFreeNumber() != null
                        && e.number() == series.latestFreeNumber()
                        && recent(freeFrom, now, UP_FOR);
        return new EpisodeSummary(
                e.number(),
                e.title(),
                LocalDate.ofInstant(freeFrom.toInstant(), ZONE),
                e.likes(),
                e.thumbnailUrl(),
                fastPass ? EpisodeAccess.FAST_PASS : EpisodeAccess.FREE,
                up,
                fastPass ? e.priceCoins() : null);
    }

    /** Maps rows to cards with the badges as of one moment. */
    private record Cards(Instant now, Weekday today) {

        SeriesCard of(SeriesRow r) {
            boolean up =
                    r.status() == SeriesStatus.ONGOING
                            && r.updateDay() == today.day()
                            && r.latestRelease() != null
                            && recent(r.latestRelease(), now, UP_FOR);
            boolean isNew = recent(r.launchedAt(), now, NEW_FOR);
            return new SeriesCard(
                    r.id(),
                    r.slug(),
                    r.title(),
                    r.type(),
                    r.genreName(),
                    r.creatorName(),
                    r.coverUrl(),
                    r.views(),
                    r.likes(),
                    r.freeEpisodes(),
                    r.fastPassEpisodes(),
                    r.totalEpisodes(),
                    r.updateDay() == null ? null : Weekday.of(r.updateDay()),
                    r.status(),
                    r.languages(),
                    r.ageRating(),
                    new Badges(up, isNew));
        }

        List<SeriesCard> of(List<SeriesRow> rows) {
            return rows.stream().map(this::of).toList();
        }
    }

    /** {@code at} lies in the {@code window} before {@code now} (not in the future). */
    private static boolean recent(OffsetDateTime at, Instant now, Duration window) {
        Instant instant = at.toInstant();
        return !instant.isAfter(now) && instant.isAfter(now.minus(window));
    }

    // ---------- paging helpers ----------

    private static <T> CursorPage<T> page(List<T> rows, int size, Function<T, String> cursorOf) {
        if (rows.size() <= size) {
            return new CursorPage<>(rows, null);
        }
        List<T> items = rows.subList(0, size);
        return new CursorPage<>(items, cursorOf.apply(items.getLast()));
    }

    /** Reads a cursor "prefix|number"; null for the first page. */
    private static @Nullable Integer cursorNumber(@Nullable String cursor, String prefix) {
        String key = Cursors.decode(cursor);
        if (key == null) {
            return null;
        }
        String[] parts = key.split("\\|", -1);
        try {
            if (parts.length == 2 && parts[0].equals(prefix)) {
                return Integer.parseInt(parts[1]);
            }
        } catch (NumberFormatException ignored) {
            // falls through to the error below
        }
        throw invalidCursor();
    }

    private static String seriesCursorOf(SeriesRow r, SeriesOrder order) {
        return Cursors.encode(
                order == SeriesOrder.POPULAR
                        ? "sp|" + r.views() + "|" + r.id()
                        : "sn|" + r.launchedAt().toInstant() + "|" + r.id());
    }

    private static @Nullable SeriesKey seriesCursor(@Nullable String cursor, SeriesOrder order) {
        String key = Cursors.decode(cursor);
        if (key == null) {
            return null;
        }
        String[] parts = key.split("\\|", -1);
        String prefix = order == SeriesOrder.POPULAR ? "sp" : "sn";
        try {
            if (parts.length == 3 && parts[0].equals(prefix)) {
                UUID id = UUID.fromString(parts[2]);
                return order == SeriesOrder.POPULAR
                        ? new SeriesKey(Long.parseLong(parts[1]), null, id)
                        : new SeriesKey(0, utc(Instant.parse(parts[1])), id);
            }
        } catch (IllegalArgumentException | DateTimeParseException ignored) {
            // falls through to the error below
        }
        throw invalidCursor();
    }

    private static ApiException invalidCursor() {
        return ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
    }

    private static ApiException seriesNotFound() {
        return ApiException.notFound("series_not_found", "Series not found.");
    }

    private static Weekday today(Instant now) {
        return Weekday.of(now.atZone(ZONE).getDayOfWeek());
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant.atOffset(ZoneOffset.UTC);
    }

    /** The last home feed built, for one day of the week. */
    private record CachedHome(Instant builtAt, Weekday today, HomeFeed feed) {

        boolean isFresh(Instant now, Weekday day, Duration ttl) {
            return ttl.isPositive()
                    && today == day
                    && !now.isBefore(builtAt)
                    && now.isBefore(builtAt.plus(ttl));
        }
    }
}
