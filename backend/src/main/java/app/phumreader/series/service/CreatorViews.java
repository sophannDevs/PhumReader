package app.phumreader.series.service;

import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.ReviewDecision;
import app.phumreader.series.domain.ReviewItem;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.domain.SeriesVisibility;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the creator dashboard shows (src/components/pr/creator-page.tsx). Raw numbers. */
public final class CreatorViews {

    private CreatorViews() {}

    /**
     * @param creator the account has accepted the Creator terms; readers get an empty dashboard
     * @param name the pen name ({@code null} for readers)
     * @param series the creator's series, most viewed first
     */
    public record CreatorDashboard(
            boolean creator,
            @Nullable String name,
            CreatorTotals totals,
            List<CreatorSeries> series) {}

    /**
     * Sums over all the creator's series.
     *
     * @param series number of series
     * @param views total views ("Readers" on the dashboard)
     * @param earnedCoins coins earned from Fast Pass unlocks (payouts are not part of v1, A7)
     */
    public record CreatorTotals(
            int series,
            long views,
            long likes,
            long subscribers,
            long comments,
            long unlocks,
            long earnedCoins) {}

    /**
     * One series with its numbers.
     *
     * @param series the series card (views, likes and episode counts are in it)
     * @param visibility draft, review (waiting for an admin), changes (the admin asked for
     *     changes), published or hidden (taken down by an admin)
     * @param comments visible comments on the series page and its episodes
     * @param unlocks Fast Pass episodes bought with coins
     * @param earnedCoins coins earned from those unlocks
     * @param review the latest submission for review; {@code null} when it was never submitted
     */
    public record CreatorSeries(
            SeriesCard series,
            SeriesVisibility visibility,
            long subscribers,
            long comments,
            long unlocks,
            long earnedCoins,
            @Nullable SeriesReview review) {}

    /**
     * A series as its creator edits it (GET /creator/series/{id}).
     *
     * @param visibility draft, review (waiting for an admin), changes (the admin asked for
     *     changes), published or hidden (taken down by an admin)
     * @param review the latest submission for review; {@code null} when it was never submitted
     */
    public record SeriesEdit(
            UUID id,
            String slug,
            SeriesType type,
            String title,
            String summary,
            String genre,
            List<String> languages,
            AgeRating ageRating,
            SeriesStatus status,
            SeriesVisibility visibility,
            @Nullable Weekday updateDay,
            @Nullable String coverUrl,
            @Nullable String bannerUrl,
            List<String> tags,
            @Nullable SeriesReview review) {}

    /**
     * The latest submission of a series for review (V21-01), as Manage series shows it.
     *
     * @param submittedAt when the creator submitted it
     * @param decision {@code null} while it waits for an admin
     * @param note the admin's note to the creator
     * @param items what the admin asked to change (decision {@code changes}), each with whether the
     *     creator marked it fixed; empty otherwise
     */
    public record SeriesReview(
            Instant submittedAt,
            @Nullable ReviewDecision decision,
            @Nullable String note,
            List<RequestedChange> items) {}

    /**
     * A change the admin asked for.
     *
     * @param fixed the creator marked it fixed
     */
    public record RequestedChange(ReviewItem item, boolean fixed) {}

    /** One row of a creator's episode list, any status. */
    public record CreatorEpisode(
            int number,
            String title,
            String status,
            @Nullable Instant publishedAt,
            @Nullable Instant freeAt,
            @Nullable Integer priceCoins,
            @Nullable String thumbnailUrl,
            boolean commentsEnabled,
            long views,
            long likes) {}

    /** A panel as the episode form shows it. */
    public record PanelView(UUID uploadId, String url, int width, int height) {}

    /** A block of chapter text. */
    public record BlockView(String type, @Nullable String text) {}

    /**
     * An episode as its creator edits it.
     *
     * @param status draft, scheduled or published
     * @param publishedAt release time (scheduled time for SCHEDULED)
     * @param freeAfterDays Fast Pass: days after release until it is free; null when free
     * @param panels comics: the panels in order
     * @param blocks novels: the chapter text
     */
    public record EpisodeEdit(
            int number,
            String title,
            String status,
            @Nullable Instant publishedAt,
            @Nullable Instant freeAt,
            @Nullable Integer priceCoins,
            @Nullable Integer freeAfterDays,
            @Nullable String thumbnailUrl,
            @Nullable String creatorNote,
            boolean commentsEnabled,
            List<PanelView> panels,
            List<BlockView> blocks,
            int wordCount) {}
}
