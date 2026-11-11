package app.phumreader.notification.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.paging.Cursors;
import app.phumreader.notification.domain.InboxTab;
import app.phumreader.notification.domain.NotificationType;
import app.phumreader.notification.repository.InboxQueries;
import app.phumreader.notification.repository.InboxQueries.InboxRow;
import app.phumreader.notification.repository.InboxQueries.Key;
import app.phumreader.notification.service.InboxViews.NotificationItem;
import app.phumreader.notification.service.InboxViews.NotificationSeries;
import app.phumreader.notification.service.InboxViews.UnreadCount;
import app.phumreader.series.domain.ReviewDecision;
import app.phumreader.series.domain.SeriesType;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * The in-app notifications inbox (V21-03): the reader's list, the bell's count and the actions on
 * it, and the methods the sources call <b>inside their own transaction</b>, so an item exists
 * exactly when the change does. Writing the same item twice changes nothing (a repeated payment
 * confirmation, a double click). New-episode items are written by {@link NotificationDispatcher}.
 */
@Service
@Transactional
public class NotificationInbox {

    /** Comment likes are counted per day in Phnom Penh. */
    static final ZoneId ZONE = ZoneId.of("Asia/Phnom_Penh");

    private final InboxQueries queries;
    private final JsonMapper json;
    private final Clock clock;

    public NotificationInbox(InboxQueries queries, JsonMapper json, Clock clock) {
        this.queries = queries;
        this.json = json;
        this.clock = clock;
    }

    // ---------- the reader's inbox ----------

    /** A page of the inbox, newest first; removed items are left out. */
    @Transactional(readOnly = true)
    public CursorPage<NotificationItem> list(
            UUID userId, InboxTab tab, @Nullable String cursor, @Nullable Integer limit) {
        int size = Cursors.limit(limit);
        List<InboxRow> rows =
                queries.page(userId, tab.kind(), tab == InboxTab.UNREAD, key(cursor), size + 1);
        List<InboxRow> page = rows.size() > size ? rows.subList(0, size) : rows;
        String next =
                rows.size() > size
                        ? Cursors.encode(
                                "n|"
                                        + page.getLast().createdAt().toInstant()
                                        + "|"
                                        + page.getLast().id())
                        : null;
        return new CursorPage<>(page.stream().map(this::view).toList(), next);
    }

    @Transactional(readOnly = true)
    public UnreadCount unreadCount(UUID userId) {
        return new UnreadCount(queries.unread(userId));
    }

    /** Marks one item read or unread; 404 {@code notification_not_found} for another's item. */
    public void markRead(UUID userId, UUID id, boolean read) {
        if (!queries.markRead(userId, id, read, now())) {
            throw notFound();
        }
    }

    /** Marks every unread item read. */
    public void markAllRead(UUID userId) {
        queries.markAllRead(userId, now());
    }

    /** Removes an item (kept 7 days for Undo / restore); removing twice changes nothing. */
    public void remove(UUID userId, UUID id) {
        if (!queries.markRemoved(userId, id, true, now())) {
            throw notFound();
        }
    }

    /** Brings a removed item back (Undo); 404 once the clean-up deleted it. */
    public void restore(UUID userId, UUID id) {
        if (!queries.markRemoved(userId, id, false, now())) {
            throw notFound();
        }
    }

    // ---------- sources (call inside the change's transaction) ----------

    /**
     * {@code likerId} newly liked the comment at {@code likedAt}: its author's item for that
     * comment and day counts the people who liked it that day. Liking your own comment writes
     * nothing.
     */
    public void commentLiked(UUID likerId, UUID commentId, Instant likedAt) {
        LocalDate day = likedAt.atZone(ZONE).toLocalDate();
        queries.commentLiked(
                likerId,
                commentId,
                "comment_liked:" + commentId + ":" + day,
                day.atStartOfDay(ZONE).toOffsetDateTime(),
                day.plusDays(1).atStartOfDay(ZONE).toOffsetDateTime(),
                likedAt.atOffset(ZoneOffset.UTC));
    }

    /**
     * A coin order was paid: the buyer's item with the order number and the coins credited (pack,
     * bonus and first-purchase bonus).
     */
    public void orderPaid(UUID buyerId, UUID orderId, String orderNumber, int coins) {
        order(NotificationType.ORDER_PAID, buyerId, orderId, orderNumber, coins);
    }

    /** An admin refunded a coin order: the buyer's item with the coins taken back. */
    public void orderRefunded(UUID buyerId, UUID orderId, String orderNumber, int coins) {
        order(NotificationType.ORDER_REFUNDED, buyerId, orderId, orderNumber, coins);
    }

    private void order(
            NotificationType type, UUID buyerId, UUID orderId, String orderNumber, int coins) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("orderNumber", orderNumber);
        data.put("coins", coins);
        queries.add(buyerId, type, type.key() + ":" + orderId, null, null, write(data), now());
    }

    /**
     * Reports an admin resolved: each reporter hears it.
     *
     * @param hidden the reported content was taken down
     */
    public void reportsResolved(Collection<UUID> reportIds, boolean hidden, UUID adminId) {
        queries.reportsSettled(reportIds, NotificationType.REPORT_RESOLVED, hidden, adminId, now());
    }

    /** A report an admin dismissed (nothing wrong): the reporter hears it. */
    public void reportDismissed(UUID reportId, UUID adminId) {
        queries.reportsSettled(
                List.of(reportId), NotificationType.REPORT_DISMISSED, false, adminId, now());
    }

    /**
     * The review decision on a series (V21-01): its creator hears it.
     *
     * @param reviewId the submission that was decided
     * @param items the changes asked for (review item keys), for {@code CHANGES}
     * @param note the admin's note to the creator
     */
    public void seriesReviewed(
            UUID seriesId,
            long reviewId,
            ReviewDecision decision,
            List<String> items,
            @Nullable String note,
            UUID adminId) {
        Map<String, Object> data = new LinkedHashMap<>();
        NotificationType type =
                switch (decision) {
                    case APPROVED -> NotificationType.SERIES_APPROVED;
                    case CHANGES -> {
                        data.put("items", List.copyOf(items));
                        data.put("note", note);
                        yield NotificationType.SERIES_CHANGES;
                    }
                    case REJECTED -> {
                        data.put("note", note);
                        yield NotificationType.SERIES_REJECTED;
                    }
                };
        queries.seriesReviewed(seriesId, reviewId, type, adminId, write(data), now());
    }

    /** The account's email was confirmed (once per account). */
    public void welcome(UUID userId) {
        queries.add(userId, NotificationType.WELCOME, "welcome", null, null, "{}", now());
    }

    // ---------- helpers ----------

    private NotificationItem view(InboxRow r) {
        NotificationSeries series =
                r.seriesId() == null || r.seriesSlug() == null
                        ? null
                        : new NotificationSeries(
                                r.seriesId(),
                                r.seriesSlug(),
                                String.valueOf(r.seriesTitle()),
                                SeriesType.valueOf(String.valueOf(r.seriesType())));
        return new NotificationItem(
                r.id(),
                r.kind(),
                r.type(),
                r.createdAt().toInstant(),
                r.read(),
                series,
                r.episodeNumber(),
                read(r.data()));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> read(String data) {
        try {
            return json.readValue(data, Map.class);
        } catch (JacksonException e) {
            return Map.of();
        }
    }

    private String write(Map<String, Object> data) {
        try {
            return json.writeValueAsString(data);
        } catch (JacksonException e) {
            throw new IllegalStateException("Notification data cannot be written", e);
        }
    }

    private static @Nullable Key key(@Nullable String cursor) {
        String text = Cursors.decode(cursor);
        if (text == null) {
            return null;
        }
        String[] parts = text.split("\\|", -1);
        try {
            if (parts.length == 3 && parts[0].equals("n")) {
                return new Key(
                        Instant.parse(parts[1]).atOffset(ZoneOffset.UTC),
                        UUID.fromString(parts[2]));
            }
        } catch (IllegalArgumentException | DateTimeParseException ignored) {
            // falls through to the error below
        }
        throw ApiException.badRequest("invalid_cursor", "The cursor is not valid.");
    }

    private static ApiException notFound() {
        return ApiException.notFound("notification_not_found", "No such notification.");
    }

    private OffsetDateTime now() {
        return clock.instant().atOffset(ZoneOffset.UTC);
    }
}
