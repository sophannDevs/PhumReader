package app.phumreader.user.service;

import app.phumreader.user.domain.Role;
import app.phumreader.user.domain.User;
import app.phumreader.user.domain.UserStatus;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What other features and the web layer may know about an account (never the entity). */
public record Account(
        UUID id,
        String email,
        String displayName,
        @Nullable String avatarUrl,
        List<String> roles,
        boolean emailVerified,
        UserStatus status) {

    public static Account of(User user) {
        return new Account(
                user.getId(),
                user.getEmail(),
                user.getDisplayName(),
                user.getAvatarUrl(),
                user.getRoles().stream().map(Role::name).sorted().toList(),
                user.isEmailVerified(),
                user.getStatus());
    }
}
