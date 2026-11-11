package app.phumreader.user.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.user.repository.BlockQueries;
import app.phumreader.user.repository.BlockQueries.BlockedRow;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Block and unblock accounts (V21-04). A block hides the blocked person's comments for the blocker
 * (the comment threads flag them) and stops their likes from reaching the blocker's inbox. It is
 * stored with the account, so it applies on every device.
 */
@Service
public class BlockService {

    /** A blocked account. */
    public record BlockedAccount(
            UUID userId, String name, @Nullable String avatarUrl, Instant blockedAt) {}

    private final BlockQueries queries;
    private final Clock clock;

    public BlockService(BlockQueries queries, Clock clock) {
        this.queries = queries;
        this.clock = clock;
    }

    /**
     * Blocks the account; blocking someone twice changes nothing. 400 {@code cannot_block_self}.
     */
    @Transactional
    public void block(UUID blocker, UUID blocked) {
        if (blocker.equals(blocked)) {
            throw ApiException.badRequest("cannot_block_self", "You cannot block yourself.");
        }
        if (!queries.userExists(blocked)) {
            throw ApiException.notFound("user_not_found", "No such account.");
        }
        queries.add(blocker, blocked, clock.instant().atOffset(ZoneOffset.UTC));
    }

    /** Unblocks the account; unblocking someone who is not blocked changes nothing. */
    @Transactional
    public void unblock(UUID blocker, UUID blocked) {
        queries.remove(blocker, blocked);
    }

    public List<BlockedAccount> list(UUID blocker) {
        return queries.list(blocker).stream().map(BlockService::view).toList();
    }

    /** Which of these accounts the user blocked. */
    public Set<UUID> blockedAmong(UUID blocker, Collection<UUID> candidates) {
        return queries.blockedAmong(blocker, candidates);
    }

    public boolean isBlocked(UUID blocker, UUID blocked) {
        return queries.exists(blocker, blocked);
    }

    private static BlockedAccount view(BlockedRow r) {
        return new BlockedAccount(r.userId(), r.name(), r.avatarUrl(), r.blockedAt().toInstant());
    }
}
