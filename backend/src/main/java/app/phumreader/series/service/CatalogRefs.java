package app.phumreader.series.service;

import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.service.CatalogViews.EpisodeAccess;
import app.phumreader.series.service.CatalogViews.EpisodeSummary;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Published series and released episodes as other features see them (reading, library, comments).
 * Not sent to the website as such.
 */
public final class CatalogRefs {

    private CatalogRefs() {}

    /**
     * A published series.
     *
     * @param latestFreeNumber the newest episode anyone can read now
     */
    public record SeriesRef(
            UUID id,
            String slug,
            String title,
            SeriesType type,
            UUID creatorId,
            SeriesCard card,
            @Nullable Integer latestFreeNumber) {}

    /** A released episode, with its access as of now. */
    public record EpisodeRef(
            UUID id,
            UUID seriesId,
            int number,
            EpisodeSummary summary,
            boolean commentsEnabled,
            @Nullable String creatorNote) {

        /** Fast Pass before its free date: only readers who unlocked it may read it. */
        public boolean needsUnlock() {
            return summary.access() == EpisodeAccess.FAST_PASS;
        }
    }

    /** An episode with its series (lists such as "Unlocked"). */
    public record EpisodeInSeries(SeriesCard series, EpisodeRef episode) {}
}
