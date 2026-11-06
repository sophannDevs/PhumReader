package app.phumreader.auth.web;

import app.phumreader.auth.service.AccountSecurityService;
import app.phumreader.auth.service.AccountSecurityService.Device;
import app.phumreader.auth.service.AccountSecurityService.EmailChangeStarted;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.user.web.MeResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Settings &gt; Account: password, email, devices, delete account (P3-17). Under {@code
 * /api/v1/auth} because the browser only sends the refresh cookie there, and these endpoints need
 * it to know which device is asking.
 */
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "account")
class AccountSecurityController {

    private final AccountSecurityService account;
    private final AuthCookies cookies;

    AccountSecurityController(AccountSecurityService account, AuthCookies cookies) {
        this.account = account;
        this.cookies = cookies;
    }

    @PostMapping("/change-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Sets a new password and signs out the other devices",
            description =
                    "400 wrong_password (field currentPassword) or password_too_weak (field"
                            + " newPassword); 429 too_many_attempts after 5 wrong passwords in 10"
                            + " minutes.")
    void changePassword(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Parameter(hidden = true) @CookieValue(name = AuthCookies.REFRESH, required = false)
                    String refreshToken,
            @Valid @RequestBody ChangePasswordRequest body) {
        account.changePassword(user.id(), body.currentPassword(), body.newPassword(), refreshToken);
    }

    @PostMapping("/change-email")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(
            summary = "Emails a 6-digit code to the new address",
            description =
                    "400 wrong_password (field password) or same_email; 409 email_taken; 429"
                            + " resend_too_soon within 30 s.")
    EmailChangeResponse changeEmail(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody ChangeEmailRequest body) {
        EmailChangeStarted started =
                account.startEmailChange(user.id(), body.newEmail(), body.password());
        return new EmailChangeResponse(
                started.email(),
                started.codeValidFor().toSeconds(),
                started.resendAfter().toSeconds());
    }

    @PostMapping("/change-email/confirm")
    @Operation(
            summary = "Confirms the new email with its code",
            description =
                    "400 invalid_code, code_expired or too_many_attempts (field code); 409"
                            + " email_taken.")
    MeResponse confirmEmail(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody CodeRequest body) {
        return MeResponse.from(account.confirmEmailChange(user.id(), body.code()));
    }

    @GetMapping("/devices")
    @Operation(summary = "Signed-in devices, this one first")
    DeviceList devices(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Parameter(hidden = true) @CookieValue(name = AuthCookies.REFRESH, required = false)
                    String refreshToken) {
        return new DeviceList(account.devices(user.id(), refreshToken));
    }

    @DeleteMapping("/devices/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Signs out one device",
            description =
                    "404 device_not_found. Signing out this device also clears its cookies. Its"
                            + " access token still works for up to 15 minutes.")
    void signOutDevice(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Parameter(hidden = true) @CookieValue(name = AuthCookies.REFRESH, required = false)
                    String refreshToken,
            @PathVariable UUID id,
            HttpServletResponse response) {
        if (account.signOutDevice(user.id(), id, refreshToken)) {
            cookies.clear(response);
        }
    }

    @PostMapping("/delete-account")
    @Operation(
            summary = "Deletes the account after 30 days and signs out every device",
            description =
                    "Logging in before deleteAfter keeps the account. 400 wrong_password (field"
                            + " password).")
    DeletionResponse deleteAccount(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody PasswordRequest body,
            HttpServletResponse response) {
        Instant deleteAfter = account.deleteAccount(user.id(), body.password());
        cookies.clear(response);
        return new DeletionResponse(deleteAfter);
    }

    record ChangePasswordRequest(
            @NotBlank @Size(max = 128) String currentPassword,
            @NotBlank @Size(max = 128) String newPassword) {}

    record ChangeEmailRequest(
            @NotBlank @Size(max = 254) @Pattern(regexp = AuthRequests.EMAIL) String newEmail,
            @NotBlank @Size(max = 128) String password) {}

    record CodeRequest(@NotBlank @Pattern(regexp = "\\d{6}") String code) {}

    record PasswordRequest(@NotBlank @Size(max = 128) String password) {}

    /**
     * @param email where the code was sent (normalized)
     * @param codeExpiresInSeconds how long the code works
     * @param resendAfterSeconds when the code may be sent again
     */
    record EmailChangeResponse(String email, long codeExpiresInSeconds, long resendAfterSeconds) {}

    record DeviceList(List<Device> items) {}

    /**
     * @param deleteAfter when the account and its personal data are erased
     */
    record DeletionResponse(Instant deleteAfter) {}
}
