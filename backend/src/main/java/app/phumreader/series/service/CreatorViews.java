package app.phumreader.series.service;

import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.ReviewDecision;
import app.phumreader.series.domain.ReviewItem;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.domain.SeriesVisibility;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import app.phumreader.series.service.CreatorInput.SeriesFastPass;
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
     * @param handle the address of the public profile, {@code /creators/<handle>} ({@code null} for
     *     readers)
     * @param series the creator's series, most viewed first
     */
    public record CreatorDashboard(
            boolean creator,
            @Nullable String name,
            @Nullable String handle,
            CreatorTotals totals,
            List<CreatorSeries> series) {}

    /**
     * A creator's public profile (V21-05).
     *
     * @param id the creator's account (follow, block)
     * @param since when they became a creator
     * @param followers people who follow the creator
     * @param views total views of the published series
     * @param likes total likes of the published series
     * @param following the signed-in reader follows the creator
     * @param owner the signed-in reader is this creator
     * @param series the published series, most viewed first
     */
    public record CreatorProfile(
            UUID id,
            String handle,
            String name,
            @Nullable String avatarUrl,
            @Nullable String bio,
            @Nullable String location,
            Instant since,
            long followers,
            long views,
            long likes,
            boolean following,
            boolean owner,
            List<SeriesCard> series) {}

    /**
     * One month of earnings.
     *
     * @param month {@code yyyy-MM} (Asia/Phnom_Penh)
     * @param coins coins readers spent on the creator's Fast Pass episodes
     * @param unlocks episodes unlocked
     * @param readers different people who unlocked something that month
     */
    public record EarningsMonth(String month, long coins, long unlocks, long readers) {}

    /**
     * A series' earnings, one number per month of {@link CreatorEarnings#months()} (same order).
     */
    public record EarningsSeries(
            UUID id,
            String slug,
            String title,
            @Nullable String cover,
            SeriesVisibility visibility,
            List<Long> coins,
            long unlocks) {}

    /** A finished month of earnings, as the payout history lists it. */
    public record PayoutMonth(String month, long coins) {}

    /**
     * The earnings page. The API pays nothing out yet: {@code history} lists the finished months,
     * the website marks them "On hold" until {@code payoutMethod} is set.
     *
     * @param months the last 6 months, oldest first, empty months included
     * @param series every series that is not a draft
     * @param history up to 3 finished months with coins, newest first
     * @param payoutMethod {@code aba}, {@code bank} or {@code null}
     */
    public record CreatorEarnings(
            List<EarningsMonth> months,
            List<EarningsSeries> series,
            List<PayoutMonth> history,
            @Nullable String payoutMethod) {}

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
     * @param genre the main genre's slug
     * @param secondGenre the second genre's slug, if any
     * @param breakMessage the "On break" message (only while the status is hiatus)
     * @param visibility draft, review (waiting for an admin), changes (the admin asked for
     *     changes), published or hidden (taken down by an admin)
     * @param updateDays the days new episodes come out, in week order (Mon first); empty when the
     *     series has no schedule
     * @param releaseHour the hour new episodes come out, 0-23 in Asia/Phnom_Penh
     * @param fastPass the series' Fast Pass switch (the defaults for new episodes)
     * @param commentsEnabled readers may comment on the series page and its episodes
     * @param review the latest submission for review; {@code null} when it was never submitted
     */
    public record SeriesEdit(
            UUID id,
            String slug,
            SeriesType type,
            String title,
            String summary,
            String genre,
            @Nullable String secondGenre,
            List<String> languages,
            AgeRating ageRating,
            SeriesStatus status,
            @Nullable String breakMessage,
            SeriesVisibility visibility,
            List<Weekday> updateDays,
            @Nullable Integer releaseHour,
            SeriesFastPass fastPass,
            boolean commentsEnabled,
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

    /**
     * One row of a creator's episode list, any status.
     *
     * @param status draft, scheduled, published or hidden (taken down by an admin)
     * @param hiddenAt when the creator hid this published episode from readers (V21-02); {@code
     *     null} while readers see it. Separate from the admin's {@code hidden} status
     */
    public record CreatorEpisode(
            int number,
            String title,
            String status,
            @Nullable Instant publishedAt,
            @Nullable Instant freeAt,
            @Nullable Integer priceCoins,
            @Nullable String thumbnailUrl,
            boolean commentsEnabled,
            @Nullable Instant hiddenAt,
            long views,
            long likes) {}

    /** A panel as the episode form shows it. */
    public record PanelView(UUID uploadId, String url, int width, int height) {}

    /** A block of chapter text. */
    public record BlockView(String type, @Nullable String text) {}

    /**
     * An episode as its creator edits it.
     *
     * @param status draft, scheduled, published or hidden (taken down by an admin)
     * @param publishedAt release time (scheduled time for SCHEDULED)
     * @param freeAfterDays Fast Pass: days after release until it is free; null when free
     * @param hiddenAt when the creator hid it from readers; {@code null} while readers see it
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
            @Nullable Instant hiddenAt,
            List<PanelView> panels,
            List<BlockView> blocks,
            int wordCount) {}
}
