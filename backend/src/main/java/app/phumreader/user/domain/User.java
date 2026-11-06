package app.phumreader.user.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.EnumSet;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Persistable;

/** An account (table {@code users}). */
@Entity
@Table(name = "users")
public class User implements Persistable<UUID> {

    @Id private UUID id;

    private String email;

    @Nullable private Instant emailVerifiedAt;

    @Nullable private String passwordHash;

    private String displayName;

    @Nullable private String avatarUrl;

    @Enumerated(EnumType.STRING)
    private UserStatus status;

    @Nullable private Instant deletionRequestedAt;

    @Nullable private Instant lastLoginAt;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role")
    @Enumerated(EnumType.STRING)
    private Set<Role> roles = EnumSet.noneOf(Role.class);

    @CreationTimestamp private Instant createdAt;

    @UpdateTimestamp private Instant updatedAt;

    private transient boolean isNew;

    protected User() {}

    /** A new reader who still has to confirm their email. */
    public static User newReader(String email, String displayName, String passwordHash) {
        User user = new User();
        user.id = UUID.randomUUID();
        user.email = normalizeEmail(email);
        user.displayName = displayName.trim();
        user.passwordHash = passwordHash;
        user.status = UserStatus.ACTIVE;
        user.roles.add(Role.READER);
        user.isNew = true;
        return user;
    }

    /** Emails are stored trimmed and in lower case; compare with this. */
    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public void changeUnverifiedSignup(String displayName, String passwordHash) {
        this.displayName = displayName.trim();
        this.passwordHash = passwordHash;
    }

    public void verifyEmail(Instant now) {
        if (emailVerifiedAt == null) {
            emailVerifiedAt = now;
        }
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void recordLogin(Instant now) {
        lastLoginAt = now;
    }

    public boolean isEmailVerified() {
        return emailVerifiedAt != null;
    }

    @Override
    public UUID getId() {
        return id;
    }

    /** Ids are made by the app, so Spring Data needs to be told when to INSERT. */
    @Override
    public boolean isNew() {
        return isNew;
    }

    @PostPersist
    @PostLoad
    void markStored() {
        isNew = false;
    }

    public String getEmail() {
        return email;
    }

    public @Nullable String getPasswordHash() {
        return passwordHash;
    }

    public String getDisplayName() {
        return displayName;
    }

    public @Nullable String getAvatarUrl() {
        return avatarUrl;
    }

    public UserStatus getStatus() {
        return status;
    }

    public Set<Role> getRoles() {
        return Set.copyOf(roles);
    }
}
