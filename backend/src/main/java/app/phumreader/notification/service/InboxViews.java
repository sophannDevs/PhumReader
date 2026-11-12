package app.phumreader.notification.service;

import app.phumreader.notification.domain.NotificationKind;
import app.phumreader.notification.domain.NotificationType;
import app.phumreader.series.domain.SeriesType;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the inbox endpoints return (V21-03). */
public final class InboxViews {

    private InboxViews() {}

    /**
     * One item of the Notifications page. The website writes the text from {@code type} and the
     * values in {@code data}, in English or Khmer:
     *
     * <ul>
     *   <li>{@code episode_published}: {@code {}} (series and episode say which)
     *   <li>{@code comment_liked}: {@code {commentId, count}}: how many people liked the comment
     *       that day (Asia/Phnom_Penh)
     *   <li>{@code order_paid} / {@code order_refunded}: {@code {orderNumber, coins}}: the coins
     *       credited (pack, bonus and first-purchase bonus) or taken back
     *   <li>{@code report_resolved} / {@code report_dismissed}: {@code {reportId, targetType,
     *       hidden}}: {@code targetType} {@code series}, {@code episode}, {@code comment} or {@code
     *       user} (an account); {@code hidden} when the content was taken down (never for an
     *       account)
     *   <li>{@code series_approved}: {@code {}}; {@code series_changes}: {@code {items, note}} (the
     *       review item keys, e.g. {@code cover}); {@code series_rejected}: {@code {note}}
     *   <li>{@code welcome}: {@code {}}
     * </ul>
     *
     * @param kind the tab: {@code episode}, {@code comment}, {@code coins}; {@code system} shows
     *     under All and Unread only
     * @param createdAt when it happened (for {@code comment_liked}: the latest like)
     * @param series the series the item opens, or null
     * @param episode the episode (or chapter) number the item is about, or null
     */
    public record NotificationItem(
            UUID id,
            NotificationKind kind,
            NotificationType type,
            Instant createdAt,
            boolean read,
            @Nullable NotificationSeries series,
            @Nullable Integer episode,
            Map<String, Object> data) {}

    /**
     * @param id for the creator's Manage series page
     * @param slug for the reader's pages
     * @param type comic episodes open in /read, novel chapters in /novel
     */
    public record NotificationSeries(UUID id, String slug, String title, SeriesType type) {}

    /**
     * @param count unread items that were not removed (the bell)
     */
    public record UnreadCount(long count) {}
}
