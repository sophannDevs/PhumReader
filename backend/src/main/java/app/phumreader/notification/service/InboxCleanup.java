package app.phumreader.notification.service;

import app.phumreader.common.jobs.JobLock;
import app.phumreader.notification.repository.InboxQueries;
import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Nightly clean-up of the inbox (V21-03), at 03:45 in Phnom Penh on one API instance ({@link
 * JobLock}): items removed more than 7 days ago (past Undo and restore) and read items older than
 * 90 days are deleted, in batches so no long lock is held.
 */
@Service
public class InboxCleanup {

    /** How long a removed item can still be restored. */
    public static final Duration KEEP_REMOVED = Duration.ofDays(7);

    /** How long a read item stays in the inbox. */
    public static final Duration KEEP_READ = Duration.ofDays(90);

    static final int BATCH = 5_000;
    private static final Logger log = LoggerFactory.getLogger(InboxCleanup.class);

    private final InboxQueries queries;
    private final JobLock lock;
    private final Clock clock;

    public InboxCleanup(InboxQueries queries, JobLock lock, Clock clock) {
        this.queries = queries;
        this.lock = lock;
        this.clock = clock;
    }

    @Scheduled(cron = "0 45 3 * * *", zone = "Asia/Phnom_Penh")
    public void nightly() {
        lock.runExclusively("notifications-cleanup", Duration.ofMinutes(30), this::run);
    }

    /** Deletes what is due now; returns how many items went. */
    public int run() {
        OffsetDateTime now = clock.instant().atOffset(ZoneOffset.UTC);
        OffsetDateTime removedBefore = now.minus(KEEP_REMOVED);
        OffsetDateTime readBefore = now.minus(KEEP_READ);
        int total = 0;
        int deleted;
        do {
            deleted = queries.deleteExpired(removedBefore, readBefore, BATCH);
            total += deleted;
        } while (deleted == BATCH);
        if (total > 0) {
            log.info("Deleted {} old notifications", total);
        }
        return total;
    }
}
