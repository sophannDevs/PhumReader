package app.phumreader.user.service;

import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserStatus;
import app.phumreader.user.repository.UserRepository;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Erases accounts whose 30-day deletion grace period has ended (A18, plan P3-17). Runs every night
 * at 03:15 in Phnom Penh. Each account is erased in its own transaction, so one failure does not
 * stop the others, and running twice does nothing the second time.
 *
 * <p>What goes: email, name, password, avatar, Google / Facebook links, sign-in devices, push
 * tokens, settings, the notifications inbox and the creator bio. What stays, pointing at "Deleted
 * account": comments, the coin ledger and order history (accounting), unlocks, and a creator's pen
 * name and series (readers keep their library and paid episodes).
 */
@Service
public class AccountErasureService {

    private static final Logger log = LoggerFactory.getLogger(AccountErasureService.class);

    private final UserRepository users;
    private final JdbcClient jdbc;
    private final TransactionTemplate tx;
    private final Clock clock;

    public AccountErasureService(
            UserRepository users, JdbcClient jdbc, TransactionTemplate tx, Clock clock) {
        this.users = users;
        this.jdbc = jdbc;
        this.tx = tx;
        this.clock = clock;
    }

    @Scheduled(cron = "0 15 3 * * *", zone = "Asia/Phnom_Penh")
    public int eraseExpired() {
        List<UUID> due =
                users
                        .findByStatusAndDeletionRequestedAtBefore(
                                UserStatus.DELETION_PENDING,
                                clock.instant().minus(UserService.DELETION_GRACE))
                        .stream()
                        .map(User::getId)
                        .toList();
        int erased = 0;
        for (UUID id : due) {
            try {
                tx.executeWithoutResult(status -> erase(id));
                erased++;
            } catch (RuntimeException ex) {
                log.warn("Could not erase account {}, will retry tomorrow", id, ex);
            }
        }
        if (erased > 0) {
            log.info("Erased {} accounts after the 30-day grace period", erased);
        }
        return erased;
    }

    private void erase(UUID id) {
        User user = users.findById(id).orElseThrow();
        // Asked again or restored since the list was read: leave it.
        if (user.getStatus() != UserStatus.DELETION_PENDING) {
            return;
        }
        user.erase();
        users.saveAndFlush(user);
        for (String table :
                List.of(
                        "user_identities",
                        "refresh_tokens",
                        "push_tokens",
                        "user_settings",
                        "notifications")) {
            jdbc.sql("delete from " + table + " where user_id = :id").param("id", id).update();
        }
        jdbc.sql("update creator_profiles set bio = null where user_id = :id")
                .param("id", id)
                .update();
    }
}
