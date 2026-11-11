package app.phumreader.notification.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import app.phumreader.auth.service.JwtService;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.common.store.ShortLivedStore;
import app.phumreader.notification.service.InboxCleanup;
import app.phumreader.seed.DemoSeeder;
import app.phumreader.support.AuthTestConfig;
import app.phumreader.support.IntegrationTest;
import app.phumreader.support.MutableClock;
import app.phumreader.support.RecordingEmailSender;
import app.phumreader.support.SeededDemo;
import app.phumreader.support.Sessions;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * The in-app notifications inbox (V21-03): the list with its tabs and cursor, the bell, read /
 * unread / read all, remove and restore, and every source writing its item in the same transaction
 * as the change. Every test rolls back. (New-episode items: NotificationDispatcherTest.)
 */
@IntegrationTest
@Import(AuthTestConfig.class)
@Transactional
class NotificationInboxApiTest {

    /** 12:00 in Phnom Penh. */
    static final Instant NOON = Instant.parse("2026-11-05T05:00:00Z");

    static final String INBOX = "/api/v1/me/notifications";
    static final String ADMIN = "/api/v1/admin";
    static final String COVER = "https://cdn.phumireader.test/covers/test.webp";
    static final Pattern CODE = Pattern.compile("\\b(\\d{6})\\b");

    @Autowired MockMvc mvc;
    @Autowired MutableClock clock;
    @Autowired DemoSeeder seeder;
    @Autowired JdbcClient jdbc;
    @Autowired JwtService jwt;
    @Autowired JsonMapper json;
    @Autowired RateLimiter limiter;
    @Autowired ShortLivedStore store;
    @Autowired RecordingEmailSender emails;
    @Autowired InboxCleanup cleanup;
    @Autowired PlatformTransactionManager transactions;

    Sessions sessions;
    UUID reader;
    UUID admin;
    UUID glassCompass;

    @BeforeEach
    void aReaderAndAnAdminAtNoon() {
        SeededDemo.ensure(seeder, jdbc, transactions);
        clock.set(NOON);
        limiter.clear();
        store.clear();
        emails.clear();
        sessions = new Sessions(jwt, jdbc);
        reader = sessions.newReader("Dara");
        admin = sessions.newReader("Admin Boran");
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'ADMIN')")
                .param("id", admin)
                .update();
        glassCompass = id("select id from series where slug = 'glass-compass'");
    }

    @AfterEach
    void realClock() {
        clock.set(Instant.now());
    }

    // ================================================================ the inbox

    @Test
    void guestsMustSignIn() throws Exception {
        UUID any = UUID.randomUUID();
        mvc.perform(get(INBOX)).andExpect(status().isUnauthorized());
        mvc.perform(get(INBOX + "/unread-count")).andExpect(status().isUnauthorized());
        mvc.perform(put(INBOX + "/" + any + "/read").with(sessions.guest()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(INBOX + "/" + any + "/read").with(sessions.guest()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(INBOX + "/read-all").with(sessions.guest()))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete(INBOX + "/" + any).with(sessions.guest()))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(INBOX + "/" + any + "/restore").with(sessions.guest()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void theInboxListsItemsNewestFirstPerTabWithACursor() throws Exception {
        UUID episode =
                item(
                        reader,
                        "EPISODE",
                        "episode_published",
                        glassCompass,
                        65,
                        "{}",
                        NOON.minusSeconds(60));
        UUID liked =
                item(
                        reader,
                        "COMMENT",
                        "comment_liked",
                        glassCompass,
                        null,
                        "{\"commentId\":\"" + UUID.randomUUID() + "\",\"count\":3}",
                        NOON.minusSeconds(120));
        UUID paid =
                item(
                        reader,
                        "COINS",
                        "order_paid",
                        null,
                        null,
                        "{\"orderNumber\":\"PR-00000001\",\"coins\":260}",
                        NOON.minusSeconds(180));
        UUID welcome = item(reader, "SYSTEM", "welcome", null, null, "{}", NOON.minusSeconds(240));
        // Someone else's item never shows.
        item(admin, "SYSTEM", "welcome", null, null, "{}", NOON);

        list("").andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(4))
                .andExpect(jsonPath("$.nextCursor").doesNotExist())
                .andExpect(jsonPath("$.items[0].id").value(episode.toString()))
                .andExpect(jsonPath("$.items[0].kind").value("episode"))
                .andExpect(jsonPath("$.items[0].type").value("episode_published"))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-05T04:59:00Z"))
                .andExpect(jsonPath("$.items[0].read").value(false))
                .andExpect(jsonPath("$.items[0].series.id").value(glassCompass.toString()))
                .andExpect(jsonPath("$.items[0].series.slug").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].series.title").value("Glass Compass"))
                .andExpect(jsonPath("$.items[0].series.type").value("comic"))
                .andExpect(jsonPath("$.items[0].episode").value(65))
                .andExpect(jsonPath("$.items[1].id").value(liked.toString()))
                .andExpect(jsonPath("$.items[1].kind").value("comment"))
                .andExpect(jsonPath("$.items[1].data.count").value(3))
                .andExpect(jsonPath("$.items[1].episode").doesNotExist())
                .andExpect(jsonPath("$.items[2].id").value(paid.toString()))
                .andExpect(jsonPath("$.items[2].kind").value("coins"))
                .andExpect(jsonPath("$.items[2].series").doesNotExist())
                .andExpect(jsonPath("$.items[2].data.orderNumber").value("PR-00000001"))
                .andExpect(jsonPath("$.items[2].data.coins").value(260))
                .andExpect(jsonPath("$.items[3].id").value(welcome.toString()))
                .andExpect(jsonPath("$.items[3].kind").value("system"));

        list("?tab=episodes")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(episode.toString()));
        list("?tab=comments")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(liked.toString()));
        list("?tab=coins")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(paid.toString()));
        read(reader, episode).andExpect(status().isNoContent());
        read(reader, paid).andExpect(status().isNoContent());
        list("?tab=unread")
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(liked.toString()))
                .andExpect(jsonPath("$.items[1].id").value(welcome.toString()));
        list("?tab=all")
                .andExpect(jsonPath("$.items.length()").value(4))
                .andExpect(jsonPath("$.items[0].read").value(true));

        // Two at a time.
        JsonNode first = body(list("?limit=2").andExpect(jsonPath("$.items.length()").value(2)));
        assertThat(first.get("items").get(1).get("id").asString()).isEqualTo(liked.toString());
        String cursor = first.get("nextCursor").asString();
        list("?limit=2&cursor=" + cursor)
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(paid.toString()))
                .andExpect(jsonPath("$.items[1].id").value(welcome.toString()))
                .andExpect(jsonPath("$.nextCursor").doesNotExist());

        list("?tab=system")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_value"))
                .andExpect(jsonPath("$.error.fields.tab").value("invalid_value"));
        list("?cursor=nonsense")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("invalid_cursor"));
    }

    @Test
    void theBellCountsUnreadItemsAndReadUnreadAndReadAllChangeIt() throws Exception {
        UUID a = item(reader, "SYSTEM", "welcome", null, null, "{}", NOON.minusSeconds(30));
        UUID b = item(reader, "COINS", "order_paid", null, null, "{}", NOON.minusSeconds(20));
        UUID c = item(reader, "COINS", "order_refunded", null, null, "{}", NOON.minusSeconds(10));
        unread(reader).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(3));

        read(reader, a).andExpect(status().isNoContent());
        read(reader, a).andExpect(status().isNoContent());
        unread(reader).andExpect(jsonPath("$.count").value(2));
        Instant firstRead = readAt(a);
        clock.advance(Duration.ofMinutes(5));
        read(reader, a).andExpect(status().isNoContent());
        assertThat(readAt(a)).as("reading again keeps the first time").isEqualTo(firstRead);

        unreadAgain(reader, a).andExpect(status().isNoContent());
        unreadAgain(reader, a).andExpect(status().isNoContent());
        unread(reader).andExpect(jsonPath("$.count").value(3));

        // A removed item does not count.
        remove(reader, c).andExpect(status().isNoContent());
        unread(reader).andExpect(jsonPath("$.count").value(2));

        mvc.perform(post(INBOX + "/read-all").with(sessions.as(reader)))
                .andExpect(status().isNoContent());
        unread(reader).andExpect(jsonPath("$.count").value(0));
        list("?tab=unread").andExpect(jsonPath("$.items.length()").value(0));
        assertThat(readAt(b)).isEqualTo(clock.instant());
        restore(reader, c).andExpect(status().isNoContent());
        unread(reader).andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void aRemovedItemCanBeRestored() throws Exception {
        UUID a = item(reader, "SYSTEM", "welcome", null, null, "{}", NOON.minusSeconds(30));
        UUID b = item(reader, "COINS", "order_paid", null, null, "{}", NOON.minusSeconds(20));

        remove(reader, b).andExpect(status().isNoContent());
        remove(reader, b).andExpect(status().isNoContent());
        list("").andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(a.toString()));

        restore(reader, b).andExpect(status().isNoContent());
        restore(reader, b).andExpect(status().isNoContent());
        list("").andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].id").value(b.toString()))
                .andExpect(jsonPath("$.items[0].read").value(false));
    }

    @Test
    void someoneElsesItemAnswers404() throws Exception {
        UUID theirs = item(admin, "SYSTEM", "welcome", null, null, "{}", NOON);
        for (UUID id : List.of(theirs, UUID.randomUUID())) {
            read(reader, id)
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error.code").value("notification_not_found"));
            unreadAgain(reader, id).andExpect(status().isNotFound());
            remove(reader, id).andExpect(status().isNotFound());
            restore(reader, id).andExpect(status().isNotFound());
        }
        mvc.perform(post(INBOX + "/read-all").with(sessions.as(reader)))
                .andExpect(status().isNoContent());
        unread(admin).andExpect(jsonPath("$.count").value(1));
        assertThat(
                        jdbc.sql("select removed_at is null from notifications where id = :id")
                                .param("id", theirs)
                                .query(Boolean.class)
                                .single())
                .isTrue();
    }

    @Test
    void theNightlyCleanUpDeletesItemsRemovedAWeekAgoAndOldReadOnes() {
        Instant now = clock.instant();
        UUID removedLongAgo = item(reader, "SYSTEM", "welcome", null, null, "{}", now);
        UUID removedLately = item(reader, "COINS", "order_paid", null, null, "{}", now);
        UUID oldRead =
                item(reader, "COINS", "order_refunded", null, null, "{}", now.minus(days(91)));
        UUID oldUnread =
                item(reader, "SYSTEM", "series_approved", null, null, "{}", now.minus(days(120)));
        UUID read =
                item(reader, "SYSTEM", "series_rejected", null, null, "{}", now.minus(days(89)));
        set(removedLongAgo, "removed_at", now.minus(days(7)).minusSeconds(60));
        set(removedLately, "removed_at", now.minus(days(6)));
        set(oldRead, "read_at", now.minus(days(80)));
        set(read, "read_at", now.minus(days(1)));

        assertThat(cleanup.run()).isGreaterThanOrEqualTo(2);

        assertThat(
                        jdbc.sql("select id from notifications where user_id = :u")
                                .param("u", reader)
                                .query(UUID.class)
                                .list())
                .containsExactlyInAnyOrder(removedLately, oldUnread, read);
        assertThat(cleanup.run()).as("a second run finds nothing of these").isZero();
    }

    // ================================================================ sources

    @Test
    void aCommentLikeNotifiesTheAuthorOncePerDayWithTheNumberOfPeople() throws Exception {
        UUID author = sessions.newReader("Author");
        UUID first = sessions.newReader("First");
        UUID second = sessions.newReader("Second");
        UUID third = sessions.newReader("Third");
        UUID comment = comment(author, "/api/v1/series/glass-compass/comments", "Love it!");

        // Liking your own comment: nothing.
        like(author, comment);
        assertThat(items(author)).isZero();

        like(first, comment);
        listAs(author, "?tab=comments")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].kind").value("comment"))
                .andExpect(jsonPath("$.items[0].type").value("comment_liked"))
                .andExpect(jsonPath("$.items[0].series.slug").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].episode").doesNotExist())
                .andExpect(jsonPath("$.items[0].data.commentId").value(comment.toString()))
                .andExpect(jsonPath("$.items[0].data.count").value(1))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-05T05:00:00Z"));
        UUID item = UUID.fromString(firstId(author));
        read(author, item).andExpect(status().isNoContent());

        // Taking the like back and giving it again changes nothing.
        clock.advance(Duration.ofMinutes(10));
        mvc.perform(delete("/api/v1/comments/" + comment + "/like").with(sessions.as(first)))
                .andExpect(status().isOk());
        like(first, comment);
        listAs(author, "")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].data.count").value(1))
                .andExpect(jsonPath("$.items[0].read").value(true))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-05T05:00:00Z"));

        // A second person: the same item counts 2 and is new again, even after a remove.
        remove(author, item).andExpect(status().isNoContent());
        clock.advance(Duration.ofHours(1));
        like(second, comment);
        listAs(author, "")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].id").value(item.toString()))
                .andExpect(jsonPath("$.items[0].data.count").value(2))
                .andExpect(jsonPath("$.items[0].read").value(false))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-05T06:10:00Z"));
        unread(author).andExpect(jsonPath("$.count").value(1));

        // An unlike never lowers the count.
        mvc.perform(delete("/api/v1/comments/" + comment + "/like").with(sessions.as(second)))
                .andExpect(status().isOk());
        listAs(author, "").andExpect(jsonPath("$.items[0].data.count").value(2));

        // The next day in Phnom Penh (17:00 UTC = midnight) starts a new item.
        clock.set(Instant.parse("2026-11-05T17:00:00Z"));
        like(third, comment);
        listAs(author, "")
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].data.count").value(1))
                .andExpect(jsonPath("$.items[1].data.count").value(2));
    }

    @Test
    void aLikeOnAnEpisodeCommentCarriesTheEpisodeNumber() throws Exception {
        UUID author = sessions.newReader("Author");
        UUID fan = sessions.newReader("Fan");
        UUID episode =
                id(
                        "select id from episodes where series_id = '"
                                + glassCompass
                                + "' and number = 65");
        UUID comment =
                jdbc.sql(
                                "insert into comments (series_id, episode_id, author_id, body)"
                                        + " values (:s, :e, :a, 'Wow') returning id")
                        .param("s", glassCompass)
                        .param("e", episode)
                        .param("a", author)
                        .query(UUID.class)
                        .single();

        like(fan, comment);

        listAs(author, "")
                .andExpect(jsonPath("$.items[0].type").value("comment_liked"))
                .andExpect(jsonPath("$.items[0].series.slug").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].episode").value(65));
    }

    @Test
    void aPaidAndARefundedOrderNotifyTheBuyerOnce() throws Exception {
        String number = createOrder(reader, 4, "inbox-order-0001");
        unread(reader).andExpect(jsonPath("$.count").value(0));
        for (int i = 0; i < 2; i++) {
            mvc.perform(
                            post("/api/v1/coins/orders/" + number + "/simulate")
                                    .with(sessions.as(reader))
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content("{\"outcome\":\"paid\"}"))
                    .andExpect(status().isOk());
        }
        listAs(reader, "?tab=coins")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].kind").value("coins"))
                .andExpect(jsonPath("$.items[0].type").value("order_paid"))
                .andExpect(jsonPath("$.items[0].series").doesNotExist())
                .andExpect(jsonPath("$.items[0].data.orderNumber").value(number))
                // 120 coins, 20 bonus and the 120 first-purchase bonus.
                .andExpect(jsonPath("$.items[0].data.coins").value(260));

        // A failed order writes nothing.
        String failed = createOrder(reader, 1, "inbox-order-0002");
        mvc.perform(
                        post("/api/v1/coins/orders/" + failed + "/simulate")
                                .with(sessions.as(reader))
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"outcome\":\"failed\"}"))
                .andExpect(status().isOk());
        assertThat(items(reader)).isEqualTo(1);

        UUID orderId = id("select id from payment_orders where order_number = '" + number + "'");
        clock.advance(Duration.ofMinutes(5));
        admin("/orders/" + orderId + "/refund", "{\"reason\":\"Charged twice\"}")
                .andExpect(status().isOk());
        listAs(reader, "?tab=coins")
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].type").value("order_refunded"))
                .andExpect(jsonPath("$.items[0].data.orderNumber").value(number))
                .andExpect(jsonPath("$.items[0].data.coins").value(260))
                .andExpect(jsonPath("$.items[0].createdAt").value("2026-11-05T05:05:00Z"));
    }

    @Test
    void reportersHearHowTheirReportsEnded() throws Exception {
        UUID other = sessions.newReader("Other");
        UUID third = sessions.newReader("Third");
        UUID comment =
                id(
                        "select c.id from comments c where c.series_id = '"
                                + glassCompass
                                + "' and c.episode_id is null order by c.like_count desc limit 1");
        UUID episode =
                id(
                        "select id from episodes where series_id = '"
                                + glassCompass
                                + "' and number = 65");

        // Dismissed: nothing was wrong.
        UUID spam = report(reader, "SERIES", glassCompass);
        admin("/reports/" + spam + "/settle", "{\"action\":\"dismiss\",\"note\":\"Fine\"}")
                .andExpect(status().isOk());
        listAs(reader, "")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].kind").value("system"))
                .andExpect(jsonPath("$.items[0].type").value("report_dismissed"))
                .andExpect(jsonPath("$.items[0].series.slug").value("glass-compass"))
                .andExpect(jsonPath("$.items[0].data.reportId").value(spam.toString()))
                .andExpect(jsonPath("$.items[0].data.targetType").value("series"))
                .andExpect(jsonPath("$.items[0].data.hidden").value(false));

        // Resolved without taking anything down.
        clock.advance(Duration.ofMinutes(1));
        UUID ep = report(reader, "EPISODE", episode);
        admin("/reports/" + ep + "/settle", "{\"action\":\"resolve\"}").andExpect(status().isOk());
        listAs(reader, "")
                .andExpect(jsonPath("$.items[0].type").value("report_resolved"))
                .andExpect(jsonPath("$.items[0].episode").value(65))
                .andExpect(jsonPath("$.items[0].data.targetType").value("episode"))
                .andExpect(jsonPath("$.items[0].data.hidden").value(false));

        // Two people reported a comment; hiding it through one report tells both, once each.
        clock.advance(Duration.ofMinutes(1));
        UUID mine = report(reader, "COMMENT", comment);
        UUID theirs = report(other, "COMMENT", comment);
        admin("/reports/" + mine + "/settle", "{\"action\":\"hide\",\"note\":\"Rude\"}")
                .andExpect(status().isOk());
        for (UUID who : List.of(reader, other)) {
            listAs(who, "")
                    .andExpect(jsonPath("$.items[0].type").value("report_resolved"))
                    .andExpect(jsonPath("$.items[0].series.slug").value("glass-compass"))
                    .andExpect(jsonPath("$.items[0].data.targetType").value("comment"))
                    .andExpect(jsonPath("$.items[0].data.hidden").value(true));
        }
        assertThat(items(reader)).isEqualTo(3);
        assertThat(items(other)).isEqualTo(1);
        assertThat(
                        jdbc.sql(
                                        "select data ->> 'reportId' from notifications"
                                                + " where user_id = :u")
                                .param("u", other)
                                .query(String.class)
                                .single())
                .isEqualTo(theirs.toString());

        // Hiding content from the content list resolves its reports too; an admin's own report
        // writes nothing for the admin.
        clock.advance(Duration.ofMinutes(1));
        report(third, "EPISODE", episode);
        report(admin, "EPISODE", episode);
        admin("/content/episode/" + episode + "/hide", "{\"reason\":\"Violence\"}")
                .andExpect(status().isNoContent());
        listAs(third, "")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].type").value("report_resolved"))
                .andExpect(jsonPath("$.items[0].episode").value(65))
                .andExpect(jsonPath("$.items[0].data.hidden").value(true));
        assertThat(items(admin)).isZero();
    }

    @Test
    void theCreatorHearsEachReviewDecision() throws Exception {
        UUID creator = newCreator("Mara");
        String id = series(creator, "Tide of Glass");
        submit(creator, id).andExpect(status().isOk());
        decide(id, "request-changes", "{\"items\":[\"cover\",\"contact\"],\"note\":\"Own art\"}")
                .andExpect(status().isNoContent());
        listAs(creator, "")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].kind").value("system"))
                .andExpect(jsonPath("$.items[0].type").value("series_changes"))
                .andExpect(jsonPath("$.items[0].series.id").value(id))
                .andExpect(jsonPath("$.items[0].series.title").value("Tide of Glass"))
                .andExpect(jsonPath("$.items[0].data.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].data.items[0]").value("cover"))
                .andExpect(jsonPath("$.items[0].data.items[1]").value("contact"))
                .andExpect(jsonPath("$.items[0].data.note").value("Own art"));

        for (String item : List.of("cover", "contact")) {
            mvc.perform(
                            put("/api/v1/creator/series/" + id + "/review/items/" + item)
                                    .with(creatorSession(creator)))
                    .andExpect(status().isOk());
        }
        clock.advance(Duration.ofHours(1));
        submit(creator, id).andExpect(status().isOk());
        decide(id, "approve", "").andExpect(status().isNoContent());
        listAs(creator, "")
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].type").value("series_approved"))
                .andExpect(jsonPath("$.items[0].series.slug").value("tide-of-glass"));

        String other = series(creator, "Second Sea");
        submit(creator, other).andExpect(status().isOk());
        clock.advance(Duration.ofHours(1));
        decide(other, "reject", "{\"note\":\"Not for us\"}").andExpect(status().isNoContent());
        listAs(creator, "")
                .andExpect(jsonPath("$.items.length()").value(3))
                .andExpect(jsonPath("$.items[0].type").value("series_rejected"))
                .andExpect(jsonPath("$.items[0].series.id").value(other))
                .andExpect(jsonPath("$.items[0].data.note").value("Not for us"));
        // A refused second decision writes nothing more.
        decide(other, "approve", "").andExpect(status().isConflict());
        assertThat(items(creator)).isEqualTo(3);
    }

    @Test
    void confirmingTheEmailBringsTheWelcomeOnce() throws Exception {
        String email = "inbox-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        mvc.perform(
                        post("/api/v1/auth/signup")
                                .with(sessions.guest())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"name\":\"Sokha\",\"email\":\""
                                                + email
                                                + "\",\"password\":\"Toonwave1!\"}"))
                .andExpect(status().isCreated());
        assertThat(
                        jdbc.sql(
                                        "select count(*) from notifications n join users u"
                                                + " on u.id = n.user_id where u.email = :e")
                                .param("e", email)
                                .query(Long.class)
                                .single())
                .as("not before the email is confirmed")
                .isZero();

        mvc.perform(
                        post("/api/v1/auth/verify")
                                .with(sessions.guest())
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"email\":\""
                                                + email
                                                + "\",\"code\":\""
                                                + codeSentTo(email)
                                                + "\"}"))
                .andExpect(status().isOk());

        UUID user = sessions.userId(email);
        listAs(user, "")
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].kind").value("system"))
                .andExpect(jsonPath("$.items[0].type").value("welcome"))
                .andExpect(jsonPath("$.items[0].series").doesNotExist())
                .andExpect(jsonPath("$.items[0].data").isMap());
        unread(user).andExpect(jsonPath("$.count").value(1));
    }

    // ================================================================ helpers

    private ResultActions list(String query) throws Exception {
        return listAs(reader, query);
    }

    private ResultActions listAs(UUID user, String query) throws Exception {
        return mvc.perform(get(INBOX + query).with(sessions.as(user)));
    }

    private ResultActions unread(UUID user) throws Exception {
        return mvc.perform(get(INBOX + "/unread-count").with(sessions.as(user)));
    }

    private ResultActions read(UUID user, UUID id) throws Exception {
        return mvc.perform(put(INBOX + "/" + id + "/read").with(sessions.as(user)));
    }

    private ResultActions unreadAgain(UUID user, UUID id) throws Exception {
        return mvc.perform(delete(INBOX + "/" + id + "/read").with(sessions.as(user)));
    }

    private ResultActions remove(UUID user, UUID id) throws Exception {
        return mvc.perform(delete(INBOX + "/" + id).with(sessions.as(user)));
    }

    private ResultActions restore(UUID user, UUID id) throws Exception {
        return mvc.perform(post(INBOX + "/" + id + "/restore").with(sessions.as(user)));
    }

    private String firstId(UUID user) throws Exception {
        return body(listAs(user, "")).get("items").get(0).get("id").asString();
    }

    private JsonNode body(ResultActions result) throws Exception {
        return json.readTree(
                result.andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    /** An item written as a source would, at {@code at}. */
    private UUID item(
            UUID user,
            String kind,
            String type,
            @Nullable UUID series,
            @Nullable Integer episode,
            String data,
            Instant at) {
        return jdbc.sql(
                        "insert into notifications (user_id, kind, type, group_key, series_id,"
                                + " episode_number, data, created_at) values (:u, :kind, :type,"
                                + " :key, cast(:series as uuid), cast(:episode as integer),"
                                + " cast(:data as jsonb), :at) returning id")
                .param("u", user)
                .param("kind", kind)
                .param("type", type)
                .param("key", "test:" + UUID.randomUUID())
                .param("series", series)
                .param("episode", episode)
                .param("data", data)
                .param("at", at.atOffset(ZoneOffset.UTC))
                .query(UUID.class)
                .single();
    }

    private void set(UUID id, String column, Instant at) {
        jdbc.sql("update notifications set " + column + " = :at where id = :id")
                .param("at", at.atOffset(ZoneOffset.UTC))
                .param("id", id)
                .update();
    }

    private Instant readAt(UUID id) {
        return jdbc.sql("select read_at from notifications where id = :id")
                .param("id", id)
                .query(java.time.OffsetDateTime.class)
                .single()
                .toInstant();
    }

    private long items(UUID user) {
        return jdbc.sql("select count(*) from notifications where user_id = :u")
                .param("u", user)
                .query(Long.class)
                .single();
    }

    private UUID comment(UUID author, String path, String text) throws Exception {
        return UUID.fromString(
                body(mvc.perform(
                                        post(path)
                                                .with(sessions.as(author))
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content("{\"body\":\"" + text + "\"}"))
                                .andExpect(status().isCreated()))
                        .get("id")
                        .asString());
    }

    private void like(UUID user, UUID comment) throws Exception {
        mvc.perform(put("/api/v1/comments/" + comment + "/like").with(sessions.as(user)))
                .andExpect(status().isOk());
    }

    private UUID report(UUID reporter, String type, UUID target) {
        return jdbc.sql(
                        "insert into reports (reporter_id, target_type, target_id, reason)"
                                + " values (:r, :type, :t, 'spam') returning id")
                .param("r", reporter)
                .param("type", type)
                .param("t", target)
                .query(UUID.class)
                .single();
    }

    private ResultActions admin(String path, String body) throws Exception {
        return mvc.perform(
                post(ADMIN + path)
                        .with(sessions.as(admin, "ADMIN"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body));
    }

    private String createOrder(UUID user, int pack, String key) throws Exception {
        return body(mvc.perform(
                                post("/api/v1/coins/orders")
                                        .with(sessions.as(user))
                                        .header("Idempotency-Key", key)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content("{\"packId\":" + pack + ",\"method\":\"khqr\"}"))
                        .andExpect(status().isCreated()))
                .get("orderNumber")
                .asString();
    }

    private UUID newCreator(String name) {
        UUID id = sessions.newReader(name);
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'CREATOR')")
                .param("id", id)
                .update();
        jdbc.sql(
                        "insert into creator_profiles (user_id, pen_name, accepted_terms_at)"
                                + " values (:id, :n, now())")
                .param("id", id)
                .param("n", name)
                .update();
        return id;
    }

    private RequestPostProcessor creatorSession(UUID creator) {
        return sessions.as(creator, "READER", "CREATOR");
    }

    /** A draft comic with a cover, ready to submit. */
    private String series(UUID creator, String title) throws Exception {
        String body =
                ("{\"title\":\"%s\",\"type\":\"comic\",\"genre\":\"fantasy\","
                                + "\"languages\":[\"en\"],\"summary\":\"A glass sea.\","
                                + "\"ageRating\":\"teen\",\"updateDays\":[\"Fri\"]}")
                        .formatted(title);
        String id =
                body(mvc.perform(
                                        post("/api/v1/creator/series")
                                                .with(creatorSession(creator))
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content(body))
                                .andExpect(status().isCreated()))
                        .get("id")
                        .asString();
        jdbc.sql("update series set cover_url = :c where id = :id")
                .param("c", COVER)
                .param("id", UUID.fromString(id))
                .update();
        return id;
    }

    private ResultActions submit(UUID creator, String id) throws Exception {
        return mvc.perform(
                post("/api/v1/creator/series/" + id + "/submit").with(creatorSession(creator)));
    }

    private ResultActions decide(String id, String action, String body) throws Exception {
        MockHttpServletRequestBuilder request =
                post(ADMIN + "/series/" + id + "/" + action).with(sessions.as(admin, "ADMIN"));
        if (!body.isEmpty()) {
            request.contentType(MediaType.APPLICATION_JSON).content(body);
        }
        return mvc.perform(request);
    }

    private String codeSentTo(String email) {
        String subject = emails.lastTo(email).orElseThrow().subject();
        Matcher m = CODE.matcher(subject);
        assertThat(m.find()).as("code in %s", subject).isTrue();
        return m.group(1);
    }

    private UUID id(String sql) {
        return jdbc.sql(sql).query(UUID.class).single();
    }

    private static Duration days(int n) {
        return Duration.ofDays(n);
    }
}
