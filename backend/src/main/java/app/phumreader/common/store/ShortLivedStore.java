package app.phumreader.common.store;

import java.time.Instant;
import java.util.Optional;

/**
 * Small values that expire by themselves: email codes and password-reset tokens. In memory for now;
 * a Redis version comes with Stage 1 Step 3 (values survive an API restart there).
 */
public interface ShortLivedStore {

    /** Stores {@code value} under {@code key} until {@code expiresAt}. */
    void put(String key, String value, Instant expiresAt);

    /** The value, if it is there and has not expired. */
    Optional<String> get(String key);

    void remove(String key);

    /** Forgets everything (tests). */
    void clear();
}
