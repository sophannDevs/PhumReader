package app.phumreader.common.ratelimit;

import app.phumreader.common.error.RateLimitedException;
import java.time.Duration;
import java.util.Optional;

/**
 * Counts events per key in fixed time windows (for example wrong passwords per email). In Redis
 * when {@code phumreader.redis.url} is set (limits hold across API instances), otherwise in memory.
 */
public interface RateLimiter {

    /** How long until {@code key} may be used again, when it already reached {@code limit}. */
    Optional<Duration> blocked(String key, int limit);

    /**
     * Counts one event for {@code key}; a new window of {@code window} starts when none is open.
     */
    void hit(String key, Duration window);

    /** Forgets {@code key} (for example after a successful login). */
    void reset(String key);

    /** Forgets everything (tests). */
    void clear();

    /**
     * Counts one event, or throws 429 with the retry time when {@code key} is already at {@code
     * limit}.
     */
    default void acquire(String key, int limit, Duration window, String code) {
        Optional<Duration> wait = blocked(key, limit);
        if (wait.isPresent()) {
            throw new RateLimitedException(code, wait.get());
        }
        hit(key, window);
    }
}
