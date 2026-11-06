package app.phumreader.series.repository;

import app.phumreader.series.domain.SeriesVisibility;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
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
}
