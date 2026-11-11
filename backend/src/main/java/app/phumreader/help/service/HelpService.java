package app.phumreader.help.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.ratelimit.RateLimiter;
import app.phumreader.help.repository.HelpQueries;
import app.phumreader.notification.service.EmailSender;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Help tickets and "Was this helpful?" votes. */
@Service
@Transactional
public class HelpService {

    private static final Logger log = LoggerFactory.getLogger(HelpService.class);

    public static final List<String> TOPICS =
            List.of("payment", "account", "reading", "creator", "report", "other");
    static final int TICKETS_PER_HOUR = 5;
    static final Duration TICKET_WINDOW = Duration.ofHours(1);
    private static final Pattern ORDER = Pattern.compile("TW-\\d{8}");
    private static final Pattern EMAIL = Pattern.compile("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");
    private static final int MAX_ARTICLE = 99;
    private static final int MESSAGE_MIN = 20;
    private static final int MESSAGE_MAX = 1000;

    private final HelpQueries queries;
    private final EmailSender email;
    private final RateLimiter limiter;
    private final String supportEmail;

    public HelpService(
            HelpQueries queries,
            EmailSender email,
            RateLimiter limiter,
            @Value("${phumreader.support-email:}") String supportEmail) {
        this.queries = queries;
        this.email = email;
        this.limiter = limiter;
        this.supportEmail = supportEmail.trim();
    }

    /** A ticket as the website shows it: "T-58214". */
    public record Ticket(String ticket) {}

    /**
     * Stores the ticket and emails it to the support address. 400 {@code invalid_topic} / {@code
     * invalid_email} / {@code message_too_short} / {@code message_too_long} / {@code invalid_order}
     * (each names its field); 429 {@code too_many_requests}.
     */
    public Ticket createTicket(
            @Nullable UUID userId,
            String clientKey,
            String topic,
            String address,
            @Nullable String order,
            String message,
            @Nullable String locale) {
        String who = userId != null ? "u:" + userId : "ip:" + clientKey;
        limiter.acquire("ticket:" + who, TICKETS_PER_HOUR, TICKET_WINDOW, "too_many_requests");
        if (!TOPICS.contains(topic)) {
            throw ApiException.invalidField("topic", "invalid_topic", "Choose a topic.");
        }
        String replyTo = address.trim().toLowerCase(Locale.ROOT);
        if (!EMAIL.matcher(replyTo).matches() || replyTo.length() > 254) {
            throw ApiException.invalidField("email", "invalid_email", "Enter a valid email.");
        }
        String text = message.trim();
        if (text.length() < MESSAGE_MIN) {
            throw ApiException.invalidField(
                    "message", "message_too_short", "Write at least 20 characters.");
        }
        if (text.length() > MESSAGE_MAX) {
            throw ApiException.invalidField(
                    "message", "message_too_long", "Use at most 1000 characters.");
        }
        String orderNumber =
                order == null || order.isBlank() ? null : order.trim().toUpperCase(Locale.ROOT);
        if (orderNumber != null && !ORDER.matcher(orderNumber).matches()) {
            throw ApiException.invalidField(
                    "order", "invalid_order", "Order numbers look like TW-12345678.");
        }
        String language = "km".equals(locale) ? "km" : "en";
        int number = queries.insertTicket(userId, replyTo, topic, orderNumber, text, language);
        notifySupport("T-" + number, topic, replyTo, orderNumber, text, userId);
        return new Ticket("T-" + number);
    }

    /**
     * The ticket is already saved; a mail failure is logged and the reader still gets the number.
     */
    private void notifySupport(
            String ticket,
            String topic,
            String replyTo,
            @Nullable String order,
            String message,
            @Nullable UUID userId) {
        if (supportEmail.isEmpty()) {
            log.info(
                    "Support ticket {} saved; phumreader.support-email is not set, no email sent",
                    ticket);
            return;
        }
        String body =
                "Ticket: "
                        + ticket
                        + "\nTopic: "
                        + topic
                        + "\nReply to: "
                        + replyTo
                        + (order != null ? "\nOrder: " + order : "")
                        + (userId != null ? "\nAccount: " + userId : "\nAccount: (not signed in)")
                        + "\n\n"
                        + message
                        + "\n";
        try {
            email.send(supportEmail, "[" + ticket + "] " + topic, body);
        } catch (RuntimeException ex) {
            log.warn("Could not email support ticket {}", ticket, ex);
        }
    }

    /** Saves the answer to "Was this helpful?" for article {@code article} (0-99). */
    public void vote(UUID userId, int article, boolean helpful) {
        requireArticle(article);
        queries.saveVote(userId, article, helpful);
    }

    public void clearVote(UUID userId, int article) {
        requireArticle(article);
        queries.deleteVote(userId, article);
    }

    private static void requireArticle(int article) {
        if (article < 0 || article > MAX_ARTICLE) {
            throw ApiException.invalidField("article", "invalid_article", "No such help article.");
        }
    }

    @Transactional(readOnly = true)
    public Map<Integer, Boolean> votes(UUID userId) {
        return queries.votes(userId);
    }
}
