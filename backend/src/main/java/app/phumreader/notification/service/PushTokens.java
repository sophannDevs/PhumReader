package app.phumreader.notification.service;

import app.phumreader.notification.repository.NotificationStore;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A reader's browsers that agreed to web push. */
@Service
@Transactional
public class PushTokens {

    private final NotificationStore store;

    public PushTokens(NotificationStore store) {
        this.store = store;
    }

    /** Saves the browser's token; asking again, or from another account, just moves it. */
    public void register(UUID userId, String token) {
        store.saveToken(userId, token);
    }

    /** Forgets the token ({@code false} when it was not this account's). */
    public boolean unregister(UUID userId, String token) {
        return store.deleteToken(userId, token) > 0;
    }
}
