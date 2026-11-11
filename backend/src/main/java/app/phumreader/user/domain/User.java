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

    /** From the sign-up form; null for accounts made with Google or Facebook. */
    @Nullable private Integer birthYear;

    @Enumerated(EnumType.STRING)
    private UserStatus status;

    @Nullable private Instant deletionRequestedAt;

    /** A timed suspension ends then (V21-04); null while suspended = until an admin lifts it. */
    @Nullable private Instant suspendedUntil;

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

    /** A new reader from Google or Facebook: the provider confirmed the email; no password. */
    public static User newSocialReader(String email, String displayName, Instant now) {
        User user = newReader(email, displayName, null);
        user.emailVerifiedAt = now;
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

    /**
     * Removes the password of an account that never confirmed its email: whoever typed it may not
     * be the owner of the address (used when the real owner signs in with Google or Facebook).
     */
    public void removePassword() {
        this.passwordHash = null;
    }

    public void changePassword(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public void recordLogin(Instant now) {
        lastLoginAt = now;
    }

    /** Adds the CREATOR role (after the Creator terms were accepted, A11). */
    public void grantCreator() {
        roles.add(Role.CREATOR);
    }

    /** A new profile picture, or none ({@code null}) to go back to the initials. */
    public void changeBirthYear(@Nullable Integer year) {
        this.birthYear = year;
    }

    public void changeAvatar(@Nullable String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public void rename(String displayName) {
        this.displayName = displayName.trim();
    }

    /** A new address that was just confirmed with a code. */
    public void changeEmail(String email, Instant now) {
        this.email = normalizeEmail(email);
        this.emailVerifiedAt = now;
    }

    /** An admin suspends the account (P3-18); {@code false} when it was already suspended. */
    public boolean ban() {
        return ban(null);
    }

    /**
     * Suspends the account until {@code until} (V21-04); {@code null} = until an admin lifts it.
     * {@code false} when it was already suspended.
     */
    public boolean ban(@Nullable Instant until) {
        if (status == UserStatus.BANNED) {
            return false;
        }
        status = UserStatus.BANNED;
        suspendedUntil = until;
        deletionRequestedAt = null;
        return true;
    }

    /**
     * Ends a timed suspension whose date has passed (checked at sign-in and refresh, so no job is
     * needed).
     *
     * @return whether the account is active again
     */
    public boolean liftSuspensionIfOver(Instant now) {
        if (status == UserStatus.BANNED && suspendedUntil != null && !suspendedUntil.isAfter(now)) {
            status = UserStatus.ACTIVE;
            suspendedUntil = null;
            return true;
        }
        return false;
    }

    @Nullable
    public Instant getSuspendedUntil() {
        return suspendedUntil;
    }

    /** Lifts a suspension; {@code false} when the account was not suspended. */
    public boolean unban() {
        if (status != UserStatus.BANNED) {
            return false;
        }
        status = UserStatus.ACTIVE;
        suspendedUntil = null;
        return true;
    }

    /**
     * Erases the personal data when the grace period is over (A18): the address becomes a unique
     * placeholder that cannot receive mail (and is free to sign up with again), the name, password
     * and avatar are removed. The row stays, so comments, ledger entries and the creator's series
     * keep pointing at someone.
     */
    public void erase() {
        email = "deleted-" + id + "@deleted.invalid";
        displayName = "Deleted account";
        passwordHash = null;
        avatarUrl = null;
        status = UserStatus.DELETED;
        deletionRequestedAt = null;
    }

    /** Starts the 30-day grace period (A18); asking again keeps the first date. */
    public void requestDeletion(Instant now) {
        if (status != UserStatus.DELETION_PENDING) {
            status = UserStatus.DELETION_PENDING;
            deletionRequestedAt = now;
        }
    }

    /** Ends the grace period; {@code false} when no deletion was pending. */
    public boolean cancelDeletion() {
        if (status != UserStatus.DELETION_PENDING) {
            return false;
        }
        status = UserStatus.ACTIVE;
        deletionRequestedAt = null;
        return true;
    }

    public @Nullable Instant getDeletionRequestedAt() {
        return deletionRequestedAt;
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

    public @Nullable Integer getBirthYear() {
        return birthYear;
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
