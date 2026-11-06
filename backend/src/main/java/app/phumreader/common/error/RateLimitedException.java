package app.phumreader.common.error;

import java.time.Duration;
import org.springframework.http.HttpStatus;

/**
 * 429 with how long to wait: sent as the {@code Retry-After} header and {@code retryAfterSeconds}.
 */
public class RateLimitedException extends ApiException {

    private final Duration retryAfter;

    public RateLimitedException(String code, Duration retryAfter) {
        super(HttpStatus.TOO_MANY_REQUESTS, code, "Too many attempts. Try again later.");
        this.retryAfter = retryAfter;
    }

    public Duration retryAfter() {
        return retryAfter;
    }
}
