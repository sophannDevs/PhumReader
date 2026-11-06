package app.phumreader.series.repository;

import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.SeriesOrder;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.repository.CatalogRows.EpisodeRow;
import app.phumreader.series.repository.CatalogRows.GenreRow;
import app.phumreader.series.repository.CatalogRows.HeroRow;
import app.phumreader.series.repository.CatalogRows.RankingRow;
import app.phumreader.series.repository.CatalogRows.SeriesKey;
import java.sql.Array;
import java.sql.SQLException;
import java.time.DayOfWeek;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Read-only catalog queries (plain SQL). Only published series are ever returned, and only episodes
 * that are published and released by {@code now}; every query takes {@code now} so tests can pin
 * the clock.
 */
@Repository
public class CatalogQueries {

    /** Published series; the queries below narrow, order and limit it. */
    private static final String PUBLISHED = "select * from series where visibility = 'PUBLISHED'";

    /**
     * Series card columns for the series rows selected by {@code %s} (alias {@code c}), with genre,
     * creator and episode counts. The outer query must order the rows again.
     */
    private static final String CARDS =
            """
            select c.id, c.slug, c.title, c.type, c.summary, g.slug as genre_slug,
                   g.name as genre_name, c.creator_id, p.pen_name, c.cover_url, c.view_count,
                   c.like_count, c.subscriber_count, c.update_day, c.status, c.languages,
                   c.age_rating, coalesce(c.launched_at, c.created_at) as launched_at,
                   e.free_episodes, e.fast_pass_episodes, e.total_episodes,
                   e.latest_free_number, e.latest_release
            from (%s) c
            join genres g on g.id = c.genre_id
            join creator_profiles p on p.user_id = c.creator_id
            cross join lateral (
                select count(*) filter (where ep.free_at is null or ep.free_at <= :now)
                           as free_episodes,
                       count(*) filter (where ep.free_at > :now) as fast_pass_episodes,
                       count(*) as total_episodes,
                       max(ep.number) filter (where ep.free_at is null or ep.free_at <= :now)
                           as latest_free_number,
                       greatest(max(ep.published_at),
                                max(ep.free_at) filter (where ep.free_at <= :now))
                           as latest_release
                from episodes ep
                where ep.series_id = c.id and ep.status = 'PUBLISHED' and ep.published_at <= :now
            ) e
            """;

    private static final RowMapper<SeriesRow> SERIES =
            (rs, n) ->
                    new SeriesRow(
                            rs.getObject("id", UUID.class),
                            rs.getString("slug"),
                            rs.getString("title"),
                            SeriesType.valueOf(rs.getString("type")),
                            rs.getString("summary"),
                            rs.getString("genre_slug"),
                            rs.getString("genre_name"),
                            rs.getObject("creator_id", UUID.class),
                            rs.getString("pen_name"),
                            rs.getString("cover_url"),
                            rs.getLong("view_count"),
                            rs.getLong("like_count"),
                            rs.getLong("subscriber_count"),
                            day(rs.getString("update_day")),
                            SeriesStatus.valueOf(rs.getString("status")),
                            languages(rs.getArray("languages")),
                            AgeRating.valueOf(rs.getString("age_rating")),
                            rs.getObject("launched_at", OffsetDateTime.class),
                            rs.getInt("free_episodes"),
                            rs.getInt("fast_pass_episodes"),
                            rs.getInt("total_episodes"),
                            rs.getObject("latest_free_number", Integer.class),
                            rs.getObject("latest_release", OffsetDateTime.class));

    private static final RowMapper<EpisodeRow> EPISODE =
            (rs, n) ->
                    new EpisodeRow(
                            rs.getObject("id", UUID.class),
                            rs.getObject("series_id", UUID.class),
                            rs.getInt("number"),
                            rs.getString("title"),
                            rs.getObject("published_at", OffsetDateTime.class),
                            rs.getObject("free_at", OffsetDateTime.class),
                            rs.getObject("price_coins", Integer.class),
                            rs.getString("thumbnail_url"),
                            rs.getLong("like_count"),
                            rs.getBoolean("comments_enabled"),
                            rs.getString("creator_note"));

    /** Columns of {@link #EPISODE}; only released episodes (published, release time passed). */
    private static final String EPISODE_COLUMNS =
            "select id, series_id, number, title, published_at, free_at, price_coins,"
                    + " thumbnail_url, like_count, comments_enabled, creator_note from episodes"
                    + " where status = 'PUBLISHED' and published_at <= :now";

    private final JdbcClient jdbc;

    public CatalogQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- single series ----------

    public Optional<SeriesRow> seriesBySlug(String slug, OffsetDateTime now) {
        return jdbc.sql(cards(PUBLISHED + " and slug = :slug"))
                .param("slug", slug)
                .param("now", now)
                .query(SERIES)
                .optional();
    }

    /** Up to {@code limit} other published series in the same genre, most viewed first. */
    public List<SeriesRow> related(UUID seriesId, int limit, OffsetDateTime now) {
        String related =
                PUBLISHED
                        + " and genre_id = (select genre_id from series where id = :id)"
                        + " and id <> :id order by view_count desc, id limit :limit";
        return jdbc.sql(cards(related) + " order by c.view_count desc, c.id")
                .param("id", seriesId)
                .param("limit", limit)
                .param("now", now)
                .query(SERIES)
                .list();
    }

    public int publishedSeriesOfCreator(UUID creatorId) {
        return jdbc.sql(
                        "select count(*) from series where creator_id = :id"
                                + " and visibility = 'PUBLISHED'")
                .param("id", creatorId)
                .query(Integer.class)
                .single();
    }

    /** Visible comments on the series page and on all its episodes. */
    public long visibleComments(UUID seriesId) {
        return jdbc.sql(
                        "select count(*) from comments where series_id = :id"
                                + " and status = 'VISIBLE'")
                .param("id", seriesId)
                .query(Long.class)
                .single();
    }

    // ---------- home ----------

    public List<HeroRow> heroSlides(OffsetDateTime now) {
        String featured = PUBLISHED + " and id in (select series_id from featured_slides)";
        return jdbc.sql(
                        "select f.tag, f.blurb, x.* from featured_slides f join ("
                                + cards(featured)
                                + ") x on x.id = f.series_id order by f.position")
                .param("now", now)
                .query((rs, n) ->
                        new HeroRow(
                                rs.getString("tag"), rs.getString("blurb"), SERIES.mapRow(rs, n)))
                .list();
    }

    /** The {@code perDay} most viewed series of each update day (series without a day left out). */
    public List<SeriesRow> mostViewedPerDay(int perDay, OffsetDateTime now) {
        String ranked =
                "select * from (select s.*, row_number() over (partition by s.update_day"
                        + " order by s.view_count desc, s.id) as place from series s"
                        + " where s.visibility = 'PUBLISHED' and s.update_day is not null) d"
                        + " where d.place <= :per";
        return jdbc.sql(cards(ranked) + " order by c.view_count desc, c.id")
                .param("per", perDay)
                .param("now", now)
                .query(SERIES)
                .list();
    }

    /** The {@code perGenre} most viewed series of each genre, in genre order. */
    public List<SeriesRow> mostViewedPerGenre(int perGenre, OffsetDateTime now) {
        String ranked =
                "select * from (select s.*, row_number() over (partition by s.genre_id"
                        + " order by s.view_count desc, s.id) as place from series s"
                        + " where s.visibility = 'PUBLISHED') d where d.place <= :per";
        return jdbc.sql(cards(ranked) + " order by g.position, c.view_count desc, c.id")
                .param("per", perGenre)
                .param("now", now)
                .query(SERIES)
                .list();
    }

    /** Most viewed series, of one type or of both when {@code type} is null. */
    public List<SeriesRow> mostViewed(@Nullable SeriesType type, int limit, OffsetDateTime now) {
        String filter =
                PUBLISHED
                        + (type == null ? "" : " and type = :type")
                        + " order by view_count desc, id limit :limit";
        JdbcClient.StatementSpec spec =
                jdbc.sql(cards(filter) + " order by c.view_count desc, c.id")
                        .param("limit", limit)
                        .param("now", now);
        if (type != null) {
            spec = spec.param("type", type.name());
        }
        return spec.query(SERIES).list();
    }

    // ---------- rankings and genres ----------

    /** Ranking places after {@code afterPosition}, skipping series that are not published. */
    public List<RankingRow> rankings(
            String kind, int afterPosition, int limit, OffsetDateTime now) {
        String ranked =
                "select s.* from series s join rankings r on r.series_id = s.id"
                        + " where r.kind = :kind and r.position > :after"
                        + " and s.visibility = 'PUBLISHED' order by r.position limit :limit";
        return jdbc.sql(
                        "select r.position, r.previous_position, x.* from rankings r join ("
                                + cards(ranked)
                                + ") x on x.id = r.series_id where r.kind = :kind"
                                + " order by r.position")
                .param("kind", kind)
                .param("after", afterPosition)
                .param("limit", limit)
                .param("now", now)
                .query((rs, n) ->
                        new RankingRow(
                                rs.getInt("position"),
                                rs.getObject("previous_position", Integer.class),
                                SERIES.mapRow(rs, n)))
                .list();
    }

    public List<GenreRow> genres() {
        return jdbc.sql(genreSql("") + " order by g.position").query(GENRE).list();
    }

    public Optional<GenreRow> genre(String slug) {
        return jdbc.sql(genreSql(" where g.slug = :slug"))
                .param("slug", slug)
                .query(GENRE)
                .optional();
    }

    // ---------- series lists and search ----------

    /**
     * One page of published series, optionally of one type and one genre (by slug). Pass the last
     * row of the previous page as {@code after}.
     */
    public List<SeriesRow> seriesPage(
            @Nullable SeriesType type,
            @Nullable String genreSlug,
            SeriesOrder order,
            @Nullable SeriesKey after,
            int limit,
            OffsetDateTime now) {
        Map<String, Object> params = new LinkedHashMap<>();
        StringBuilder filter = new StringBuilder(PUBLISHED);
        if (type != null) {
            filter.append(" and type = :type");
            params.put("type", type.name());
        }
        if (genreSlug != null) {
            filter.append(" and genre_id = (select id from genres where slug = :genre)");
            params.put("genre", genreSlug);
        }
        String sortKey;
        if (order == SeriesOrder.POPULAR) {
            sortKey = "view_count desc, id";
            if (after != null) {
                filter.append(" and (view_count < :afterValue")
                        .append(" or (view_count = :afterValue and id > :afterId))");
                params.put("afterValue", after.views());
            }
        } else {
            sortKey = "coalesce(launched_at, created_at) desc, id";
            if (after != null) {
                filter.append(" and (coalesce(launched_at, created_at) < :afterValue")
                        .append(" or (coalesce(launched_at, created_at) = :afterValue")
                        .append(" and id > :afterId))");
                params.put("afterValue", after.launchedAt());
            }
        }
        if (after != null) {
            params.put("afterId", after.id());
        }
        filter.append(" order by ").append(sortKey).append(" limit :limit");
        params.put("limit", limit);
        params.put("now", now);
        String outerSort =
                order == SeriesOrder.POPULAR
                        ? "c.view_count desc, c.id"
                        : "coalesce(c.launched_at, c.created_at) desc, c.id";
        return jdbc.sql(cards(filter.toString()) + " order by " + outerSort)
                .params(params)
                .query(SERIES)
                .list();
    }

    /**
     * Published series whose title, creator or genre contains {@code query} (any case). Titles that
     * start with it come first, then the most viewed.
     */
    public List<SeriesRow> search(String query, int limit, OffsetDateTime now) {
        String matches =
                "select s.* from series s join genres g on g.id = s.genre_id"
                        + " join creator_profiles p on p.user_id = s.creator_id"
                        + " where s.visibility = 'PUBLISHED'"
                        + " and (strpos(lower(s.title), :q) > 0 or strpos(lower(p.pen_name), :q) > 0"
                        + " or strpos(lower(g.name), :q) > 0)"
                        + " order by (strpos(lower(s.title), :q) = 1) desc, s.view_count desc, s.id"
                        + " limit :limit";
        return jdbc.sql(
                        cards(matches)
                                + " order by (strpos(lower(c.title), :q) = 1) desc,"
                                + " c.view_count desc, c.id")
                .param("q", query)
                .param("limit", limit)
                .param("now", now)
                .query(SERIES)
                .list();
    }

    // ---------- episodes ----------

    /**
     * One page of a series' released episodes by number, oldest or newest first. Pass the last
     * number of the previous page as {@code afterNumber}.
     */
    public List<EpisodeRow> episodes(
            UUID seriesId,
            boolean newestFirst,
            @Nullable Integer afterNumber,
            int limit,
            OffsetDateTime now) {
        String sql =
                EPISODE_COLUMNS
                        + " and series_id = :id"
                        + (afterNumber == null
                                ? ""
                                : newestFirst ? " and number < :after" : " and number > :after")
                        + " order by number "
                        + (newestFirst ? "desc" : "asc")
                        + " limit :limit";
        JdbcClient.StatementSpec spec =
                jdbc.sql(sql).param("id", seriesId).param("now", now).param("limit", limit);
        if (afterNumber != null) {
            spec = spec.param("after", afterNumber);
        }
        return spec.query(EPISODE).list();
    }

    /** One released episode by number. */
    public Optional<EpisodeRow> episode(UUID seriesId, int number, OffsetDateTime now) {
        return jdbc.sql(EPISODE_COLUMNS + " and series_id = :id and number = :n")
                .param("id", seriesId)
                .param("n", number)
                .param("now", now)
                .query(EPISODE)
                .optional();
    }

    /** The released episode just before or just after {@code number}. */
    public Optional<EpisodeRow> neighbour(
            UUID seriesId, int number, boolean before, OffsetDateTime now) {
        String sql =
                EPISODE_COLUMNS
                        + " and series_id = :id"
                        + (before
                                ? " and number < :n order by number desc"
                                : " and number > :n order by number")
                        + " limit 1";
        return jdbc.sql(sql)
                .param("id", seriesId)
                .param("n", number)
                .param("now", now)
                .query(EPISODE)
                .optional();
    }

    /** Released episodes by id (any series). */
    public List<EpisodeRow> episodesByIds(Collection<UUID> ids, OffsetDateTime now) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(EPISODE_COLUMNS + " and id in (:ids)")
                .param("ids", List.copyOf(ids))
                .param("now", now)
                .query(EPISODE)
                .list();
    }

    /** Published series by id. */
    public List<SeriesRow> seriesByIds(Collection<UUID> ids, OffsetDateTime now) {
        if (ids.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(cards(PUBLISHED + " and id in (:ids)"))
                .param("ids", List.copyOf(ids))
                .param("now", now)
                .query(SERIES)
                .list();
    }

    // ---------- helpers ----------

    private static final RowMapper<GenreRow> GENRE =
            (rs, n) ->
                    new GenreRow(
                            rs.getString("slug"), rs.getString("name"), rs.getLong("series_count"));

    private static String genreSql(String where) {
        return "select g.slug, g.name, count(s.id) as series_count from genres g"
                + " left join series s on s.genre_id = g.id and s.visibility = 'PUBLISHED'"
                + where
                + " group by g.id, g.slug, g.name, g.position";
    }

    private static String cards(String seriesRows) {
        return CARDS.formatted(seriesRows);
    }

    private static @Nullable DayOfWeek day(@Nullable String value) {
        return value == null ? null : DayOfWeek.valueOf(value);
    }

    private static List<String> languages(Array array) throws SQLException {
        return List.of((String[]) array.getArray());
    }
}
