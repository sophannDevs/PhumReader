package app.phumreader.auth.service;

import app.phumreader.config.AppProperties;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.Signature;
import java.security.interfaces.RSAPrivateCrtKey;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.RSAPublicKeySpec;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Signs and checks access tokens: JWTs signed with RS256 (SHA-256 with RSA), made with the JDK's
 * own crypto. Only RS256 tokens issued by PhumReader and not expired are accepted; anything else
 * (another algorithm, "none", a changed byte) is rejected.
 */
@Component
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    private static final String ISSUER = "phumreader";
    private static final String ALGORITHM = "SHA256withRSA";
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final String HEADER =
            ENCODER.encodeToString(
                    "{\"alg\":\"RS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));

    /** What a valid access token says. */
    public record AccessClaims(UUID userId, Set<String> roles, Instant expiresAt) {}

    /** A new access token and when it stops working. */
    public record AccessToken(String value, Instant expiresAt) {}

    private final RSAPrivateKey privateKey;
    private final RSAPublicKey publicKey;
    private final JsonMapper json;
    private final Clock clock;
    private final Duration lifetime;

    @Autowired
    public JwtService(AppProperties properties, JsonMapper json, Clock clock) {
        this(keysFrom(properties.auth()), json, clock, properties.auth().accessTokenTtl());
    }

    JwtService(KeyPair keys, JsonMapper json, Clock clock, Duration lifetime) {
        this.privateKey = (RSAPrivateKey) keys.getPrivate();
        this.publicKey = (RSAPublicKey) keys.getPublic();
        this.json = json;
        this.clock = clock;
        this.lifetime = lifetime;
    }

    public AccessToken issue(UUID userId, Collection<String> roles) {
        // Whole seconds, like the token's "exp" claim, so the expiry we report is the one we sign.
        Instant now = clock.instant().truncatedTo(ChronoUnit.SECONDS);
        Instant expiresAt = now.plus(lifetime);
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("iss", ISSUER);
        claims.put("sub", userId.toString());
        claims.put("iat", now.getEpochSecond());
        claims.put("exp", expiresAt.getEpochSecond());
        claims.put("roles", List.copyOf(roles));
        String payload = ENCODER.encodeToString(json.writeValueAsBytes(claims));
        String signingInput = HEADER + "." + payload;
        try {
            Signature signer = Signature.getInstance(ALGORITHM);
            signer.initSign(privateKey);
            signer.update(signingInput.getBytes(StandardCharsets.US_ASCII));
            String signature = ENCODER.encodeToString(signer.sign());
            return new AccessToken(signingInput + "." + signature, expiresAt);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Cannot sign access token", ex);
        }
    }

    /** The token's claims when it is genuine, unexpired and ours; empty otherwise. */
    public Optional<AccessClaims> verify(String token) {
        try {
            String[] parts = token.split("\\.", -1);
            if (parts.length != 3) {
                return Optional.empty();
            }
            Map<?, ?> header = json.readValue(DECODER.decode(parts[0]), Map.class);
            if (!"RS256".equals(header.get("alg")) || header.containsKey("crit")) {
                return Optional.empty();
            }
            Signature verifier = Signature.getInstance(ALGORITHM);
            verifier.initVerify(publicKey);
            verifier.update((parts[0] + "." + parts[1]).getBytes(StandardCharsets.US_ASCII));
            if (!verifier.verify(DECODER.decode(parts[2]))) {
                return Optional.empty();
            }
            Map<?, ?> claims = json.readValue(DECODER.decode(parts[1]), Map.class);
            if (!ISSUER.equals(claims.get("iss"))
                    || !(claims.get("exp") instanceof Number exp)
                    || !(claims.get("sub") instanceof String sub)
                    || !(claims.get("roles") instanceof List<?> roles)) {
                return Optional.empty();
            }
            Instant expiresAt = Instant.ofEpochSecond(exp.longValue());
            if (!clock.instant().isBefore(expiresAt)) {
                return Optional.empty();
            }
            Set<String> roleNames = Set.copyOf(roles.stream().map(String::valueOf).toList());
            return Optional.of(new AccessClaims(UUID.fromString(sub), roleNames, expiresAt));
        } catch (GeneralSecurityException | RuntimeException ex) {
            return Optional.empty();
        }
    }

    private static KeyPair keysFrom(AppProperties.Auth auth) {
        String pem = auth.jwtPrivateKey();
        if (pem != null && !pem.isBlank()) {
            return fromPem(pem);
        }
        if (auth.generateDevKeys()) {
            log.warn(
                    "Using a throw-away JWT signing key (phumreader.auth.generate-dev-keys):"
                            + " access tokens stop working after a restart.");
            try {
                KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
                generator.initialize(2048);
                return generator.generateKeyPair();
            } catch (GeneralSecurityException ex) {
                throw new IllegalStateException("Cannot generate an RSA key", ex);
            }
        }
        throw new IllegalStateException(
                "phumreader.auth.jwt-private-key is required (an RSA private key in PKCS#8 PEM,"
                        + " for example from the PHUMREADER_JWT_PRIVATE_KEY environment variable)");
    }

    /** Reads a PKCS#8 PEM RSA private key; the public key is derived from it. */
    static KeyPair fromPem(String pem) {
        String base64 =
                pem.replace("\\n", "\n")
                        .replace("-----BEGIN PRIVATE KEY-----", "")
                        .replace("-----END PRIVATE KEY-----", "")
                        .replaceAll("\\s", "");
        try {
            KeyFactory factory = KeyFactory.getInstance("RSA");
            RSAPrivateCrtKey key =
                    (RSAPrivateCrtKey)
                            factory.generatePrivate(
                                    new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
            RSAPublicKey publicKey =
                    (RSAPublicKey)
                            factory.generatePublic(
                                    new RSAPublicKeySpec(
                                            key.getModulus(), key.getPublicExponent()));
            return new KeyPair(publicKey, key);
        } catch (GeneralSecurityException | IllegalArgumentException | ClassCastException ex) {
            throw new IllegalStateException(
                    "phumreader.auth.jwt-private-key is not an RSA private key in PKCS#8 PEM", ex);
        }
    }
}
