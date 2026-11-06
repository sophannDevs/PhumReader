package app.phumreader.common.views;

import java.util.Map;

/**
 * Counts views between database writes. {@link #record} is cheap and de-duplicated per viewer; a
 * scheduled job {@link #drain}s the counts into PostgreSQL. In Redis when {@code
 * phumreader.redis.url} is set (counts survive a restart and add up across API instances),
 * otherwise in memory.
 */
public interface ViewCounter {

    /**
     * Counts one view of {@code key} unless the same viewer already counted within the de-dupe
     * window.
     *
     * @return whether the view was counted
     */
    boolean record(ViewKind kind, String key, String viewer);

    /** Takes all counts (and resets them to zero) in one step. */
    Map<String, Long> drain(ViewKind kind);

    /** Puts counts back after a failed database write. */
    void restore(ViewKind kind, Map<String, Long> counts);

    /** Forgets everything (tests). */
    void clear();
}
