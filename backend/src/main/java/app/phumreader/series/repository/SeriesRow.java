package app.phumreader.series.repository;

import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import java.time.DayOfWeek;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * One published series with its genre, creator and episode counts as of the query's "now".
 *
 * @param freeEpisodes published episodes that anyone can read now (free, or Fast Pass whose free
 *     date has passed)
 * @param fastPassEpisodes published episodes that still need coins (Fast Pass before their free
 *     date)
 * @param latestFreeNumber number of the newest episode anyone can read now
 * @param latestRelease the last time an episode came out or became free
 */
public record SeriesRow(
        UUID id,
        String slug,
        String title,
        SeriesType type,
        String summary,
        String genreSlug,
        String genreName,
        UUID creatorId,
        String creatorName,
        @Nullable String coverUrl,
        long views,
        long likes,
        long subscribers,
        @Nullable DayOfWeek updateDay,
        SeriesStatus status,
        List<String> languages,
        AgeRating ageRating,
        OffsetDateTime launchedAt,
        int freeEpisodes,
        int fastPassEpisodes,
        int totalEpisodes,
        @Nullable Integer latestFreeNumber,
        @Nullable OffsetDateTime latestRelease) {}
