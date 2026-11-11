package app.phumreader.help.repository;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Support tickets and help votes (plain SQL, V21-07). */
@Repository
public class HelpQueries {

    private final JdbcClient jdbc;

    public HelpQueries(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Stores a ticket and returns its number (58214 and up). */
    public int insertTicket(
            @Nullable UUID userId,
            String email,
            String topic,
            @Nullable String order,
            String message,
            String locale) {
        Integer number =
                jdbc.sql(
                                "insert into support_tickets (user_id, email, topic, order_number,"
                                        + " message, locale) values (:user, :email, :topic, :order,"
                                        + " :message, :locale) returning number")
                        .param("user", userId)
                        .param("email", email)
                        .param("topic", topic)
                        .param("order", order)
                        .param("message", message)
                        .param("locale", locale)
                        .query(Integer.class)
                        .single();
        return number;
    }

    /** Saves the answer; a second vote replaces the first. */
    public void saveVote(UUID userId, int article, boolean helpful) {
        jdbc.sql(
                        "insert into help_votes (user_id, article, helpful) values (:user,"
                                + " :article, :helpful) on conflict (user_id, article) do update"
                                + " set helpful = excluded.helpful, voted_at = now()")
                .param("user", userId)
                .param("article", article)
                .param("helpful", helpful)
                .update();
    }

    public void deleteVote(UUID userId, int article) {
        jdbc.sql("delete from help_votes where user_id = :user and article = :article")
                .param("user", userId)
                .param("article", article)
                .update();
    }

    /** Article position to answer, for one account. */
    public Map<Integer, Boolean> votes(UUID userId) {
        Map<Integer, Boolean> votes = new LinkedHashMap<>();
        jdbc.sql("select article, helpful from help_votes where user_id = :user order by article")
                .param("user", userId)
                .query((rs, i) -> {
                    votes.put(rs.getInt("article"), rs.getBoolean("helpful"));
                    return null;
                })
                .list();
        return votes;
    }
}
