package app.phumreader.support;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;

/** A clock tests can move forward (code expiry, token lifetimes, rate-limit windows). */
public class MutableClock extends Clock {

    private final AtomicReference<Instant> now = new AtomicReference<>(Instant.now());

    /** Jumps to {@code instant} (catalog tests pin the demo's "today"). */
    public void set(Instant instant) {
        now.set(instant);
    }

    public void advance(Duration duration) {
        now.updateAndGet(t -> t.plus(duration));
    }

    @Override
    public Instant instant() {
        return now.get();
    }

    @Override
    public ZoneId getZone() {
        return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return this;
    }
}
