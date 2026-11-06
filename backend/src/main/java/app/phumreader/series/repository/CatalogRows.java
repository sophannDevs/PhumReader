package app.phumreader.series.repository;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Small result rows of {@link CatalogQueries}. */
public final class CatalogRows {

    private CatalogRows() {}

    /** A home hero slide (editorial) and its series. */
    public record HeroRow(String tag, String blurb, SeriesRow series) {}

    /** A ranking place; {@code previousPosition} is null for a series new to the ranking. */
    public record RankingRow(int position, @Nullable Integer previousPosition, SeriesRow series) {}

    /** A genre and how many published series it has. */
    public record GenreRow(String slug, String name, long seriesCount) {}

    /** A published episode or chapter (no content). */
    public record EpisodeRow(
            int number,
            String title,
            OffsetDateTime publishedAt,
            @Nullable OffsetDateTime freeAt,
            @Nullable Integer priceCoins,
            @Nullable String thumbnailUrl,
            long likes) {}

    /**
     * Where the previous page of a series list ended: the last row's sort value and id. {@code
     * views} is used by {@link app.phumreader.series.domain.SeriesOrder#POPULAR}, {@code
     * launchedAt} by {@link app.phumreader.series.domain.SeriesOrder#NEWEST}.
     */
    public record SeriesKey(long views, @Nullable OffsetDateTime launchedAt, UUID id) {}
}
