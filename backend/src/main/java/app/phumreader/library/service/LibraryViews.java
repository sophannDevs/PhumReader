package app.phumreader.library.service;

import app.phumreader.series.service.CatalogViews.EpisodeSummary;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the library endpoints return (plan P3-12). */
public final class LibraryViews {

    private LibraryViews() {}

    /** A subscription after a change. */
    public record SubscriptionState(boolean subscribed, long subscribers) {}

    /** A creator follow after a change. */
    public record FollowState(boolean following, long followers) {}

    /**
     * The signed-in reader's own state on a series page.
     *
     * @param lastRead highest episode number opened (0 when none): "✓ Read" marks
     * @param lastEpisode the episode opened last ("Continue episode N"), if any
     * @param progress how far into {@code lastEpisode}, 0 to 1
     * @param unlocked Fast Pass episode numbers the reader unlocked
     */
    public record SeriesViewer(
            boolean subscribed,
            boolean followingCreator,
            int lastRead,
            @Nullable Integer lastEpisode,
            @Nullable Double progress,
            List<Integer> unlocked) {}

    /**
     * Continue reading / Recently read.
     *
     * @param series the series' slug
     * @param episode the episode opened last
     * @param progress how far into it, 0 to 1
     * @param lastRead highest episode number opened
     */
    public record HistoryEntry(
            String series,
            int episode,
            double progress,
            int lastRead,
            Instant readAt,
            SeriesCard seriesData) {}

    public record SubscriptionEntry(Instant subscribedAt, SeriesCard series) {}

    /**
     * An episode the reader unlocked with coins.
     *
     * @param coins the coins the unlock actually cost (the price at the time; prices can change
     *     later)
     */
    public record UnlockedEntry(
            Instant unlockedAt, SeriesCard series, EpisodeSummary episode, int coins) {}

    public record FollowedCreator(UUID id, String name, long seriesCount, Instant followedAt) {}

    /** A removed subscription; send it back to {@code /me/subscriptions/restore} to undo. */
    public record RemovedSubscription(@NotNull UUID seriesId, @NotNull Instant subscribedAt) {}

    public record RemovedSubscriptions(List<RemovedSubscription> items) {}

    /** A removed history entry; send it back to {@code /me/history/restore} to undo. */
    public record RemovedHistoryEntry(
            @NotNull UUID seriesId,
            @NotNull @Min(1) Integer episode,
            @NotNull @DecimalMin("0") @DecimalMax("1") Double progress,
            @NotNull @Min(1) Integer lastRead,
            @NotNull Instant readAt) {}

    public record RemovedHistory(List<RemovedHistoryEntry> items) {}
}
