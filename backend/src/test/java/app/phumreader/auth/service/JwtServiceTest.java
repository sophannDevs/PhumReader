package app.phumreader.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.phumreader.support.MutableClock;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class JwtServiceTest {

    private static final KeyPair KEYS = newKeys();
    private final MutableClock clock = new MutableClock();
    private final JwtService jwt =
            new JwtService(KEYS, JsonMapper.builder().build(), clock, Duration.ofMinutes(15));

    @Test
    void issuedTokenVerifiesWithItsClaims() {
        UUID user = UUID.randomUUID();
        JwtService.AccessToken token = jwt.issue(user, List.of("READER", "CREATOR"));

        assertThat(token.value().split("\\.")).hasSize(3);
        assertThat(jwt.verify(token.value()))
                .hasValueSatisfying(claims -> {
                    assertThat(claims.userId()).isEqualTo(user);
                    assertThat(claims.roles()).containsExactlyInAnyOrder("READER", "CREATOR");
                    assertThat(claims.expiresAt()).isEqualTo(token.expiresAt());
                });
    }

    @Test
    void expiredTokenIsRejected() {
        String token = jwt.issue(UUID.randomUUID(), List.of("READER")).value();
        clock.advance(Duration.ofMinutes(15));
        assertThat(jwt.verify(token)).isEmpty();
    }

    @Test
    void changedPayloadIsRejected() {
        String[] parts = jwt.issue(UUID.randomUUID(), List.of("READER")).value().split("\\.");
        String admin =
                Base64.getUrlEncoder()
                        .withoutPadding()
                        .encodeToString(
                                new String(
                                                Base64.getUrlDecoder().decode(parts[1]),
                                                StandardCharsets.UTF_8)
                                        .replace("READER", "ADMIN")
                                        .getBytes(StandardCharsets.UTF_8));
        assertThat(jwt.verify(parts[0] + "." + admin + "." + parts[2])).isEmpty();
    }

    @Test
    void unsignedAndForeignTokensAreRejected() {
        String[] parts = jwt.issue(UUID.randomUUID(), List.of("READER")).value().split("\\.");
        String none =
                Base64.getUrlEncoder()
                        .withoutPadding()
                        .encodeToString("{\"alg\":\"none\"}".getBytes(StandardCharsets.UTF_8));
        assertThat(jwt.verify(none + "." + parts[1] + ".")).isEmpty();

        JwtService other =
                new JwtService(
                        newKeys(), JsonMapper.builder().build(), clock, Duration.ofMinutes(15));
        assertThat(jwt.verify(other.issue(UUID.randomUUID(), List.of("READER")).value())).isEmpty();
        assertThat(jwt.verify("not.a.token")).isEmpty();
        assertThat(jwt.verify("")).isEmpty();
    }

    private static KeyPair newKeys() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }
}
