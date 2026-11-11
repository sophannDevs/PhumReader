package app.phumreader.episode.service;

import app.phumreader.common.error.LockedException;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.episode.repository.ReadingQueries;
import app.phumreader.episode.repository.ReadingQueries.ChapterRow;
import app.phumreader.episode.service.ReadingViews.BookmarkState;
import app.phumreader.episode.service.ReadingViews.EpisodeContent;
import app.phumreader.episode.service.ReadingViews.EpisodeLikeState;
import app.phumreader.episode.service.ReadingViews.NovelBlock;
import app.phumreader.episode.service.ReadingViews.Panel;
import app.phumreader.episode.service.ReadingViews.ReaderState;
import app.phumreader.media.service.ImageUrlSigner;
import app.phumreader.series.domain.SeriesType;
import app.phumreader.series.service.CatalogRefs.EpisodeRef;
import app.phumreader.series.service.CatalogRefs.SeriesRef;
import app.phumreader.series.service.CatalogService;
import app.phumreader.user.domain.Role;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reading (plan P3-09): episode content only when it is free, its Fast Pass free date has passed,
 * the reader unlocked it, or the reader is its creator or an admin; otherwise 402 with the price
 * and the free date. Also reading progress, likes and bookmarks.
 */
@Service
public class ReadingService {

    private final CatalogService catalog;
    private final ReadingQueries queries;
    private final JsonMapper json;
    private final Clock clock;
    private final ImageUrlSigner imageUrls;

    public ReadingService(
            CatalogService catalog,
            ReadingQueries queries,
            JsonMapper json,
            Clock clock,
            ImageUrlSigner imageUrls) {
        this.imageUrls = imageUrls;
        this.catalog = catalog;
        this.queries = queries;
        this.json = json;
        this.clock = clock;
    }

    /** How a reader may read an episode. */
    public enum Access {
        /** Free for everyone (never Fast Pass, or its free date has passed). */
        FREE,
        /** The reader unlocked it with coins. */
        UNLOCKED,
        /** The creator of the series, or an admin. */
        OWNER
    }

    /** The episode to read; 404 for an unknown series or episode, 402 when it is locked. */
    public EpisodeContent content(String slug, int number, @Nullable CurrentUser user) {
        SeriesRef series = catalog.require(slug);
        EpisodeRef episode = catalog.requireEpisode(series, number);
        Access access = requireAccess(series, episode, user);

        boolean comic = series.type() == SeriesType.COMIC;
        List<Panel> panels =
                comic
                        ? queries.panels(episode.id()).stream()
                                .map(p ->
                                        new Panel(
                                                imageUrls.signStored(p.storageKey()),
                                                p.width(),
                                                p.height(),
                                                p.alt()))
                                .toList()
                        : List.of();
        ChapterRow chapter = comic ? null : queries.chapter(episode.id()).orElse(null);
        List<NovelBlock> blocks =
                chapter == null
                        ? List.of()
                        : List.of(json.readValue(chapter.blocksJson(), NovelBlock[].class));

        ReaderState viewer =
                user == null
                        ? new ReaderState(false, false, false, false)
                        : new ReaderState(
                                true,
                                queries.liked(user.id(), episode.id()),
                                queries.bookmarked(user.id(), episode.id()),
                                access == Access.UNLOCKED);
        return new EpisodeContent(
                series.card(),
                episode.summary(),
                series.card().totalEpisodes(),
                catalog.neighbour(series, number, true).map(EpisodeRef::summary).orElse(null),
                catalog.neighbour(series, number, false).map(EpisodeRef::summary).orElse(null),
                panels,
                blocks,
                episode.creatorNote(),
                chapter == null ? 0 : chapter.wordCount(),
                queries.visibleComments(episode.id()),
                episode.commentsEnabled() && series.commentsEnabled(),
                viewer);
    }

    /**
     * The episode, when the reader may read it (comments, likes and progress need this too).
     *
     * @throws LockedException 402 {@code episode_locked} with the price and the free date
     */
    public EpisodeRef requireReadable(SeriesRef series, int number, @Nullable CurrentUser user) {
        EpisodeRef episode = catalog.requireEpisode(series, number);
        requireAccess(series, episode, user);
        return episode;
    }

    /** Saves where the reader is: the episode opened and how far into it (0..1). */
    @Transactional
    public void saveProgress(CurrentUser user, String slug, int number, double progress) {
        SeriesRef series = catalog.require(slug);
        EpisodeRef episode = requireReadable(series, number, user);
        queries.saveProgress(user.id(), series.id(), episode.id(), number, (float) progress, now());
    }

    @Transactional
    public EpisodeLikeState like(CurrentUser user, String slug, int number, boolean liked) {
        EpisodeRef episode = requireReadable(catalog.require(slug), number, user);
        if (liked) {
            queries.like(user.id(), episode.id(), now());
        } else {
            queries.unlike(user.id(), episode.id());
        }
        return new EpisodeLikeState(liked, queries.episodeLikes(episode.id()));
    }

    @Transactional
    public BookmarkState bookmark(CurrentUser user, String slug, int number, boolean bookmarked) {
        EpisodeRef episode = requireReadable(catalog.require(slug), number, user);
        if (bookmarked) {
            queries.bookmark(user.id(), episode.id(), now());
        } else {
            queries.unbookmark(user.id(), episode.id());
        }
        return new BookmarkState(bookmarked);
    }

    private Access requireAccess(SeriesRef series, EpisodeRef episode, @Nullable CurrentUser user) {
        if (!episode.needsUnlock()) {
            return Access.FREE;
        }
        if (user != null) {
            if (user.id().equals(series.creatorId()) || user.hasRole(Role.ADMIN.name())) {
                return Access.OWNER;
            }
            if (queries.hasUnlock(user.id(), episode.id())) {
                return Access.UNLOCKED;
            }
        }
        Integer price = episode.summary().price();
        throw new LockedException(
                "episode_locked",
                "Unlock this episode with coins, or wait until it is free.",
                price == null ? 0 : price,
                episode.summary().date());
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }
}
