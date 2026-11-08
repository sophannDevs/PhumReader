package app.phumreader.series.repository;

import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Adds counted views to the stored totals. */
@Repository
public class ViewCounts {

    private final JdbcClient jdbc;

    public ViewCounts(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void addSeries(Map<UUID, Long> counts) {
        counts.forEach((id, n) ->
                jdbc.sql("update series set view_count = view_count + :n where id = :id")
                        .param("n", n)
                        .param("id", id)
                        .update());
    }

    /** Keys are (series id, episode number). */
    public void addEpisode(UUID seriesId, int number, long n) {
        jdbc.sql(
                        "update episodes set view_count = view_count + :n"
                                + " where series_id = :series and number = :number")
                .param("n", n)
                .param("series", seriesId)
                .param("number", number)
                .update();
    }
}
