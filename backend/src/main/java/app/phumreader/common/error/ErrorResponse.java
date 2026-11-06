package app.phumreader.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/**
 * The one error body the API returns: {@code {"error": {"code", "message", "fields"?,
 * "retryAfterSeconds"?}}}.
 *
 * @param error what went wrong
 */
@Schema(description = "Body of every error response.")
public record ErrorResponse(ErrorDetail error) {

    /**
     * @param code stable snake_case code the website switches on, for example {@code
     *     validation_failed}
     * @param message short English explanation for logs and developers (the website shows its own
     *     translated text)
     * @param fields per-field problems for validation errors, keyed by field name
     * @param retryAfterSeconds for 429: how long to wait before trying again
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    public record ErrorDetail(
            @Schema(example = "validation_failed") String code,
            String message,
            @Nullable Map<String, String> fields,
            @Nullable Long retryAfterSeconds) {}

    public static ErrorResponse of(String code, String message) {
        return of(code, message, Map.of());
    }

    public static ErrorResponse of(String code, String message, Map<String, String> fields) {
        return new ErrorResponse(new ErrorDetail(code, message, Map.copyOf(fields), null));
    }

    public static ErrorResponse tooManyRequests(
            String code, String message, long retryAfterSeconds) {
        return new ErrorResponse(new ErrorDetail(code, message, Map.of(), retryAfterSeconds));
    }
}
