package app.phumreader.series.repository;

import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import java.time.DayOfWeek;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** What creators write: series, episodes, panels and chapter text (plan P3-14). */
@Repository
public class CreatorWrites {

    /** Values of a series row that the creator controls. */
    public record SeriesValues(
            String title,
            String summary,
            String genreSlug,
            List<String> languages,
            AgeRating ageRating,
            SeriesStatus status,
            @Nullable DayOfWeek updateDay,
            @Nullable String coverUrl,
            @Nullable String bannerUrl,
            List<String> tags) {}

    /** An episode as stored. */
    public record EpisodeRow(
            UUID id,
            UUID seriesId,
            int number,
            String title,
            String status,
            @Nullable Instant publishedAt,
            @Nullable Instant freeAt,
            @Nullable Integer priceCoins,
            @Nullable Integer fastPassDays,
            @Nullable String thumbnailUrl,
            @Nullable String creatorNote,
            boolean commentsEnabled,
            long views,
            long likes) {}

    /** A panel in reading order. */
    public record PanelRow(
            @Nullable UUID uploadId, String url, int width, int height, String alt) {}

    /** The stored chapter text. */
    public record ChapterRow(String blocksJson, int wordCount) {}

    /** Values of an episode row that the creator controls. */
    public record EpisodeValues(
            String title,
            String status,
            @Nullable Instant publishedAt,
            @Nullable Instant freeAt,
            @Nullable Integer priceCoins,
            @Nullable Integer fastPassDays,
            @Nullable String thumbnailUrl,
            @Nullable String creatorNote,
            boolean commentsEnabled) {}

    private static final String EPISODE =
            "select id, series_id, number, title, status, published_at, free_at, price_coins,"
                    + " fast_pass_days, thumbnail_url, creator_note, comments_enabled, view_count,"
                    + " like_count from episodes ";

    private final JdbcClient jdbc;

    public CreatorWrites(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------- series ----------

    public boolean slugTaken(String slug) {
        return jdbc.sql("select exists (select 1 from series where slug = :s)")
                .param("s", slug)
                .query(Boolean.class)
                .single();
    }

    public Optional<Short> genreId(String slug) {
        return jdbc.sql("select id from genres where slug = :s")
                .param("s", slug)
                .query(Short.class)
                .optional();
    }

    public void insertSeries(
            UUID id, UUID creator, String slug, SeriesType type, SeriesValues v, short genreId) {
        jdbc.sql(
                        """
                        insert into series (id, slug, creator_id, type, title, summary, genre_id,
                                            languages, age_rating, status, update_day, cover_url,
                                            banner_url)
                        values (:id, :slug, :creator, :type, :title, :summary, :genre,
                                :languages, :age, :status, :day, :cover, :banner)
                        """)
                .param("id", id)
                .param("slug", slug)
                .param("creator", creator)
                .param("type", type.name())
                .param("title", v.title())
                .param("summary", v.summary())
                .param("genre", genreId)
                .param("languages", v.languages().toArray(String[]::new))
                .param("age", v.ageRating().name())
                .param("status", v.status().name())
                .param("day", v.updateDay() == null ? null : v.updateDay().name())
                .param("cover", v.coverUrl())
                .param("banner", v.bannerUrl())
                .update();
        replaceTags(id, v.tags());
    }

    public void updateSeries(UUID id, SeriesValues v, short genreId) {
        jdbc.sql(
                        """
                        update series set title = :title, summary = :summary, genre_id = :genre,
                               languages = :languages, age_rating = :age, status = :status,
                               update_day = :day, cover_url = :cover, banner_url = :banner,
                               updated_at = now()
                        where id = :id
                        """)
                .param("id", id)
                .param("title", v.title())
                .param("summary", v.summary())
                .param("genre", genreId)
                .param("languages", v.languages().toArray(String[]::new))
                .param("age", v.ageRating().name())
                .param("status", v.status().name())
                .param("day", v.updateDay() == null ? null : v.updateDay().name())
                .param("cover", v.coverUrl())
                .param("banner", v.bannerUrl())
                .update();
        replaceTags(id, v.tags());
    }

    private void replaceTags(UUID id, List<String> tags) {
        jdbc.sql("delete from series_tags where series_id = :id").param("id", id).update();
        for (String tag : tags) {
            jdbc.sql("insert into series_tags (series_id, tag) values (:id, :tag)")
                    .param("id", id)
                    .param("tag", tag)
                    .update();
        }
    }

    /** Goes live (or back to draft); the first time sets the launch date. */
    public void setVisibility(UUID id, String visibility, Instant now) {
        jdbc.sql(
                        "update series set visibility = :v, updated_at = now(), launched_at ="
                                + " case when :v = 'PUBLISHED' then coalesce(launched_at, :now)"
                                + " else launched_at end where id = :id")
                .param("id", id)
                .param("v", visibility)
                .param("now", java.sql.Timestamp.from(now))
                .update();
    }

    // ---------- episodes ----------

    public int nextNumber(UUID seriesId) {
        return jdbc.sql("select coalesce(max(number), 0) + 1 from episodes where series_id = :id")
                .param("id", seriesId)
                .query(Integer.class)
                .single();
    }

    public Optional<EpisodeRow> episode(UUID seriesId, int number) {
        return jdbc.sql(EPISODE + "where series_id = :id and number = :n")
                .param("id", seriesId)
                .param("n", number)
                .query(CreatorWrites::episodeRow)
                .optional();
    }

    public List<EpisodeRow> episodes(UUID seriesId) {
        return jdbc.sql(EPISODE + "where series_id = :id order by number desc")
                .param("id", seriesId)
                .query(CreatorWrites::episodeRow)
                .list();
    }

    private static EpisodeRow episodeRow(java.sql.ResultSet rs, int n)
            throws java.sql.SQLException {
        java.time.OffsetDateTime published =
                rs.getObject("published_at", java.time.OffsetDateTime.class);
        java.time.OffsetDateTime free = rs.getObject("free_at", java.time.OffsetDateTime.class);
        return new EpisodeRow(
                rs.getObject("id", UUID.class),
                rs.getObject("series_id", UUID.class),
                rs.getInt("number"),
                rs.getString("title"),
                rs.getString("status"),
                published == null ? null : published.toInstant(),
                free == null ? null : free.toInstant(),
                (Integer) rs.getObject("price_coins"),
                (Integer) rs.getObject("fast_pass_days"),
                rs.getString("thumbnail_url"),
                rs.getString("creator_note"),
                rs.getBoolean("comments_enabled"),
                rs.getLong("view_count"),
                rs.getLong("like_count"));
    }

    public void insertEpisode(UUID id, UUID seriesId, int number, EpisodeValues v) {
        jdbc.sql(
                        """
                        insert into episodes (id, series_id, number, title, status, published_at,
                               free_at, price_coins, fast_pass_days, thumbnail_url, creator_note,
                               comments_enabled)
                        values (:id, :series, :number, :title, :status, :published, :free, :price,
                                :days, :thumb, :note, :comments)
                        """)
                .param("id", id)
                .param("series", seriesId)
                .param("number", number)
                .params(episodeParams(v))
                .update();
    }

    public void updateEpisode(UUID id, EpisodeValues v) {
        jdbc.sql(
                        """
                        update episodes set title = :title, status = :status,
                               published_at = :published, free_at = :free, price_coins = :price,
                               fast_pass_days = :days, thumbnail_url = :thumb,
                               creator_note = :note, comments_enabled = :comments,
                               updated_at = now()
                        where id = :id
                        """)
                .param("id", id)
                .params(episodeParams(v))
                .update();
    }

    private static java.util.Map<String, Object> episodeParams(EpisodeValues v) {
        java.util.Map<String, Object> m = new java.util.HashMap<>();
        m.put("title", v.title());
        m.put("status", v.status());
        m.put(
                "published",
                v.publishedAt() == null ? null : java.sql.Timestamp.from(v.publishedAt()));
        m.put("free", v.freeAt() == null ? null : java.sql.Timestamp.from(v.freeAt()));
        m.put("price", v.priceCoins());
        m.put("days", v.fastPassDays());
        m.put("thumb", v.thumbnailUrl());
        m.put("note", v.creatorNote());
        m.put("comments", v.commentsEnabled());
        return m;
    }

    public void deleteEpisode(UUID id) {
        jdbc.sql("delete from episodes where id = :id").param("id", id).update();
    }

    // ---------- panels and chapter text ----------

    public List<PanelRow> panels(UUID episodeId) {
        return jdbc.sql(
                        "select upload_id, storage_key, width, height, alt from episode_images"
                                + " where episode_id = :id order by position")
                .param("id", episodeId)
                .query((rs, n) ->
                        new PanelRow(
                                rs.getObject("upload_id", UUID.class),
                                rs.getString("storage_key"),
                                rs.getInt("width"),
                                rs.getInt("height"),
                                rs.getString("alt")))
                .list();
    }

    /** Replaces all panels; a panel's {@code url} is what readers load. */
    public void replacePanels(UUID episodeId, List<PanelRow> panels) {
        jdbc.sql("delete from episode_images where episode_id = :id")
                .param("id", episodeId)
                .update();
        int position = 1;
        for (PanelRow p : panels) {
            jdbc.sql(
                            "insert into episode_images (episode_id, position, storage_key, width,"
                                    + " height, alt, upload_id) values (:e, :p, :url, :w, :h, :alt,"
                                    + " :u)")
                    .param("e", episodeId)
                    .param("p", position++)
                    .param("url", p.url())
                    .param("w", p.width())
                    .param("h", p.height())
                    .param("alt", p.alt())
                    .param("u", p.uploadId())
                    .update();
        }
    }

    public Optional<ChapterRow> chapter(UUID episodeId) {
        return jdbc.sql(
                        "select blocks::text as blocks, word_count from chapter_texts where episode_id = :id")
                .param("id", episodeId)
                .query((rs, n) -> new ChapterRow(rs.getString("blocks"), rs.getInt("word_count")))
                .optional();
    }

    public void replaceChapter(UUID episodeId, @Nullable String blocksJson, int wordCount) {
        jdbc.sql("delete from chapter_texts where episode_id = :id")
                .param("id", episodeId)
                .update();
        if (blocksJson != null) {
            jdbc.sql(
                            "insert into chapter_texts (episode_id, blocks, word_count) values (:e,"
                                    + " cast(:b as jsonb), :w)")
                    .param("e", episodeId)
                    .param("b", blocksJson)
                    .param("w", wordCount)
                    .update();
        }
    }

    // ---------- scheduled publishing ----------

    /**
     * Makes every scheduled episode whose time has come live; returns the series that changed. Rows
     * are locked with SKIP LOCKED so two instances never publish the same episode.
     */
    public List<UUID> publishDue(Instant now) {
        return jdbc.sql(
                        """
                        update episodes set status = 'PUBLISHED', updated_at = now()
                        where id in (select id from episodes
                                     where status = 'SCHEDULED' and published_at <= :now
                                     for update skip locked)
                        returning series_id
                        """)
                .param("now", java.sql.Timestamp.from(now))
                .query(UUID.class)
                .list();
    }
}
