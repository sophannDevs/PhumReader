package app.phumreader.series.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.common.store.InMemoryShortLivedStore;
import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.config.AppProperties;
import app.phumreader.search.domain.SearchFilter;
import app.phumreader.search.service.SearchDoc;
import app.phumreader.search.service.SearchIndex;
import app.phumreader.series.domain.SeriesOrder;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.repository.CatalogQueries;
import app.phumreader.series.repository.CatalogRows.EpisodeRow;
import app.phumreader.series.repository.CatalogRows.GenreRow;
import app.phumreader.series.repository.CatalogRows.RankingRow;
import app.phumreader.series.repository.CatalogRows.SeriesKey;
import app.phumreader.series.repository.SeriesRow;
import app.phumreader.series.service.CatalogRefs.EpisodeInSeries;
import app.phumreader.series.service.CatalogRefs.EpisodeRef;
import app.phumreader.series.service.CatalogRefs.SeriesRef;
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
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

/**
 * The public catalog: home feed, rankings, genres, series lists and pages, episode lists and the
 * PostgreSQL search stand-in (plan P3-06; Meilisearch replaces the search in P3-15).
 *
 * <p>Badges and access follow the real clock in Asia/Phnom_Penh. The home feed is kept for {@code
 * phumreader.catalog.home-cache-ttl} in the short-lived store (Redis when {@code REDIS_URL} is set,
 * so every API instance serves the same feed and a publish clears it for all of them; otherwise
 * this instance's memory). The cache is only a speed-up: if it cannot be read or written, the feed
 * is built from the database.
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
    private static final Logger log = LoggerFactory.getLogger(CatalogService.class);

    static final int SEARCH_DEFAULT = 8;
    static final int SEARCH_MAX = 20;
    static final int SEARCH_POPULAR = 6;
    static final int SEARCH_SUGGESTIONS = 6;

    /** A series keeps the NEW badge this long after launch. */
    static final Duration NEW_FOR = Duration.ofDays(30);

    /** UP badges need a release this recent. */
    static final Duration UP_FOR = Duration.ofDays(7);

    private final CatalogQueries queries;
    private final Clock clock;
    private final Duration homeCacheTtl;
    private final ShortLivedStore cache;
    private final JsonMapper json = JsonMapper.builder().build();

    private final ObjectProvider<SearchIndex> searchIndex;

    @Autowired
    public CatalogService(
            CatalogQueries queries,
            Clock clock,
            AppProperties properties,
            ObjectProvider<SearchIndex> searchIndex,
            ShortLivedStore cache) {
        this.queries = queries;
        this.cache = cache;
        this.clock = clock;
        this.homeCacheTtl = properties.catalog().homeCacheTtl();
        this.searchIndex = searchIndex;
    }

    /** Without a search index: search uses PostgreSQL. */
    public CatalogService(CatalogQueries queries, Clock clock, AppProperties properties) {
        this(queries, clock, properties, null, new InMemoryShortLivedStore(clock));
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

    /** Forgets the cached home feed (every day's copy), so a publish shows on the next visit. */
    public void refreshHome() {
        for (Weekday day : Weekday.values()) {
            try {
                cache.remove(homeKey(day));
            } catch (RuntimeException ex) {
                log.warn("Could not clear the cached home feed", ex);
            }
        }
    }

    public HomeFeed home() {
        Instant now = clock.instant();
        Weekday today = Weekday.of(now.atZone(ZONE).getDayOfWeek());
        if (!homeCacheTtl.isPositive()) {
            return buildHome(now, today);
        }
        HomeFeed cached = readCachedHome(today);
        if (cached != null) {
            return cached;
        }
        HomeFeed feed = buildHome(now, today);
        try {
            cache.put(homeKey(today), json.writeValueAsString(feed), now.plus(homeCacheTtl));
        } catch (RuntimeException ex) {
            log.warn("Could not cache the home feed", ex);
        }
        return feed;
    }

    private @Nullable HomeFeed readCachedHome(Weekday today) {
        try {
            Optional<String> text = cache.get(homeKey(today));
            return text.isPresent() ? json.readValue(text.get(), HomeFeed.class) : null;
        } catch (RuntimeException ex) {
            // Redis down, or a copy written by an older version of the app: build it again.
            log.warn("Could not read the cached home feed", ex);
            return null;
        }
    }

    /** One copy per day of the week, so the feed changes at midnight in Phnom Penh. */
    private static String homeKey(Weekday day) {
        return "cache:home:" + day.name();
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
                row.creatorId(),
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
                        .map(e -> episode(e, series.latestFreeNumber(), now))
                        .toList();
        return page(episodes, size, e -> Cursors.encode(prefix + "|" + e.n()));
    }

    // ---------- lookups for other features (reading, library, comments) ----------

    /** A published series by slug, with its card as of now. */
    public Optional<SeriesRef> find(String slug) {
        Instant now = clock.instant();
        Cards cards = new Cards(now, today(now));
        return queries.seriesBySlug(slug, utc(now)).map(row -> ref(row, cards));
    }

    /** A published series by slug; 404 {@code series_not_found} when there is none. */
    public SeriesRef require(String slug) {
        return find(slug).orElseThrow(CatalogService::seriesNotFound);
    }

    /** Cards of the published series among {@code seriesIds} (others are left out). */
    public Map<UUID, SeriesCard> cards(Collection<UUID> seriesIds) {
        Instant now = clock.instant();
        Cards cards = new Cards(now, today(now));
        Map<UUID, SeriesCard> result = new LinkedHashMap<>();
        for (SeriesRow row : queries.seriesByIds(Set.copyOf(seriesIds), utc(now))) {
            result.put(row.id(), cards.of(row));
        }
        return result;
    }

    /** Cards of all of a creator's series, drafts and hidden ones too, most viewed first. */
    public List<SeriesCard> creatorCards(UUID creatorId) {
        Instant now = clock.instant();
        return new Cards(now, today(now)).of(queries.seriesOfCreator(creatorId, utc(now)));
    }

    /** A released episode of the series; 404 {@code episode_not_found} when there is none. */
    public EpisodeRef requireEpisode(SeriesRef series, int number) {
        Instant now = clock.instant();
        return queries.episode(series.id(), number, utc(now))
                .map(e -> episodeRef(e, series.latestFreeNumber(), now))
                .orElseThrow(
                        () -> ApiException.notFound("episode_not_found", "Episode not found."));
    }

    /** The released episode just before ({@code before}) or after {@code number}. */
    public Optional<EpisodeRef> neighbour(SeriesRef series, int number, boolean before) {
        Instant now = clock.instant();
        return queries.neighbour(series.id(), number, before, utc(now))
                .map(e -> episodeRef(e, series.latestFreeNumber(), now));
    }

    /** Released episodes of published series by episode id, each with its series' card. */
    public Map<UUID, EpisodeInSeries> episodesByIds(Collection<UUID> episodeIds) {
        Instant now = clock.instant();
        OffsetDateTime at = utc(now);
        Cards cards = new Cards(now, today(now));
        List<EpisodeRow> rows = queries.episodesByIds(Set.copyOf(episodeIds), at);
        Map<UUID, SeriesRow> series = new LinkedHashMap<>();
        queries.seriesByIds(rows.stream().map(EpisodeRow::seriesId).collect(Collectors.toSet()), at)
                .forEach(s -> series.put(s.id(), s));
        Map<UUID, EpisodeInSeries> result = new LinkedHashMap<>();
        for (EpisodeRow row : rows) {
            SeriesRow s = series.get(row.seriesId());
            if (s != null) {
                result.put(
                        row.id(),
                        new EpisodeInSeries(
                                cards.of(s), episodeRef(row, s.latestFreeNumber(), now)));
            }
        }
        return result;
    }

    private static SeriesRef ref(SeriesRow row, Cards cards) {
        return new SeriesRef(
                row.id(),
                row.slug(),
                row.title(),
                row.type(),
                row.creatorId(),
                cards.of(row),
                row.latestFreeNumber());
    }

    private static EpisodeRef episodeRef(
            EpisodeRow e, @Nullable Integer latestFreeNumber, Instant now) {
        return new EpisodeRef(
                e.id(),
                e.seriesId(),
                e.number(),
                episode(e, latestFreeNumber, now),
                e.commentsEnabled(),
                e.creatorNote());
    }

    /**
     * Search by title, creator or genre (Meilisearch when configured, PostgreSQL otherwise). An
     * empty query returns the most viewed series ("Popular now").
     */
    public List<SeriesCard> search(@Nullable String query, @Nullable Integer limit) {
        return search(query, SearchFilter.NONE, limit);
    }

    /**
     * Search narrowed by type, genre and status and ordered by relevance, views or launch date. An
     * empty query with no filter returns the most viewed series; an empty query with a filter lists
     * the matching series (browsing).
     */
    public List<SeriesCard> search(
            @Nullable String query, SearchFilter filter, @Nullable Integer limit) {
        Instant now = clock.instant();
        OffsetDateTime at = utc(now);
        Cards cards = new Cards(now, today(now));
        String q = query == null ? "" : query.strip().toLowerCase(Locale.ROOT);
        if (q.isEmpty() && filter.isPlain()) {
            return cards.of(queries.mostViewed(null, SEARCH_POPULAR, at));
        }
        int size = limit == null ? SEARCH_DEFAULT : Math.clamp(limit, 1, SEARCH_MAX);
        SearchIndex index = searchIndex == null ? null : searchIndex.getIfAvailable();
        if (index != null) {
            try {
                List<UUID> ids = index.search(q, filter, size);
                return cards.of(queries.seriesByIds(ids, at));
            } catch (RuntimeException e) {
                log.warn("Search index unavailable, using PostgreSQL: {}", e.toString());
            }
        }
        return cards.of(queries.search(q, filter, size, at));
    }

    /** Up to 6 series titles that match what the reader has typed so far (search-as-you-type). */
    public List<String> suggestions(@Nullable String query) {
        return search(query, SearchFilter.NONE, SEARCH_SUGGESTIONS).stream()
                .map(SeriesCard::title)
                .distinct()
                .toList();
    }

    /** Published series for the search index: all of them, or just these ids. */
    public List<SearchDoc> searchDocuments(@Nullable Collection<UUID> ids) {
        return queries.searchRows(ids).stream()
                .map(r ->
                        new SearchDoc(
                                r.id(),
                                r.title(),
                                r.penName(),
                                r.genre(),
                                r.genreSlug(),
                                r.type(),
                                r.status(),
                                r.views(),
                                r.launched()))
                .toList();
    }

    // ---------- rules ----------

    /** An episode as listed: access, its free date and the UP mark at {@code now}. */
    static EpisodeSummary episode(EpisodeRow e, @Nullable Integer latestFreeNumber, Instant now) {
        boolean fastPass = e.freeAt() != null && e.freeAt().toInstant().isAfter(now);
        OffsetDateTime freeFrom = e.freeAt() != null ? e.freeAt() : e.publishedAt();
        boolean up =
                !fastPass
                        && latestFreeNumber != null
                        && e.number() == latestFreeNumber
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
}
