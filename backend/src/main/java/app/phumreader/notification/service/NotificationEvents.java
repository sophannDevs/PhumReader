package app.phumreader.notification.service;

import app.phumreader.notification.repository.NotificationStore;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Tells the notification worker that an episode went live. Call in the same transaction as the
 * publish, so the notice exists exactly when the episode does. (The scheduler that sends the
 * notices can be switched off with {@code phumreader.notifications.enabled=false}; events still
 * queue.)
 */
@Service
public class NotificationEvents {

    private final NotificationStore store;

    public NotificationEvents(NotificationStore store) {
        this.store = store;
    }

    public void episodePublished(UUID episodeId) {
        store.episodePublished(episodeId);
    }
}
