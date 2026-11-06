package app.phumreader.user.web;

import app.phumreader.user.service.Account;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * The signed-in account, as the header and Settings show it.
 *
 * @param roles READER, plus CREATOR and ADMIN when granted
 */
public record MeResponse(
        UUID id,
        String email,
        String displayName,
        @Nullable String avatarUrl,
        List<String> roles,
        boolean emailVerified) {

    public static MeResponse from(Account account) {
        return new MeResponse(
                account.id(),
                account.email(),
                account.displayName(),
                account.avatarUrl(),
                account.roles(),
                account.emailVerified());
    }
}
