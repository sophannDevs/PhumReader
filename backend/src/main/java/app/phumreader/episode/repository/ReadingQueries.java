package app.phumreader.episode.repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Episode content, unlock checks, likes, bookmarks and reading progress (plain SQL). */
@Repository
public class ReadingQueries {

    /** One comic panel in reading order; {@code storageKey} is a public path for the demo. */
    public record PanelRow(String storageKey, int width, int height, String alt) {}

    /** A novel chapter's blocks (JSON array) and word count. */
    public record ChapterRow(String blocksJson, int wordCount) {}

    private final JdbcClient jdbc;

    public ReadingQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<PanelRow> panels(UUID episodeId) {
        return jdbc.sql(
                        "select storage_key, width, height, alt from episode_images"
                                + " where episode_id = :id order by position")
                .param("id", episodeId)
                .query((rs, n) ->
                        new PanelRow(
                                rs.getString("storage_key"),
                                rs.getInt("width"),
                                rs.getInt("height"),
                                rs.getString("alt")))
                .list();
    }

    public Optional<ChapterRow> chapter(UUID episodeId) {
        return jdbc.sql(
                        "select blocks::text as blocks, word_count from chapter_texts where episode_id = :id")
                .param("id", episodeId)
                .query((rs, n) -> new ChapterRow(rs.getString("blocks"), rs.getInt("word_count")))
                .optional();
    }

    public boolean hasUnlock(UUID userId, UUID episodeId) {
        return exists("unlocks", userId, episodeId);
    }

    public boolean liked(UUID userId, UUID episodeId) {
        return exists("episode_likes", userId, episodeId);
    }

    public boolean bookmarked(UUID userId, UUID episodeId) {
        return exists("episode_bookmarks", userId, episodeId);
    }

    public long visibleComments(UUID episodeId) {
        return jdbc.sql(
                        "select count(*) from comments where episode_id = :id"
                                + " and status = 'VISIBLE'")
                .param("id", episodeId)
                .query(Long.class)
                .single();
    }

    /** Adds the like once; the episode's and the series' like counts follow. */
    public boolean like(UUID userId, UUID episodeId, OffsetDateTime now) {
        int added =
                jdbc.sql(
                                "insert into episode_likes (user_id, episode_id, created_at)"
                                        + " values (:u, :e, :now) on conflict do nothing")
                        .param("u", userId)
                        .param("e", episodeId)
                        .param("now", now)
                        .update();
        if (added == 1) {
            changeLikeCounts(episodeId, 1);
        }
        return added == 1;
    }

    public boolean unlike(UUID userId, UUID episodeId) {
        int removed = delete("episode_likes", userId, episodeId);
        if (removed == 1) {
            changeLikeCounts(episodeId, -1);
        }
        return removed == 1;
    }

    public long episodeLikes(UUID episodeId) {
        return jdbc.sql("select like_count from episodes where id = :id")
                .param("id", episodeId)
                .query(Long.class)
                .single();
    }

    public void bookmark(UUID userId, UUID episodeId, OffsetDateTime now) {
        jdbc.sql(
                        "insert into episode_bookmarks (user_id, episode_id, created_at)"
                                + " values (:u, :e, :now) on conflict do nothing")
                .param("u", userId)
                .param("e", episodeId)
                .param("now", now)
                .update();
    }

    public void unbookmark(UUID userId, UUID episodeId) {
        delete("episode_bookmarks", userId, episodeId);
    }

    /**
     * Remembers the episode opened last in the series and how far into it; the highest episode
     * opened only ever goes up. Saving the same episode again never lowers its progress, so
     * reopening a finished chapter keeps it at 100%.
     */
    public void saveProgress(
            UUID userId,
            UUID seriesId,
            UUID episodeId,
            int number,
            float progress,
            OffsetDateTime now) {
        jdbc.sql(
                        """
                        insert into reading_progress
                            (user_id, series_id, episode_id, progress, max_episode_number, updated_at)
                        values (:u, :s, :e, :p, :n, :now)
                        on conflict (user_id, series_id) do update set
                            progress = case
                                when reading_progress.episode_id = excluded.episode_id
                                    then greatest(reading_progress.progress, excluded.progress)
                                else excluded.progress end,
                            episode_id = excluded.episode_id,
                            max_episode_number = greatest(reading_progress.max_episode_number,
                                                          excluded.max_episode_number),
                            updated_at = excluded.updated_at
                        """)
                .param("u", userId)
                .param("s", seriesId)
                .param("e", episodeId)
                .param("p", progress)
                .param("n", number)
                .param("now", now)
                .update();
    }

    private void changeLikeCounts(UUID episodeId, int delta) {
        jdbc.sql("update episodes set like_count = greatest(like_count + :d, 0) where id = :id")
                .param("d", delta)
                .param("id", episodeId)
                .update();
        jdbc.sql(
                        "update series set like_count = greatest(like_count + :d, 0)"
                                + " where id = (select series_id from episodes where id = :id)")
                .param("d", delta)
                .param("id", episodeId)
                .update();
    }

    private boolean exists(String table, UUID userId, UUID episodeId) {
        return jdbc.sql(
                        "select exists(select 1 from "
                                + table
                                + " where user_id = :u and episode_id = :e)")
                .param("u", userId)
                .param("e", episodeId)
                .query(Boolean.class)
                .single();
    }

    private int delete(String table, UUID userId, UUID episodeId) {
        return jdbc.sql("delete from " + table + " where user_id = :u and episode_id = :e")
                .param("u", userId)
                .param("e", episodeId)
                .update();
    }
}
