package app.phumreader.auth.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Persistable;

/**
 * One refresh token (table {@code refresh_tokens}); only its SHA-256 hash is stored. All tokens of
 * one device sign-in share a {@code familyId}: each refresh marks the old token rotated and adds a
 * new one to the family.
 */
@Entity
@Table(name = "refresh_tokens")
public class RefreshToken implements Persistable<UUID> {

    @Id private UUID id;

    private UUID userId;

    private UUID familyId;

    private String tokenHash;

    @Nullable private String deviceName;

    private boolean remember;

    private Instant createdAt;

    private Instant expiresAt;

    @Nullable private Instant lastUsedAt;

    @Nullable private Instant rotatedAt;

    @Nullable private Instant revokedAt;

    private transient boolean isNew;

    protected RefreshToken() {}

    public static RefreshToken issue(
            UUID userId,
            UUID familyId,
            String tokenHash,
            @Nullable String deviceName,
            boolean remember,
            Instant now,
            Duration lifetime) {
        RefreshToken token = new RefreshToken();
        token.id = UUID.randomUUID();
        token.userId = userId;
        token.familyId = familyId;
        token.tokenHash = tokenHash;
        token.deviceName = deviceName;
        token.remember = remember;
        token.createdAt = now;
        token.expiresAt = now.plus(lifetime);
        token.isNew = true;
        return token;
    }

    public void markRotated(Instant now) {
        rotatedAt = now;
        lastUsedAt = now;
    }

    public boolean isRevoked() {
        return revokedAt != null;
    }

    public boolean isExpired(Instant now) {
        return !now.isBefore(expiresAt);
    }

    public boolean isRotated() {
        return rotatedAt != null;
    }

    public @Nullable Instant getRotatedAt() {
        return rotatedAt;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getFamilyId() {
        return familyId;
    }

    public boolean isRemember() {
        return remember;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    @Override
    public UUID getId() {
        return id;
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
