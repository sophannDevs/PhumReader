package app.phumreader.notification.domain;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Which tab of the Notifications page an item belongs to (New episodes, Comments, Coins); {@code
 * SYSTEM} items show under All and Unread only.
 */
public enum NotificationKind {
    @JsonProperty("episode")
    EPISODE,
    @JsonProperty("comment")
    COMMENT,
    @JsonProperty("coins")
    COINS,
    @JsonProperty("system")
    SYSTEM
}
