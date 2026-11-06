package app.phumreader.support;

import app.phumreader.auth.service.JwtService;
import app.phumreader.auth.web.AuthCookies;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Signed-in requests for API tests: an access cookie minted with the app's own {@link JwtService}
 * plus the CSRF cookie and header every write needs. Also creates throw-away readers (inside the
 * test's transaction, so they are rolled back).
 */
public final class Sessions {

    private static final String XSRF = "test-xsrf-token";

    private final JwtService jwt;
    private final JdbcClient jdbc;

    public Sessions(JwtService jwt, JdbcClient jdbc) {
        this.jwt = jwt;
        this.jdbc = jdbc;
    }

    /** Requests as this user (roles as given, READER when none). */
    public RequestPostProcessor as(UUID userId, String... roles) {
        List<String> granted = roles.length == 0 ? List.of("READER") : List.of(roles);
        String token = jwt.issue(userId, granted).value();
        return request -> {
            request.setCookies(
                    new Cookie(AuthCookies.ACCESS, token), new Cookie("XSRF-TOKEN", XSRF));
            request.addHeader("X-XSRF-TOKEN", XSRF);
            return request;
        };
    }

    /** A signed-out browser that still sends the CSRF cookie and header. */
    public RequestPostProcessor guest() {
        return request -> {
            request.setCookies(new Cookie("XSRF-TOKEN", XSRF));
            request.addHeader("X-XSRF-TOKEN", XSRF);
            return request;
        };
    }

    /** A signed-in user whose write has no CSRF header. */
    public RequestPostProcessor withoutCsrf(UUID userId) {
        String token = jwt.issue(userId, List.of("READER")).value();
        return request -> {
            request.setCookies(new Cookie(AuthCookies.ACCESS, token));
            return request;
        };
    }

    /** A new confirmed reader. */
    public UUID newReader(String name) {
        UUID id = UUID.randomUUID();
        jdbc.sql(
                        "insert into users (id, email, email_verified_at, display_name)"
                                + " values (:id, :email, now(), :name)")
                .param("id", id)
                .param("email", id + "@readers.test")
                .param("name", name)
                .update();
        jdbc.sql("insert into user_roles (user_id, role) values (:id, 'READER')")
                .param("id", id)
                .update();
        return id;
    }

    /** Id of a seeded account by email (the demo reader, the stand-in creator). */
    public UUID userId(String email) {
        return jdbc.sql("select id from users where email = :email")
                .param("email", email)
                .query(UUID.class)
                .single();
    }

    /** Id of a seeded creator by pen name. */
    public UUID creatorId(String penName) {
        return jdbc.sql("select user_id from creator_profiles where pen_name = :name")
                .param("name", penName)
                .query(UUID.class)
                .single();
    }
}
