package app.phumreader.user.repository;

import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserStatus;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** {@code email} must already be normalized ({@link User#normalizeEmail}). */
    Optional<User> findByEmail(String email);

    /** Accounts whose deletion was requested before {@code cutoff}. */
    List<User> findByStatusAndDeletionRequestedAtBefore(UserStatus status, Instant cutoff);
}
