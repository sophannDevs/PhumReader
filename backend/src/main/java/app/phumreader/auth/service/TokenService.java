package app.phumreader.auth.service;

import app.phumreader.auth.domain.RefreshToken;
import app.phumreader.auth.repository.RefreshTokenRepository;
import app.phumreader.common.error.ApiException;
import app.phumreader.config.AppProperties;
import app.phumreader.user.service.Account;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Access tokens (15 min JWT) and rotating refresh tokens (30 days, one family per device sign-in).
 * Using a refresh token that was already rotated logs that device out, unless it happens within
 * {@code refresh-reuse-grace} (two tabs refreshing at once).
 */
@Service
@Transactional(noRollbackFor = ApiException.class)
public class TokenService {

    private static final Logger log = LoggerFactory.getLogger(TokenService.class);
    private static final int DEVICE_NAME_MAX = 200;

    /** A refresh that worked: the new refresh token, still without an access token. */
    record Rotation(
            UUID userId, UUID familyId, boolean remember, String refreshToken, Instant expiresAt) {}

    private final RefreshTokenRepository tokens;
    private final JwtService jwt;
    private final Clock clock;
    private final Duration refreshLifetime;
    private final Duration reuseGrace;

    public TokenService(
            RefreshTokenRepository tokens, JwtService jwt, Clock clock, AppProperties properties) {
        this.tokens = tokens;
        this.jwt = jwt;
        this.clock = clock;
        this.refreshLifetime = properties.auth().refreshTokenTtl();
        this.reuseGrace = properties.auth().refreshReuseGrace();
    }

    /** A new device sign-in: a new refresh-token family and an access token. */
    IssuedTokens newSession(Account account, boolean remember, @Nullable String device) {
        Instant now = clock.instant();
        String refresh = Secrets.randomToken();
        RefreshToken token =
                tokens.save(
                        RefreshToken.issue(
                                account.id(),
                                UUID.randomUUID(),
                                Secrets.sha256(refresh),
                                deviceName(device),
                                remember,
                                now,
                                refreshLifetime));
        return withAccess(
                account,
                new Rotation(
                        account.id(),
                        token.getFamilyId(),
                        remember,
                        refresh,
                        token.getExpiresAt()));
    }

    /** Swaps a refresh token for a new one; 401 {@code session_expired} when it is not usable. */
    Rotation rotate(String refreshToken, @Nullable String device) {
        Instant now = clock.instant();
        RefreshToken token =
                tokens.findByTokenHashForUpdate(Secrets.sha256(refreshToken))
                        .orElseThrow(TokenService::sessionExpired);
        if (token.isRevoked() || token.isExpired(now)) {
            throw sessionExpired();
        }
        Instant rotatedAt = token.getRotatedAt();
        if (rotatedAt != null && Duration.between(rotatedAt, now).compareTo(reuseGrace) > 0) {
            // An old token came back: it may have been stolen. Sign this device out everywhere it
            // is used.
            tokens.revokeFamily(token.getFamilyId(), now);
            log.warn("Refresh token reused; signed out token family {}", token.getFamilyId());
            throw sessionExpired();
        }
        if (rotatedAt == null) {
            token.markRotated(now);
        }
        String next = Secrets.randomToken();
        RefreshToken child =
                tokens.save(
                        RefreshToken.issue(
                                token.getUserId(),
                                token.getFamilyId(),
                                Secrets.sha256(next),
                                deviceName(device),
                                token.isRemember(),
                                now,
                                refreshLifetime));
        return new Rotation(
                token.getUserId(),
                token.getFamilyId(),
                token.isRemember(),
                next,
                child.getExpiresAt());
    }

    IssuedTokens withAccess(Account account, Rotation rotation) {
        JwtService.AccessToken access = jwt.issue(account.id(), account.roles());
        return new IssuedTokens(
                access.value(),
                access.expiresAt(),
                rotation.refreshToken(),
                rotation.expiresAt(),
                rotation.remember());
    }

    /** Logs out the device that holds {@code refreshToken} (unknown tokens are ignored). */
    void revokeDeviceOf(String refreshToken) {
        tokens.findByTokenHash(Secrets.sha256(refreshToken))
                .ifPresent(t -> tokens.revokeFamily(t.getFamilyId(), clock.instant()));
    }

    void revokeFamily(UUID familyId) {
        tokens.revokeFamily(familyId, clock.instant());
    }

    /** Logs the user out on every device. */
    void revokeAll(UUID userId) {
        tokens.revokeAllOfUser(userId, clock.instant());
    }

    static ApiException sessionExpired() {
        return ApiException.unauthorized("session_expired", "Please log in again.");
    }

    private static @Nullable String deviceName(@Nullable String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return null;
        }
        return userAgent.length() <= DEVICE_NAME_MAX
                ? userAgent
                : userAgent.substring(0, DEVICE_NAME_MAX);
    }
}
