package app.phumreader.user.repository;

import app.phumreader.user.domain.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** {@code email} must already be normalized ({@link User#normalizeEmail}). */
    Optional<User> findByEmail(String email);
}
