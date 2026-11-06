package app.phumreader.common.error;

import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationTrustResolver;
import org.springframework.security.authentication.AuthenticationTrustResolverImpl;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Turns every exception into the shared {@link ErrorResponse} body with the right status. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    private static final AuthenticationTrustResolver trustResolver =
            new AuthenticationTrustResolverImpl();

    /** Also documents the error body as the "default" response of every operation in OpenAPI. */
    @ExceptionHandler(ApiException.class)
    @ApiResponse(
            responseCode = "default",
            description = "Error",
            content =
                    @Content(
                            mediaType = "application/json",
                            schema = @Schema(implementation = ErrorResponse.class)))
    ResponseEntity<ErrorResponse> api(ApiException ex) {
        return body(ex.status(), ex.code(), ex.getMessage(), ex.fields());
    }

    @ExceptionHandler(LockedException.class)
    ResponseEntity<ErrorResponse> locked(LockedException ex) {
        return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
                .body(ErrorResponse.locked(ex.code(), ex.getMessage(), ex.price(), ex.freeOn()));
    }

    @ExceptionHandler(RateLimitedException.class)
    ResponseEntity<ErrorResponse> rateLimited(RateLimitedException ex) {
        long seconds = Math.max(1, ex.retryAfter().toSeconds());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(seconds))
                .body(ErrorResponse.tooManyRequests(ex.code(), ex.getMessage(), seconds));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> invalidBody(MethodArgumentNotValidException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), String.valueOf(error.getDefaultMessage()));
        }
        return validationFailed(fields);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ErrorResponse> invalidParameters(HandlerMethodValidationException ex) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getParameterValidationResults()
                .forEach(result -> {
                    String name = result.getMethodParameter().getParameterName();
                    String message =
                            result.getResolvableErrors().isEmpty()
                                    ? "is not valid"
                                    : result.getResolvableErrors().getFirst().getDefaultMessage();
                    fields.putIfAbsent(String.valueOf(name), String.valueOf(message));
                });
        return validationFailed(fields);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErrorResponse> unreadable(HttpMessageNotReadableException ex) {
        return body(
                HttpStatus.BAD_REQUEST,
                "malformed_request",
                "The request body could not be read.",
                Map.of());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ErrorResponse> missingParameter(MissingServletRequestParameterException ex) {
        return body(
                HttpStatus.BAD_REQUEST,
                "missing_parameter",
                "A required parameter is missing.",
                Map.of(ex.getParameterName(), "is required"));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ErrorResponse> wrongType(MethodArgumentTypeMismatchException ex) {
        return body(
                HttpStatus.BAD_REQUEST,
                "invalid_parameter",
                "A parameter has the wrong format.",
                Map.of(ex.getName(), "has the wrong format"));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ErrorResponse> noRoute(NoResourceFoundException ex) {
        return body(
                HttpStatus.NOT_FOUND, "not_found", "Nothing was found at this address.", Map.of());
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ErrorResponse> unauthenticated(AuthenticationException ex) {
        return unauthorized();
    }

    @ExceptionHandler(CsrfException.class)
    ResponseEntity<ErrorResponse> csrf(CsrfException ex) {
        return body(
                HttpStatus.FORBIDDEN,
                "invalid_csrf_token",
                "The CSRF token is missing or not valid.",
                Map.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ErrorResponse> denied(AccessDeniedException ex) {
        // A guest who reaches a protected method needs to log in (401), not a "forbidden" (403).
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || trustResolver.isAnonymous(authentication)) {
            return unauthorized();
        }
        return body(HttpStatus.FORBIDDEN, "forbidden", "You do not have access to this.", Map.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception ex) {
        // Other Spring MVC errors (405, 415 and so on) carry their own status.
        if (ex instanceof org.springframework.web.ErrorResponse springError) {
            HttpStatusCode status = springError.getStatusCode();
            HttpStatus known = HttpStatus.resolve(status.value());
            String code = known == null ? "http_" + status.value() : snake(known);
            String message = known == null ? "The request failed." : known.getReasonPhrase() + ".";
            return body(status, code, message, Map.of());
        }
        log.error("Unexpected error", ex);
        return body(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "internal_error",
                "Something went wrong on our side.",
                Map.of());
    }

    private static ResponseEntity<ErrorResponse> validationFailed(Map<String, String> fields) {
        return body(
                HttpStatus.BAD_REQUEST, "validation_failed", "Some fields are not valid.", fields);
    }

    private static ResponseEntity<ErrorResponse> unauthorized() {
        return body(HttpStatus.UNAUTHORIZED, "unauthorized", "Log in to continue.", Map.of());
    }

    private static ResponseEntity<ErrorResponse> body(
            HttpStatusCode status, String code, String message, Map<String, String> fields) {
        return ResponseEntity.status(status).body(ErrorResponse.of(code, message, fields));
    }

    private static String snake(HttpStatus status) {
        return status.name().toLowerCase(Locale.ROOT);
    }
}
