package app.phumreader.notification.service;

import app.phumreader.config.AppProperties;
import app.phumreader.notification.repository.InboxQueries;
import app.phumreader.notification.repository.NotificationStore;
import app.phumreader.notification.repository.NotificationStore.Claimed;
import app.phumreader.notification.repository.NotificationStore.EpisodeInfo;
import app.phumreader.notification.repository.NotificationStore.Recipient;
import app.phumreader.notification.service.EmailSender.Mail;
import app.phumreader.notification.service.PushSender.Message;
import app.phumreader.notification.service.PushSender.Outcome;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * The notification worker (plan P3-16, V21-03): every active subscriber of the series (not its
 * creator) gets a "new episode" item in the in-app inbox; push and email then follow each
 * subscriber's alert settings for new episodes ({@code update}): push only when it is on and it is
 * not the subscriber's quiet hours (Asia/Phnom_Penh), email only when it is on and the address is
 * confirmed. Quiet hours never hold back the inbox item or the email.
 *
 * <p>Made not to slow the API: it runs on its own scheduler thread, never holds a database
 * transaction or row lock while it talks to the email or push service, takes subscribers in pages
 * of {@value #PAGE} (short queries on the subscription index), sends a page's push notices in
 * parallel on virtual threads (at most {@code phumreader.notifications.push-parallelism} at once)
 * and its emails in batches. After each page the position is saved, so a crash or a failed batch
 * continues where it stopped. Delivery is at least once: a page that failed half way can repeat
 * some notices. The inbox items of a page are written first, in one statement, and only once per
 * person and episode, so a repeated page adds none.
 */
@Service
public class NotificationDispatcher {

    static final int PAGE = 500;
    static final Duration LEASE = Duration.ofMinutes(10);
    static final ZoneId ZONE = ZoneId.of("Asia/Phnom_Penh");
    private static final Logger log = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final NotificationStore store;
    private final InboxQueries inbox;
    private final EmailSender email;
    private final PushSender push;
    private final Clock clock;
    private final String frontendUrl;
    private final boolean enabled;
    private final int pushParallelism;

    public NotificationDispatcher(
            NotificationStore store,
            InboxQueries inbox,
            EmailSender email,
            PushSender push,
            Clock clock,
            AppProperties properties,
            @Value("${phumreader.notifications.enabled:true}") boolean enabled,
            @Value("${phumreader.notifications.push-parallelism:32}") int pushParallelism) {
        this.store = store;
        this.inbox = inbox;
        this.email = email;
        this.push = push;
        this.clock = clock;
        this.frontendUrl = properties.frontendUrl().replaceAll("/+$", "");
        this.enabled = enabled;
        this.pushParallelism = Math.max(1, pushParallelism);
    }

    @Scheduled(
            fixedDelayString = "${phumreader.notifications.interval:5s}",
            initialDelayString = "20s")
    void onSchedule() {
        if (!enabled) {
            return;
        }
        try {
            while (processNext()) {
                // keep going while there are events
            }
        } catch (RuntimeException e) {
            log.warn("Notification round failed, will retry: {}", e.toString());
        }
    }

    /** Works on the oldest waiting event; {@code false} when there is none. */
    public boolean processNext() {
        Claimed claimed = store.claim(clock.instant(), LEASE);
        if (claimed == null) {
            return false;
        }
        try {
            int sent = handle(claimed);
            store.done(claimed.id());
            log.info("Notified {} subscribers about episode {}", sent, claimed.episodeId());
        } catch (RuntimeException e) {
            log.warn("Notifying about episode {} failed: {}", claimed.episodeId(), e.toString());
            store.failed(claimed.id(), e.toString());
        }
        return true;
    }

    private int handle(Claimed claimed) {
        EpisodeInfo episode = store.liveEpisode(claimed.episodeId());
        if (episode == null) {
            return 0; // unpublished or hidden since: nothing to announce
        }
        int total = 0;
        UUID after = claimed.after();
        while (true) {
            List<Recipient> page =
                    store.recipients(episode.seriesId(), episode.creatorId(), after, PAGE);
            if (page.isEmpty()) {
                return total;
            }
            inbox.episodePublished(
                    page.stream().map(Recipient::userId).toList(),
                    episode.episodeId(),
                    episode.seriesId(),
                    episode.number(),
                    clock.instant().atOffset(ZoneOffset.UTC));
            deliver(page, episode);
            total += page.size();
            after = page.getLast().userId();
            store.progress(claimed.id(), after, clock.instant(), LEASE);
        }
    }

    private void deliver(List<Recipient> page, EpisodeInfo episode) {
        boolean novel = episode.seriesType().equals("NOVEL");
        String path =
                (novel ? "/novel/" : "/read/") + episode.seriesSlug() + "/" + episode.number();
        List<Mail> mails = new ArrayList<>();
        Map<UUID, Message> pushes = new java.util.HashMap<>();
        int hour = clock.instant().atZone(ZONE).getHour();
        for (Recipient who : page) {
            boolean sendPush = who.push() && !who.quiet().covers(hour);
            boolean sendMail = who.mail() && who.emailVerified();
            if (!sendPush && !sendMail) {
                continue;
            }
            String prefix = "km".equals(who.language()) ? "/km" : "";
            var notice =
                    NotificationTexts.newEpisode(
                            who.language(),
                            episode.seriesTitle(),
                            novel,
                            episode.number(),
                            episode.title(),
                            frontendUrl + prefix + path,
                            frontendUrl + prefix + "/settings");
            if (sendMail) {
                mails.add(new Mail(who.email(), notice.title(), notice.emailBody()));
            }
            if (sendPush) {
                pushes.put(
                        who.userId(),
                        new Message(notice.title(), notice.body(), frontendUrl + prefix + path));
            }
        }
        if (!mails.isEmpty()) {
            email.sendAll(mails);
        }
        sendPushes(pushes, store.tokens(pushes.keySet()));
    }

    /** One request per browser, many at once; tokens the service says are gone are forgotten. */
    private void sendPushes(Map<UUID, Message> messages, Map<UUID, List<String>> tokens) {
        if (tokens.isEmpty()) {
            return;
        }
        ConcurrentLinkedQueue<String> gone = new ConcurrentLinkedQueue<>();
        Semaphore limit = new Semaphore(pushParallelism);
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<?>> running = new ArrayList<>();
            tokens.forEach((userId, userTokens) -> {
                Message message = messages.get(userId);
                for (String token : userTokens) {
                    running.add(
                            executor.submit(() -> {
                                limit.acquireUninterruptibly();
                                try {
                                    if (push.send(token, message) == Outcome.GONE) {
                                        gone.add(token);
                                    }
                                } finally {
                                    limit.release();
                                }
                            }));
                }
            });
            for (Future<?> f : running) {
                try {
                    f.get();
                } catch (Exception e) {
                    log.warn("A push notice failed: {}", e.toString());
                }
            }
        }
        store.deleteTokens(gone);
    }
}
