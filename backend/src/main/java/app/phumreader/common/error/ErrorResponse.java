package app.phumreader.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.Map;

/**
 * The one error body the API returns: {@code {"error": {"code", "message", "fields"?}}}.
 *
 * @param error what went wrong
 */
@Schema(description = "Body of every error response.")
public record ErrorResponse(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED) ErrorDetail error) {

    /**
     * @param code stable snake_case code the website switches on, for example {@code
     *     validation_failed}
     * @param message short English explanation for logs and developers (the website shows its own
     *     translated text)
     * @param fields per-field problems for validation errors, keyed by field name
     */
    @JsonInclude(JsonInclude.Include.NON_EMPTY)
    public record ErrorDetail(
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED, example = "validation_failed")
                    String code,
            @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String message,
            Map<String, String> fields) {}

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(new ErrorDetail(code, message, Map.of()));
    }

    public static ErrorResponse of(String code, String message, Map<String, String> fields) {
        return new ErrorResponse(new ErrorDetail(code, message, Map.copyOf(fields)));
    }
}
