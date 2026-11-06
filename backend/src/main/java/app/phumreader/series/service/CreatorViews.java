package app.phumreader.series.service;

import app.phumreader.series.domain.SeriesVisibility;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import java.util.List;
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
     * @param visibility draft, published or hidden
     * @param comments visible comments on the series page and its episodes
     * @param unlocks Fast Pass episodes bought with coins
     * @param earnedCoins coins earned from those unlocks
     */
    public record CreatorSeries(
            SeriesCard series,
            SeriesVisibility visibility,
            long subscribers,
            long comments,
            long unlocks,
            long earnedCoins) {}
}
