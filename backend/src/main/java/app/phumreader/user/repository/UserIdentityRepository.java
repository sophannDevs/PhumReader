package app.phumreader.user.repository;

import app.phumreader.user.domain.SocialProvider;
import app.phumreader.user.domain.UserIdentity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserIdentityRepository extends JpaRepository<UserIdentity, UUID> {

    Optional<UserIdentity> findByProviderAndProviderUserId(
            SocialProvider provider, String providerUserId);
}
