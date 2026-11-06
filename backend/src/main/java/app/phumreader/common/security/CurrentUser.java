package app.phumreader.common.security;

import java.util.Set;
import java.util.UUID;

/**
 * The signed-in user of the current request, taken from the access token. Controllers receive it
 * with {@code @AuthenticationPrincipal CurrentUser user}.
 *
 * @param id the user's id
 * @param roles READER, CREATOR, ADMIN
 */
public record CurrentUser(UUID id, Set<String> roles) {

    public CurrentUser {
        roles = Set.copyOf(roles);
    }

    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
