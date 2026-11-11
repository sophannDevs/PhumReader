package app.phumreader.auth.web;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Request bodies of the sign-in endpoints. Emails follow the website's rule (x@y.z). */
final class AuthRequests {

    static final String EMAIL = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$";

    private AuthRequests() {}

    /**
     * @param language the site language at sign-up, "en" or "km" (default "en")
     * @param birthYear from the sign-up form; 13 or older to join (400 too_young, field birthYear)
     */
    record SignupRequest(
            @NotBlank @Size(min = 2, max = 60) String name,
            @NotBlank @Size(max = 254) @Pattern(regexp = EMAIL) String email,
            @NotBlank @Size(max = 128) String password,
            @Nullable @Pattern(regexp = "en|km") String language,
            @Nullable @Min(1900) @Max(2100) Integer birthYear) {}

    record VerifyRequest(
            @NotBlank @Size(max = 254) @Pattern(regexp = EMAIL) String email,
            @NotBlank @Pattern(regexp = "\\d{6}") String code) {}

    record EmailRequest(@NotBlank @Size(max = 254) @Pattern(regexp = EMAIL) String email) {}

    /**
     * @param remember keep the sign-in after the browser closes (default true)
     */
    record LoginRequest(
            @NotBlank @Size(max = 254) @Pattern(regexp = EMAIL) String email,
            @NotBlank @Size(max = 128) String password,
            @Nullable Boolean remember) {}

    /**
     * @param token from the reset link ({@code /reset?token=})
     */
    record ResetPasswordRequest(
            @NotBlank @Size(max = 200) String token, @NotBlank @Size(max = 128) String password) {}

    /**
     * @param email where the code was sent (normalized)
     * @param codeExpiresInSeconds how long the code works
     * @param resendAfterSeconds when "Resend code" may be used
     */
    record SignupResponse(String email, long codeExpiresInSeconds, long resendAfterSeconds) {}
}
