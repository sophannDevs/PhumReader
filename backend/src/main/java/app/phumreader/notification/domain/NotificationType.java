package app.phumreader.notification.domain;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Locale;

/**
 * What happened. The website turns the type and the item's values into English or Khmer text; the
 * stored and sent key is the lower-case name (e.g. {@code order_paid}).
 */
public enum NotificationType {
    /** A subscribed series has a new episode (the P3-16 dispatcher). */
    @JsonProperty("episode_published")
    EPISODE_PUBLISHED(NotificationKind.EPISODE),
    /** Someone else liked your comment; one item per comment and day with the count. */
    @JsonProperty("comment_liked")
    COMMENT_LIKED(NotificationKind.COMMENT),
    /** A coin order was paid and its coins credited. */
    @JsonProperty("order_paid")
    ORDER_PAID(NotificationKind.COINS),
    /** An admin refunded a coin order; its coins left the wallet. */
    @JsonProperty("order_refunded")
    ORDER_REFUNDED(NotificationKind.COINS),
    /** Your report was handled (the content may have been taken down). */
    @JsonProperty("report_resolved")
    REPORT_RESOLVED(NotificationKind.SYSTEM),
    /** Your report was looked at and nothing was wrong. */
    @JsonProperty("report_dismissed")
    REPORT_DISMISSED(NotificationKind.SYSTEM),
    /** An admin approved your series: it is live. */
    @JsonProperty("series_approved")
    SERIES_APPROVED(NotificationKind.SYSTEM),
    /** An admin asked for changes to your series. */
    @JsonProperty("series_changes")
    SERIES_CHANGES(NotificationKind.SYSTEM),
    /** An admin turned your series down; it is a draft again. */
    @JsonProperty("series_rejected")
    SERIES_REJECTED(NotificationKind.SYSTEM),
    /** The account's email was confirmed. */
    @JsonProperty("welcome")
    WELCOME(NotificationKind.SYSTEM);

    private final NotificationKind kind;

    NotificationType(NotificationKind kind) {
        this.kind = kind;
    }

    public NotificationKind kind() {
        return kind;
    }

    /** The stored and sent key, e.g. {@code order_paid}. */
    public String key() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static NotificationType ofKey(String key) {
        return valueOf(key.toUpperCase(Locale.ROOT));
    }
}
