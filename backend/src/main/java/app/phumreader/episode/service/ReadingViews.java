package app.phumreader.episode.service;

import app.phumreader.series.service.CatalogViews.EpisodeSummary;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What the reading endpoints return (plan P3-09). */
public final class ReadingViews {

    private ReadingViews() {}

    /**
     * An episode or chapter to read. Comics have {@code panels}, web novels have {@code blocks}.
     *
     * @param total released episodes of the series (free + Fast Pass)
     * @param previous the released episode before this one, if any
     * @param next the released episode after this one, if any (it may need an unlock)
     * @param panels comic images in reading order (empty for a web novel)
     * @param blocks chapter text (empty for a comic)
     * @param wordCount words in the chapter (0 for a comic)
     * @param comments visible comments on this episode
     * @param commentsEnabled whether the creator allows comments on this episode
     */
    public record EpisodeContent(
            SeriesCard series,
            EpisodeSummary episode,
            int total,
            @Nullable EpisodeSummary previous,
            @Nullable EpisodeSummary next,
            List<Panel> panels,
            List<NovelBlock> blocks,
            @Nullable String creatorNote,
            int wordCount,
            long comments,
            boolean commentsEnabled,
            ReaderState viewer) {}

    /**
     * One comic image.
     *
     * @param src image address (public path for the demo panels; signed URLs come with P3-08)
     */
    public record Panel(String src, int width, int height, String alt) {}

    /** A paragraph, a quote or a scene break ({@code text} is null for a scene break). */
    public record NovelBlock(BlockType type, @Nullable String text) {}

    /** Kinds of chapter text block. */
    public enum BlockType {
        @JsonProperty("paragraph")
        PARAGRAPH,
        @JsonProperty("quote")
        QUOTE,
        @JsonProperty("scene-break")
        SCENE_BREAK
    }

    /**
     * The signed-in reader's own state for this episode (all false when signed out).
     *
     * @param unlocked the reader unlocked this Fast Pass episode with coins
     */
    public record ReaderState(
            boolean signedIn, boolean liked, boolean bookmarked, boolean unlocked) {}

    /** An episode like after a change. */
    public record EpisodeLikeState(boolean liked, long likes) {}

    /** An episode bookmark after a change. */
    public record BookmarkState(boolean bookmarked) {}
}
