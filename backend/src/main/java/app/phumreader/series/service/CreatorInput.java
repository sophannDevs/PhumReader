package app.phumreader.series.service;

import app.phumreader.series.domain.AgeRating;
import app.phumreader.series.domain.SeriesStatus;
import app.phumreader.series.domain.SeriesType;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What creators send to create and edit series and episodes. */
public final class CreatorInput {

    private CreatorInput() {}

    /**
     * A series. The whole series is sent on every save (PUT replaces it): a field left out or null
     * takes its default, except the cover and banner, which stay when no new upload is sent.
     *
     * @param type comic or novel; required when creating, cannot change afterwards
     * @param genre genre slug
     * @param secondGenre an optional second genre slug, not the main one (400 {@code unknown_genre}
     *     / {@code same_as_genre})
     * @param languages "en" and / or "km"
     * @param ageRating all, teen (13+), teen16 (16+) or mature (18+); default all
     * @param updateDays the days new episodes come out, each at most once (400 {@code
     *     duplicate_day}); null or empty: no schedule. Stored and sent back in week order (Mon
     *     first)
     * @param releaseHour the hour new episodes come out, 0-23 in Asia/Phnom_Penh; null: not set
     * @param fastPass the series' Fast Pass: the defaults for new episodes; null: on, 3 ahead
     * @param commentsEnabled readers may comment on the series page and its episodes; default on
     * @param status ongoing, completed or hiatus; default ongoing
     * @param breakMessage the "On break" message (up to 120 characters), kept only while the status
     *     is hiatus; dropped otherwise
     * @param coverUploadId a finished COVER upload
     * @param bannerUploadId a finished BANNER upload
     */
    public record SeriesInput(
            @NotBlank @Size(max = 120) String title,
            @Nullable SeriesType type,
            @NotBlank String genre,
            @Nullable String secondGenre,
            @NotEmpty List<@Pattern(regexp = "en|km") String> languages,
            @Nullable @Size(max = 2000) String summary,
            @Nullable AgeRating ageRating,
            @Nullable @Size(max = 7) List<@NotNull Weekday> updateDays,
            @Nullable @Min(0) @Max(23) Integer releaseHour,
            @Nullable @Valid SeriesFastPass fastPass,
            @Nullable Boolean commentsEnabled,
            @Nullable SeriesStatus status,
            @Nullable @Size(max = 120) String breakMessage,
            @Nullable @Size(max = 10) List<@NotBlank @Size(max = 30) String> tags,
            @Nullable UUID coverUploadId,
            @Nullable UUID bannerUploadId) {}

    /**
     * The series' Fast Pass switch (V21-02): the defaults of new episodes. On: a new episode is
     * Fast Pass by default, free after {@code ahead} × 7 ÷ the number of update days (rounded up)
     * days. Off: new episodes are free by default. Episodes already out never change.
     *
     * @param on new episodes are Fast Pass by default
     * @param ahead how many episodes readers can buy ahead, 1-5
     */
    public record SeriesFastPass(@NotNull Boolean on, @NotNull @Min(1) @Max(5) Integer ahead) {}

    public enum PublishMode {
        /** Keep it as a draft. */
        @JsonProperty("draft")
        DRAFT,
        /** Go live now. */
        @JsonProperty("now")
        NOW,
        /** Go live at {@code at}. */
        @JsonProperty("scheduled")
        SCHEDULED
    }

    /**
     * @param at the time to go live (an instant; the website shows it in Asia/Phnom_Penh)
     */
    public record Publish(@NotNull PublishMode mode, @Nullable Instant at) {}

    /**
     * Fast Pass (A3): readers pay coins until {@code freeAfterDays} days after release.
     *
     * @param priceCoins 3 to 10 (default 5)
     * @param freeAfterDays 1 to 90 (default 7)
     */
    public record FastPass(
            @Nullable @Min(3) @Max(10) Integer priceCoins,
            @Nullable @Min(1) @Max(90) Integer freeAfterDays) {}

    /**
     * A block of chapter text.
     *
     * @param type paragraph, heading, quote or scene-break
     */
    public record Block(
            @NotBlank @Pattern(regexp = "paragraph|heading|quote|scene-break") String type,
            @Nullable @Size(max = 20000) String text) {}

    /**
     * An episode (comic) or chapter (novel).
     *
     * @param number {@code null}: the next free number
     * @param thumbnailUploadId a finished THUMBNAIL upload
     * @param fastPass {@code null}: free for everyone (unless {@code useSeriesFastPass}); {@code
     *     {}}: Fast Pass with the defaults 5 coins and 7 days
     * @param useSeriesFastPass {@code true} (new episodes only): take Fast Pass from the series'
     *     switch instead of {@code fastPass}, which must then be null. Series Fast Pass on: 5
     *     coins, free after ceil(ahead × 7 ÷ max(1, update days)) days; off: free. {@code null} or
     *     {@code false}: {@code fastPass} decides, as before
     * @param imageUploadIds comics: finished PANEL uploads in reading order (at most 100)
     * @param blocks novels: the chapter text
     */
    public record EpisodeInput(
            @NotBlank @Size(max = 120) String title,
            @Nullable @Min(1) Integer number,
            @Nullable UUID thumbnailUploadId,
            @Nullable @Size(max = 1000) String creatorNote,
            @Nullable Boolean commentsEnabled,
            @Nullable @Valid FastPass fastPass,
            @Nullable Boolean useSeriesFastPass,
            @NotNull @Valid Publish publish,
            @Nullable @Size(max = 100) List<UUID> imageUploadIds,
            @Nullable @Size(max = 2000) List<@Valid Block> blocks) {}
}
