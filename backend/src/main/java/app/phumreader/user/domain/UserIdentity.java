package app.phumreader.user.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Persistable;

/**
 * An account's Google or Facebook sign-in (table {@code user_identities}): the provider and the
 * provider's own id for the person. One provider id belongs to one account.
 */
@Entity
@Table(name = "user_identities")
public class UserIdentity implements Persistable<UUID> {

    @Id private UUID id;

    private UUID userId;

    @Enumerated(EnumType.STRING)
    private SocialProvider provider;

    private String providerUserId;

    @Nullable private String email;

    private Instant createdAt;

    private transient boolean isNew;

    protected UserIdentity() {}

    public static UserIdentity link(
            UUID userId,
            SocialProvider provider,
            String providerUserId,
            @Nullable String email,
            Instant now) {
        UserIdentity identity = new UserIdentity();
        identity.id = UUID.randomUUID();
        identity.userId = userId;
        identity.provider = provider;
        identity.providerUserId = providerUserId;
        identity.email = email;
        identity.createdAt = now;
        identity.isNew = true;
        return identity;
    }

    @Override
    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public SocialProvider getProvider() {
        return provider;
    }

    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostPersist
    @PostLoad
    void markStored() {
        isNew = false;
    }
}
