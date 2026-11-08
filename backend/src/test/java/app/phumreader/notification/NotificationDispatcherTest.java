package app.phumreader.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.notification.service.EmailSender;
import app.phumreader.notification.service.NotificationDispatcher;
import app.phumreader.notification.service.PushSender;
import app.phumreader.support.IntegrationTest;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

/**
 * New-episode notices (plan P3-16) against the real database with fake email and push services. The
 * data is committed (the dispatcher uses its own connections), so every test cleans up.
 */
@IntegrationTest
@Import(NotificationDispatcherTest.Fakes.class)
class NotificationDispatcherTest {

    /** Email that records every batch; can fail the n-th batch and be slow. */
    static class FakeEmail implements EmailSender {
        final List<List<Mail>> batches = new CopyOnWriteArrayList<>();
        volatile int failOnBatch = -1;
        volatile long millisPerBatch;

        @Override
        public void send(String to, String subject, String body) {
            sendAll(List.of(new Mail(to, subject, body)));
        }

        @Override
        public void sendAll(List<Mail> mails) {
            int n = batches.size() + 1;
            if (n == failOnBatch) {
                throw new IllegalStateException("provider is down");
            }
            sleep(millisPerBatch);
            batches.add(List.copyOf(mails));
        }

        List<Mail> all() {
            return batches.stream().flatMap(List::stream).toList();
        }
    }

    /** Push that records tokens; tokens starting with "gone-" are reported gone. */
    static class FakePush implements PushSender {
        final Map<String, Message> sent = new ConcurrentHashMap<>();
        final AtomicInteger calls = new AtomicInteger();
        volatile long millisPerCall;

        @Override
        public Outcome send(String token, Message message) {
            calls.incrementAndGet();
            sleep(millisPerCall);
            if (token.startsWith("gone-")) {
                return Outcome.GONE;
            }
            sent.put(token, message);
            return Outcome.SENT;
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class Fakes {
        @Bean
        @Primary
        FakeEmail fakeEmail() {
            return new FakeEmail();
        }

        @Bean
        @Primary
        FakePush fakePush() {
            return new FakePush();
        }
    }

    private static void sleep(long millis) {
        if (millis > 0) {
            try {
                Thread.sleep(millis);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @Autowired JdbcClient jdbc;
    @Autowired NotificationDispatcher dispatcher;
    @Autowired FakeEmail email;
    @Autowired FakePush push;
    @Autowired MockMvc mvc;

    UUID creator;
    UUID series;
    UUID episode;

    @BeforeEach
    void aSeriesWithAnEpisode() {
        cleanUp();
        email.batches.clear();
        email.failOnBatch = -1;
        email.millisPerBatch = 0;
        push.sent.clear();
        push.calls.set(0);
        push.millisPerCall = 0;

        creator = user("notif-creator@perf.test", true, "ACTIVE");
        jdbc.sql(
                        "insert into creator_profiles (user_id, pen_name, accepted_terms_at)"
                                + " values (:id, 'Pen', now())")
                .param("id", creator)
                .update();
        jdbc.sql(
                        "insert into genres (id, slug, name, position) values (32000, 'notif-test',"
                                + " 'Notif Test', 99) on conflict do nothing")
                .update();
        series = UUID.randomUUID();
        jdbc.sql(
                        "insert into series (id, slug, creator_id, type, title, genre_id, visibility,"
                                + " launched_at) values (:id, :slug, :creator, 'COMIC', 'Glass Tide',"
                                + " 32000, 'PUBLISHED', now())")
                .param("id", series)
                .param("slug", "notif-" + series)
                .param("creator", creator)
                .update();
        episode = UUID.randomUUID();
        jdbc.sql(
                        "insert into episodes (id, series_id, number, title, status, published_at)"
                                + " values (:id, :series, 7, 'The Tide Turns', 'PUBLISHED', now())")
                .param("id", episode)
                .param("series", series)
                .update();
    }

    @AfterEach
    void cleanUp() {
        jdbc.sql("delete from outbox_events where topic = 'NOTIFICATION'").update();
        jdbc.sql("delete from series where slug like 'notif-%'").update();
        jdbc.sql(
                        "delete from creator_profiles where user_id in"
                                + " (select id from users where email like 'notif-%@perf.test')")
                .update();
        jdbc.sql("delete from users where email like 'notif-%@perf.test'").update();
        // Only the genre this test made: the catalog tests compare the genre list with the demo.
        jdbc.sql("delete from genres where id = 32000").update();
    }

    @Test
    void subscribersGetEmailAndPushUnlessTheySwitchedItOffOrCannotBeReached() {
        UUID reader = user("notif-reader@perf.test", true, "ACTIVE");
        UUID khmer = user("notif-khmer@perf.test", true, "ACTIVE");
        UUID optedOut = user("notif-optout@perf.test", true, "ACTIVE");
        UUID unverified = user("notif-unverified@perf.test", false, "ACTIVE");
        UUID banned = user("notif-banned@perf.test", true, "BANNED");
        UUID outsider = user("notif-outsider@perf.test", true, "ACTIVE");
        for (UUID u : List.of(reader, khmer, optedOut, unverified, banned, creator)) {
            subscribe(u);
        }
        settings(khmer, "km", true);
        settings(optedOut, "en", false);
        token(reader, "tok-reader-1");
        token(reader, "tok-reader-2");
        token(khmer, "tok-khmer");
        token(optedOut, "tok-optout");
        token(outsider, "tok-outsider");
        token(unverified, "tok-unverified");
        queue(episode);

        assertThat(dispatcher.processNext()).isTrue();
        assertThat(dispatcher.processNext()).as("nothing else waits").isFalse();

        // Email: verified, active subscribers who did not switch it off; never the creator.
        assertThat(email.all())
                .extracting(EmailSender.Mail::to)
                .containsExactlyInAnyOrder("notif-reader@perf.test", "notif-khmer@perf.test");
        EmailSender.Mail english =
                email.all().stream()
                        .filter(m -> m.to().contains("reader"))
                        .findFirst()
                        .orElseThrow();
        assertThat(english.subject()).isEqualTo("New episode: Glass Tide");
        assertThat(english.body())
                .contains("Episode 7 – The Tide Turns is out")
                .contains("http://localhost:3000/read/notif-" + series + "/7")
                .contains("http://localhost:3000/settings");
        EmailSender.Mail km =
                email.all().stream()
                        .filter(m -> m.to().contains("khmer"))
                        .findFirst()
                        .orElseThrow();
        assertThat(km.subject()).startsWith("ភាគថ្មី៖");
        assertThat(km.body()).contains("http://localhost:3000/km/read/notif-" + series + "/7");

        // Push: every token of those people, also of the unverified one (push needs no email).
        assertThat(push.sent.keySet())
                .containsExactlyInAnyOrder(
                        "tok-reader-1", "tok-reader-2", "tok-khmer", "tok-unverified");
        assertThat(processed(episode)).isTrue();
    }

    @Test
    void anEpisodeThatIsNoLongerLiveSendsNothing() {
        subscribe(user("notif-reader@perf.test", true, "ACTIVE"));
        jdbc.sql("update episodes set status = 'DRAFT' where id = :id")
                .param("id", episode)
                .update();
        queue(episode);

        dispatcher.processNext();

        assertThat(email.all()).isEmpty();
        assertThat(processed(episode)).isTrue();
    }

    @Test
    void tokensThePushServiceReportsGoneAreForgotten() {
        UUID reader = user("notif-reader@perf.test", true, "ACTIVE");
        subscribe(reader);
        token(reader, "gone-old-browser");
        token(reader, "tok-new-browser");
        queue(episode);

        dispatcher.processNext();

        assertThat(push.sent.keySet()).containsExactly("tok-new-browser");
        assertThat(
                        jdbc.sql("select token from push_tokens where user_id = :u")
                                .param("u", reader)
                                .query(String.class)
                                .list())
                .containsExactly("tok-new-browser");
    }

    @Test
    void aFailedBatchResumesWhereItStoppedAndNobodyIsNotifiedTwiceUpToThatPage() {
        // 1,200 subscribers = 3 pages of 500; the e-mail service fails on the 3rd.
        int n = 1_200;
        subscribers(n);
        email.failOnBatch = 3;
        queue(episode);

        dispatcher.processNext();

        assertThat(email.all()).hasSize(1_000);
        assertThat(processed(episode)).as("left for another try").isFalse();
        assertThat(attempts(episode)).isEqualTo(1);

        email.failOnBatch = -1;
        dispatcher.processNext();

        assertThat(email.all()).hasSize(n);
        assertThat(email.all().stream().map(EmailSender.Mail::to).distinct()).hasSize(n);
        assertThat(processed(episode)).isTrue();
    }

    @Test
    void tenThousandSubscribersAreNotifiedInWellUnderFiveMinutesWithoutBlockingTheApi()
            throws Exception {
        int n = 10_000;
        subscribers(n);
        // Push: 1 ms per call and 32 at once; e-mail: 20 ms per batch of 500 (a slow provider).
        push.millisPerCall = 1;
        email.millisPerBatch = 20;
        queue(episode);

        List<Long> apiMillis = Collections.synchronizedList(new ArrayList<>());
        Thread api =
                Thread.ofPlatform()
                        .start(() -> {
                            // The website keeps asking the API while the worker runs.
                            while (!processed(episode)) {
                                long t = System.nanoTime();
                                try {
                                    mvc.perform(get("/api/v1/health")).andExpect(status().isOk());
                                } catch (Exception e) {
                                    throw new IllegalStateException(e);
                                }
                                apiMillis.add((System.nanoTime() - t) / 1_000_000);
                            }
                        });
        long start = System.nanoTime();
        dispatcher.processNext();
        Duration took = Duration.ofNanos(System.nanoTime() - start);
        api.join(10_000);

        assertThat(email.all()).hasSize(n);
        assertThat(push.sent).hasSize(n);
        assertThat(took).as("10,000 subscribers").isLessThan(Duration.ofMinutes(5));
        Collections.sort(apiMillis);
        long worst = apiMillis.isEmpty() ? 0 : apiMillis.getLast();
        System.out.printf(
                "[P3-16] %d subscribers notified in %d ms; %d API calls meanwhile, slowest %d ms%n",
                n, took.toMillis(), apiMillis.size(), worst);
        assertThat(worst).as("slowest API call while the worker runs (ms)").isLessThan(2_000);
    }

    // ---------- helpers ----------

    private UUID user(String address, boolean verified, String status) {
        UUID id = UUID.randomUUID();
        jdbc.sql(
                        "insert into users (id, email, email_verified_at, display_name, status)"
                                + " values (:id, :email, "
                                + (verified ? "now()" : "null")
                                + ", 'Reader', :status)")
                .param("id", id)
                .param("email", address)
                .param("status", status)
                .update();
        return id;
    }

    private void subscribe(UUID user) {
        jdbc.sql("insert into subscriptions (user_id, series_id) values (:u, :s)")
                .param("u", user)
                .param("s", series)
                .update();
    }

    private void settings(UUID user, String language, boolean newEpisodes) {
        jdbc.sql(
                        "insert into user_settings (user_id, language, notify_new_episodes)"
                                + " values (:u, :l, :n)")
                .param("u", user)
                .param("l", language)
                .param("n", newEpisodes)
                .update();
    }

    private void token(UUID user, String token) {
        jdbc.sql("insert into push_tokens (user_id, token) values (:u, :t)")
                .param("u", user)
                .param("t", token)
                .update();
    }

    /** n verified subscribers with one push token each. */
    private void subscribers(int n) {
        jdbc.sql(
                        "insert into users (id, email, email_verified_at, display_name)"
                                + " select gen_random_uuid(), 'notif-' || g || '@perf.test', now(), 'R' || g"
                                + " from generate_series(1, :n) g")
                .param("n", n)
                .update();
        jdbc.sql(
                        "insert into subscriptions (user_id, series_id) select id, :s from users"
                                + " where email like 'notif-%@perf.test' and id <> :creator")
                .param("s", series)
                .param("creator", creator)
                .update();
        jdbc.sql(
                        "insert into push_tokens (user_id, token) select id, 'tok-' || id from users"
                                + " where email like 'notif-%@perf.test' and id <> :creator")
                .param("creator", creator)
                .update();
    }

    private void queue(UUID episodeId) {
        jdbc.sql(
                        "insert into outbox_events (topic, event_type, aggregate_id)"
                                + " values ('NOTIFICATION', 'EPISODE_PUBLISHED', :id)")
                .param("id", episodeId)
                .update();
    }

    private boolean processed(UUID episodeId) {
        return jdbc.sql(
                        "select processed_at is not null from outbox_events"
                                + " where topic = 'NOTIFICATION' and aggregate_id = :id")
                .param("id", episodeId)
                .query(Boolean.class)
                .single();
    }

    private int attempts(UUID episodeId) {
        return jdbc.sql(
                        "select attempts from outbox_events"
                                + " where topic = 'NOTIFICATION' and aggregate_id = :id")
                .param("id", episodeId)
                .query(Integer.class)
                .single();
    }
}
