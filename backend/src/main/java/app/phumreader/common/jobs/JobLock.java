package app.phumreader.common.jobs;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Lets a scheduled job run on one API instance at a time, with the {@code shedlock} table (the
 * ShedLock layout, written here so no library has to follow Spring's releases).
 */
@Component
public class JobLock {

    private static final String INSTANCE = UUID.randomUUID().toString();

    private final JdbcClient jdbc;
    private final Clock clock;

    public JobLock(JdbcClient jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /**
     * Runs {@code job} when no other instance holds the lock {@code name}; the lock is held for at
     * most {@code atMost} and released when the job ends. Returns whether the job ran.
     */
    public boolean runExclusively(String name, Duration atMost, Runnable job) {
        Instant now = clock.instant();
        int acquired =
                jdbc.sql(
                                """
                                insert into shedlock (name, lock_until, locked_at, locked_by)
                                values (:name, :until, :now, :by)
                                on conflict (name) do update
                                set lock_until = excluded.lock_until, locked_at = excluded.locked_at,
                                    locked_by = excluded.locked_by
                                where shedlock.lock_until <= :now
                                """)
                        .param("name", name)
                        .param("until", java.sql.Timestamp.from(now.plus(atMost)))
                        .param("now", java.sql.Timestamp.from(now))
                        .param("by", INSTANCE)
                        .update();
        if (acquired == 0) {
            return false;
        }
        try {
            job.run();
        } finally {
            jdbc.sql("update shedlock set lock_until = :now where name = :name and locked_by = :by")
                    .param("now", java.sql.Timestamp.from(now))
                    .param("name", name)
                    .param("by", INSTANCE)
                    .update();
        }
        return true;
    }
}
