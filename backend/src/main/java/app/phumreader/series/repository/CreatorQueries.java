package app.phumreader.series.repository;

import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.domain.SeriesVisibility;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Numbers for the creator dashboard (plan P3-14, stats only). */
@Repository
public class CreatorQueries {

    /**
     * One series' numbers.
     *
     * @param comments visible comments on the series page and its episodes
     * @param unlocks Fast Pass episodes bought with coins
     * @param earnedCoins coins earned from those unlocks
     */
    public record SeriesNumbers(
            UUID seriesId,
            SeriesVisibility visibility,
            long subscribers,
            long comments,
            long unlocks,
            long earnedCoins) {}

    /**
     * A series as its creator edits it (no counters).
     *
     * @param updateDays in week order
     * @param releaseHour 0-23 in Asia/Phnom_Penh
     * @param fastPass the series' Fast Pass switch (defaults for new episodes)
     * @param fastPassAhead 1-5
     * @param breakMessage only while the status is HIATUS
     * @param launched the series went live once ({@code launched_at} is set)
     */
    public record EditRow(
            UUID id,
            UUID creatorId,
            String slug,
            SeriesType type,
            String title,
            String summary,
            String genreSlug,
            @Nullable String secondGenreSlug,
            List<String> languages,
            AgeRating ageRating,
            SeriesStatus status,
            SeriesVisibility visibility,
            List<DayOfWeek> updateDays,
            @Nullable Integer releaseHour,
            boolean fastPass,
            int fastPassAhead,
            boolean commentsEnabled,
            @Nullable String breakMessage,
            @Nullable String coverUrl,
            @Nullable String bannerUrl,
            List<String> tags,
            boolean launched) {}

    /**
     * The latest submission of a series for review (V21-01).
     *
     * @param decision APPROVED, CHANGES or REJECTED; {@code null} while it waits for an admin
     * @param items the requested changes (keys), with whether the creator marked each one fixed
     */
    public record ReviewRow(
            long id,
            UUID seriesId,
            OffsetDateTime submittedAt,
            @Nullable String decision,
            @Nullable String note,
            List<ReviewItemRow> items) {}

    /** A requested change and whether the creator marked it fixed. */
    public record ReviewItemRow(String item, boolean fixed) {}

    private static final String REVIEW =
            """
            select r.id, r.series_id, r.submitted_at, r.decision, r.note,
                   array(select i.item from series_review_items i where i.review_id = r.id
                         order by i.item) as items,
                   array(select i.fixed_at is not null from series_review_items i
                         where i.review_id = r.id order by i.item) as fixed
            from series_reviews r
            """;

    private final JdbcClient jdbc;

    public CreatorQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** The pen name, when the user has accepted the Creator terms. */
    public Optional<String> penName(UUID userId) {
        return jdbc.sql("select pen_name from creator_profiles where user_id = :id")
                .param("id", userId)
                .query(String.class)
                .optional();
    }

    public List<SeriesNumbers> seriesNumbers(UUID creatorId) {
        return jdbc.sql(
                        """
                        select s.id, s.visibility, s.subscriber_count,
                               (select count(*) from comments c
                                where c.series_id = s.id and c.status = 'VISIBLE') as comments,
                               coalesce(u.unlocks, 0) as unlocks,
                               coalesce(u.coins, 0) as earned_coins
                        from series s
                        left join lateral (
                            select count(*) as unlocks, sum(ce.coins) as coins
                            from creator_earnings ce
                            join episodes e on e.id = ce.episode_id
                            where e.series_id = s.id and ce.creator_id = s.creator_id
                        ) u on true
                        where s.creator_id = :creator
                        """)
                .param("creator", creatorId)
                .query((rs, n) ->
                        new SeriesNumbers(
                                rs.getObject("id", UUID.class),
                                SeriesVisibility.valueOf(rs.getString("visibility")),
                                rs.getLong("subscriber_count"),
                                rs.getLong("comments"),
                                rs.getLong("unlocks"),
                                rs.getLong("earned_coins")))
                .list();
    }

    /** Saves the profile (the Creator terms were accepted now). */
    public void insertProfile(UUID userId, String penName, String handle) {
        jdbc.sql(
                        "insert into creator_profiles (user_id, pen_name, handle, accepted_terms_at)"
                                + " values (:id, :name, :handle, now())")
                .param("id", userId)
                .param("name", penName)
                .param("handle", handle)
                .update();
    }

    public boolean handleTaken(String handle) {
        return jdbc.sql("select exists (select 1 from creator_profiles where handle = :h)")
                .param("h", handle)
                .query(Boolean.class)
                .single();
    }

    public Optional<String> handle(UUID userId) {
        return jdbc.sql("select handle from creator_profiles where user_id = :id")
                .param("id", userId)
                .query(String.class)
                .optional();
    }

    /** A creator's public profile row. */
    public record ProfileRow(
            UUID userId,
            String handle,
            String penName,
            @Nullable String bio,
            @Nullable String location,
            @Nullable String avatarUrl,
            OffsetDateTime since,
            long followers,
            @Nullable String payoutMethod) {}

    public Optional<ProfileRow> profile(String handle) {
        return jdbc.sql(PROFILE + " where p.handle = :h")
                .param("h", handle)
                .query((rs, n) -> profile(rs))
                .optional();
    }

    public Optional<ProfileRow> profile(UUID userId) {
        return jdbc.sql(PROFILE + " where p.user_id = :id")
                .param("id", userId)
                .query((rs, n) -> profile(rs))
                .optional();
    }

    private static final String PROFILE =
            "select p.user_id, p.handle, p.pen_name, p.bio, p.location, u.avatar_url,"
                    + " p.created_at, p.payout_method,"
                    + " (select count(*) from creator_follows f where f.creator_id = p.user_id)"
                    + " as followers from creator_profiles p join users u on u.id = p.user_id";

    private static ProfileRow profile(ResultSet rs) throws SQLException {
        return new ProfileRow(
                rs.getObject("user_id", UUID.class),
                rs.getString("handle"),
                rs.getString("pen_name"),
                rs.getString("bio"),
                rs.getString("location"),
                rs.getString("avatar_url"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getLong("followers"),
                rs.getString("payout_method"));
    }

    public void updateProfile(
            UUID userId, String penName, @Nullable String location, @Nullable String bio) {
        jdbc.sql(
                        "update creator_profiles set pen_name = :name, location = :loc, bio = :bio,"
                                + " updated_at = now() where user_id = :id")
                .param("id", userId)
                .param("name", penName)
                .param("loc", location, java.sql.Types.VARCHAR)
                .param("bio", bio, java.sql.Types.VARCHAR)
                .update();
    }

    public void setPayoutMethod(UUID userId, @Nullable String method) {
        jdbc.sql(
                        "update creator_profiles set payout_method = :m, updated_at = now() where user_id = :id")
                .param("id", userId)
                .param("m", method, java.sql.Types.VARCHAR)
                .update();
    }

    public boolean follows(UUID viewer, UUID creator) {
        return jdbc.sql(
                        "select exists (select 1 from creator_follows where user_id = :v"
                                + " and creator_id = :c)")
                .param("v", viewer)
                .param("c", creator)
                .query(Boolean.class)
                .single();
    }

    /** The creator's live series: what the public profile lists. */
    public List<UUID> publishedSeries(UUID creatorId) {
        return jdbc.sql("select id from series where creator_id = :c and visibility = 'PUBLISHED'")
                .param("c", creatorId)
                .query(UUID.class)
                .list();
    }

    /** One series' earnings in one month (first day of the month, Asia/Phnom_Penh). */
    public record MonthlySeries(UUID seriesId, LocalDate month, long coins, long unlocks) {}

    /** One month's earnings and the people behind them. */
    public record MonthlyTotal(LocalDate month, long coins, long unlocks, long readers) {}

    public List<MonthlySeries> earningsBySeries(UUID creatorId, OffsetDateTime from) {
        return jdbc.sql(
                        """
                        select e.series_id,
                               date_trunc('month', ce.created_at at time zone 'Asia/Phnom_Penh')::date as m,
                               sum(ce.coins) as coins, count(*) as unlocks
                        from creator_earnings ce join episodes e on e.id = ce.episode_id
                        where ce.creator_id = :c and ce.created_at >= :from
                        group by 1, 2
                        """)
                .param("c", creatorId)
                .param("from", from)
                .query((rs, n) ->
                        new MonthlySeries(
                                rs.getObject("series_id", UUID.class),
                                rs.getObject("m", LocalDate.class),
                                rs.getLong("coins"),
                                rs.getLong("unlocks")))
                .list();
    }

    public List<MonthlyTotal> earningsByMonth(UUID creatorId, OffsetDateTime from) {
        return jdbc.sql(
                        """
                        select date_trunc('month', ce.created_at at time zone 'Asia/Phnom_Penh')::date as m,
                               sum(ce.coins) as coins, count(*) as unlocks,
                               count(distinct u.user_id) as readers
                        from creator_earnings ce join unlocks u on u.id = ce.unlock_id
                        where ce.creator_id = :c and ce.created_at >= :from
                        group by 1
                        """)
                .param("c", creatorId)
                .param("from", from)
                .query((rs, n) ->
                        new MonthlyTotal(
                                rs.getObject("m", LocalDate.class),
                                rs.getLong("coins"),
                                rs.getLong("unlocks"),
                                rs.getLong("readers")))
                .list();
    }

    /** The series for editing, whoever owns it. */
    public Optional<EditRow> editRow(UUID seriesId) {
        return jdbc.sql(
                        """
                        select s.id, s.creator_id, s.slug, s.type, s.title, s.summary, g.slug as genre,
                               g2.slug as second_genre, s.languages, s.age_rating, s.status,
                               s.visibility, s.update_days, s.release_hour, s.fast_pass,
                               s.fast_pass_ahead, s.comments_enabled, s.break_message,
                               s.cover_url, s.banner_url, s.launched_at is not null as launched,
                               array(select t.tag from series_tags t where t.series_id = s.id
                                     order by t.tag) as tags
                        from series s join genres g on g.id = s.genre_id
                        left join genres g2 on g2.id = s.second_genre_id
                        where s.id = :id
                        """)
                .param("id", seriesId)
                .query((rs, n) ->
                        new EditRow(
                                rs.getObject("id", UUID.class),
                                rs.getObject("creator_id", UUID.class),
                                rs.getString("slug"),
                                SeriesType.valueOf(rs.getString("type")),
                                rs.getString("title"),
                                rs.getString("summary"),
                                rs.getString("genre"),
                                rs.getString("second_genre"),
                                List.of((String[]) rs.getArray("languages").getArray()),
                                AgeRating.valueOf(rs.getString("age_rating")),
                                SeriesStatus.valueOf(rs.getString("status")),
                                SeriesVisibility.valueOf(rs.getString("visibility")),
                                DayArrays.days(rs.getArray("update_days")),
                                rs.getObject("release_hour", Integer.class),
                                rs.getBoolean("fast_pass"),
                                rs.getInt("fast_pass_ahead"),
                                rs.getBoolean("comments_enabled"),
                                rs.getString("break_message"),
                                rs.getString("cover_url"),
                                rs.getString("banner_url"),
                                List.of((String[]) rs.getArray("tags").getArray()),
                                rs.getBoolean("launched")))
                .optional();
    }

    // ---------- review (V21-01) ----------

    /** The series' latest submission for review, if it was ever submitted. */
    public Optional<ReviewRow> latestReview(UUID seriesId) {
        return jdbc.sql(REVIEW + " where r.series_id = :id order by r.id desc limit 1")
                .param("id", seriesId)
                .query((rs, n) -> review(rs))
                .optional();
    }

    /** The latest submission of each of the creator's series that was ever submitted. */
    public Map<UUID, ReviewRow> latestReviews(UUID creatorId) {
        return jdbc
                .sql(
                        "select distinct on (x.series_id) x.* from ("
                                + REVIEW
                                + " join series s on s.id = r.series_id where s.creator_id = :c) x"
                                + " order by x.series_id, x.id desc")
                .param("c", creatorId)
                .query((rs, n) -> review(rs))
                .list()
                .stream()
                .collect(Collectors.toMap(ReviewRow::seriesId, Function.identity()));
    }

    private static ReviewRow review(ResultSet rs) throws SQLException {
        String[] items = (String[]) rs.getArray("items").getArray();
        Boolean[] fixed = (Boolean[]) rs.getArray("fixed").getArray();
        List<ReviewItemRow> rows = new ArrayList<>();
        for (int i = 0; i < items.length; i++) {
            rows.add(new ReviewItemRow(items[i], fixed[i]));
        }
        return new ReviewRow(
                rs.getLong("id"),
                rs.getObject("series_id", UUID.class),
                rs.getObject("submitted_at", OffsetDateTime.class),
                rs.getString("decision"),
                rs.getString("note"),
                rows);
    }
}
