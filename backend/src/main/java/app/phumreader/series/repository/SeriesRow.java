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
 * One published series with its genre, creator and episode counts as of the query's "now". Episodes
 * the creator hid are not counted.
 *
 * @param secondGenreSlug the optional second genre (V21-02)
 * @param creatorHandle the address of the creator's public profile, {@code /creators/<handle>}
 * @param updateDays the days new episodes come out, in week order
 * @param commentsEnabled the series' comments switch
 * @param breakMessage the "On break" message (only while the status is HIATUS)
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
        @Nullable String secondGenreSlug,
        UUID creatorId,
        String creatorName,
        String creatorHandle,
        @Nullable String coverUrl,
        long views,
        long likes,
        long subscribers,
        List<DayOfWeek> updateDays,
        SeriesStatus status,
        List<String> languages,
        AgeRating ageRating,
        boolean commentsEnabled,
        @Nullable String breakMessage,
        OffsetDateTime launchedAt,
        int freeEpisodes,
        int fastPassEpisodes,
        int totalEpisodes,
        @Nullable Integer latestFreeNumber,
        @Nullable OffsetDateTime latestRelease) {}
