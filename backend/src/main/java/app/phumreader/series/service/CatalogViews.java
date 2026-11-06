package app.phumreader.series.service;

import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * What the catalog endpoints return. Field names and nesting follow the website's types
 * (src/data/types.ts and src/lib/demo-api.ts); values are raw (counts as numbers, days as ISO dates
 * in Asia/Phnom_Penh, ranking movement as the previous rank) and the website formats them for
 * English or Khmer.
 */
public final class CatalogViews {

    private CatalogViews() {}

    /**
     * A series as shown on cards, rows and the series page.
     *
     * @param genre the genre's name, e.g. "Slice of life"
     * @param creator the creator's pen name
     * @param cover public path or URL of the cover image
     * @param views total views
     * @param likes total likes
     * @param freeEpisodes episodes anyone can read now
     * @param fastPassEpisodes episodes that need coins until their free date
     * @param totalEpisodes released episodes (free + Fast Pass)
     * @param updateDay the day new episodes come out, if the series has a schedule
     * @param language languages the series is available in ("en", "km")
     */
    public record SeriesCard(
            UUID id,
            String slug,
            String title,
            SeriesType type,
            String genre,
            String creator,
            @Nullable String cover,
            long views,
            long likes,
            int freeEpisodes,
            int fastPassEpisodes,
            int totalEpisodes,
            @Nullable Weekday updateDay,
            SeriesStatus status,
            List<String> language,
            AgeRating ageRating,
            Badges badges) {}

    /**
     * @param up the series updates today (Asia/Phnom_Penh) and released an episode in the last 7
     *     days
     * @param isNew launched on PhumReader in the last 30 days
     */
    public record Badges(boolean up, boolean isNew) {}

    /**
     * An episode or chapter in a series' list (no content).
     *
     * @param n episode number, from 1
     * @param date the day it became free to read; for a Fast Pass episode, the day it will (ISO
     *     date in Asia/Phnom_Penh)
     * @param access {@code fastpass} while it still needs coins
     * @param isUp the newest free episode, when it became free in the last 7 days
     * @param price coins to unlock it now, only while {@code access} is {@code fastpass}
     */
    public record EpisodeSummary(
            int n,
            String title,
            LocalDate date,
            long likes,
            @Nullable String thumb,
            EpisodeAccess access,
            boolean isUp,
            @Nullable Integer price) {}

    /** Whether an episode is free to read now or still needs coins. */
    public enum EpisodeAccess {
        @JsonProperty("free")
        FREE,
        @JsonProperty("fastpass")
        FAST_PASS
    }

    /**
     * The series page.
     *
     * @param related up to 4 other series in the same genre
     * @param creatorSeriesCount the creator's published series, this one included
     */
    public record SeriesDetail(
            SeriesCard series,
            String synopsis,
            SeriesStats stats,
            List<SeriesCard> related,
            int creatorSeriesCount) {}

    /**
     * @param comments visible comments on the series page and its episodes
     */
    public record SeriesStats(long subscribers, long comments) {}

    /** A genre with the number of published series in it. */
    public record GenreItem(String slug, String name, long seriesCount) {}

    /**
     * A place in a ranking.
     *
     * @param previousRank the place last time; {@code null} when the series is new to the ranking
     */
    public record RankingEntry(int rank, @Nullable Integer previousRank, SeriesCard series) {}

    /**
     * A home hero slide.
     *
     * @param series the series' slug
     * @param tag short label, e.g. "Season 2"
     */
    public record HeroSlide(String series, String tag, String blurb, SeriesCard seriesData) {}

    /** The first places of both rankings. */
    public record HomeRankings(List<RankingEntry> comics, List<RankingEntry> novels) {}

    /**
     * Everything the home page shows except the reader's own "Continue reading".
     *
     * @param today the day of the week in Asia/Phnom_Penh (the "Today" tab)
     * @param daily for each day "Mon" … "Sun": up to 6 series that update that day, topped up with
     *     series that have the UP badge
     * @param rankings the first 8 comics and the first 8 web novels
     * @param genres genre names in display order
     * @param byGenre for each genre name: its most viewed series (up to 12)
     * @param novels the 6 most viewed web novels
     * @param creatorCovers 3 covers for the "become a creator" card
     */
    public record HomeFeed(
            Weekday today,
            List<HeroSlide> hero,
            Map<String, List<SeriesCard>> daily,
            HomeRankings rankings,
            List<String> genres,
            Map<String, List<SeriesCard>> byGenre,
            List<SeriesCard> novels,
            List<SeriesCard> creatorCovers) {}
}
