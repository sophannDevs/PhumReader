package app.phumreader.notification.service;

import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Used while Firebase is not set up: counts what would have been sent and logs the first few. */
class NoopPushSender implements PushSender {

    private static final Logger log = LoggerFactory.getLogger(NoopPushSender.class);
    private final AtomicLong count = new AtomicLong();

    @Override
    public Outcome send(String token, Message message) {
        if (count.incrementAndGet() <= 3) {
            log.info(
                    "[dev push] \"{}\" -> {} (no Firebase credentials)",
                    message.title(),
                    message.link());
        }
        return Outcome.SENT;
    }
}
