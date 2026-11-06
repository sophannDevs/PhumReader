package app.phumreader.common.idempotency;

import app.phumreader.common.error.ApiException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Stored answers of money and access requests ({@code Idempotency-Key} header), so a retry with the
 * same key repeats the first answer instead of charging again. Callers hold the reader's wallet
 * lock while they look up and save, so two requests with the same key never both run.
 *
 * <p>A key is used once per user and scope ("unlock", "order"); reusing it for a different request
 * is refused with 409. Keys are kept for 24 hours.
 */
@Component
public class IdempotencyKeys {

    /** HTTP header carrying the key. */
    public static final String HEADER = "Idempotency-Key";

    static final Duration KEEP = Duration.ofHours(24);

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final Clock clock;

    public IdempotencyKeys(JdbcClient jdbc, JsonMapper json, Clock clock) {
        this.jdbc = jdbc;
        this.json = json;
        this.clock = clock;
    }

    /**
     * Checks the header value: 8 to 100 visible characters.
     *
     * @throws ApiException 400 {@code missing_idempotency_key} or {@code invalid_idempotency_key}
     */
    public static String require(@Nullable String key) {
        if (key == null || key.isBlank()) {
            throw ApiException.badRequest(
                    "missing_idempotency_key", "Send an Idempotency-Key header with this request.");
        }
        String value = key.strip();
        if (value.length() < 8 || value.length() > 100 || !value.matches("[\\x21-\\x7E]+")) {
            throw ApiException.badRequest(
                    "invalid_idempotency_key",
                    "The Idempotency-Key must be 8 to 100 visible ASCII characters.");
        }
        return value;
    }

    /**
     * The answer stored for this key, if the same request was made before.
     *
     * @param request a description of the request (what it is for), compared on reuse
     * @throws ApiException 409 {@code idempotency_key_reused} when the key was used for a different
     *     request
     */
    public <T> Optional<T> find(
            UUID userId, String scope, String key, String request, Class<T> type) {
        return jdbc.sql(
                        "select request_hash, response_body::text as body from idempotency_keys"
                                + " where user_id = :u and scope = :scope and key = :key"
                                + " and expires_at > :now")
                .param("u", userId)
                .param("scope", scope)
                .param("key", key)
                .param("now", clock.instant().atOffset(ZoneOffset.UTC))
                .query((rs, n) -> new String[] {rs.getString("request_hash"), rs.getString("body")})
                .optional()
                .map(row -> {
                    if (!row[0].equals(hash(request))) {
                        throw ApiException.conflict(
                                "idempotency_key_reused",
                                "This Idempotency-Key was already used for a different request.");
                    }
                    return json.readValue(row[1], type);
                });
    }

    /** Remembers the answer for this key (replacing an expired one). */
    public void save(UUID userId, String scope, String key, String request, Object response) {
        var now = clock.instant().atOffset(ZoneOffset.UTC);
        jdbc.sql(
                        """
                        insert into idempotency_keys
                            (user_id, scope, key, request_hash, response_status, response_body,
                             created_at, expires_at)
                        values (:u, :scope, :key, :hash, 200, cast(:body as jsonb), :now, :expires)
                        on conflict (user_id, scope, key) do update set
                            request_hash = excluded.request_hash,
                            response_status = excluded.response_status,
                            response_body = excluded.response_body,
                            created_at = excluded.created_at,
                            expires_at = excluded.expires_at
                        where idempotency_keys.expires_at <= excluded.created_at
                        """)
                .param("u", userId)
                .param("scope", scope)
                .param("key", key)
                .param("hash", hash(request))
                .param("body", json.writeValueAsString(response))
                .param("now", now)
                .param("expires", now.plus(KEEP))
                .update();
    }

    private static String hash(String request) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(request.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
