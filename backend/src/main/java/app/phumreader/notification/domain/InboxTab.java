package app.phumreader.notification.domain;

import java.util.Locale;
import org.jspecify.annotations.Nullable;

/** The tabs of the Notifications page. */
public enum InboxTab {
    ALL(null),
    UNREAD(null),
    EPISODES(NotificationKind.EPISODE),
    COMMENTS(NotificationKind.COMMENT),
    COINS(NotificationKind.COINS);

    private final @Nullable NotificationKind kind;

    InboxTab(@Nullable NotificationKind kind) {
        this.kind = kind;
    }

    /** The kind the tab shows, or {@code null} for every kind. */
    public @Nullable NotificationKind kind() {
        return kind;
    }

    /** The {@code ?tab=} value. */
    public String key() {
        return name().toLowerCase(Locale.ROOT);
    }
}
