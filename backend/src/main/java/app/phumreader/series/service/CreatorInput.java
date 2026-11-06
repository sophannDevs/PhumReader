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
     * A series.
     *
     * @param type comic or novel; required when creating, cannot change afterwards
     * @param genre genre slug
     * @param languages "en" and / or "km"
     * @param coverUploadId a finished COVER upload
     * @param bannerUploadId a finished BANNER upload
     */
    public record SeriesInput(
            @NotBlank @Size(max = 120) String title,
            @Nullable SeriesType type,
            @NotBlank String genre,
            @NotEmpty List<@Pattern(regexp = "en|km") String> languages,
            @Nullable @Size(max = 2000) String summary,
            @Nullable AgeRating ageRating,
            @Nullable Weekday updateDay,
            @Nullable SeriesStatus status,
            @Nullable @Size(max = 10) List<@NotBlank @Size(max = 30) String> tags,
            @Nullable UUID coverUploadId,
            @Nullable UUID bannerUploadId) {}

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
     * @param fastPass {@code null}: free for everyone
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
            @NotNull @Valid Publish publish,
            @Nullable @Size(max = 100) List<UUID> imageUploadIds,
            @Nullable @Size(max = 2000) List<@Valid Block> blocks) {}
}
