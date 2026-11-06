package app.phumreader.auth.web;

import app.phumreader.auth.service.AuthService;
import app.phumreader.auth.service.AuthService.ClientInfo;
import app.phumreader.auth.service.AuthService.PendingSignup;
import app.phumreader.auth.service.AuthService.SignIn;
import app.phumreader.auth.web.AuthRequests.EmailRequest;
import app.phumreader.auth.web.AuthRequests.LoginRequest;
import app.phumreader.auth.web.AuthRequests.ResetPasswordRequest;
import app.phumreader.auth.web.AuthRequests.SignupRequest;
import app.phumreader.auth.web.AuthRequests.SignupResponse;
import app.phumreader.auth.web.AuthRequests.VerifyRequest;
import app.phumreader.common.error.ApiException;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.user.web.MeResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sign-in endpoints. Successful sign-ins set two HttpOnly cookies ({@code phumreader_at}, {@code
 * phumreader_rt}); every POST needs the {@code X-XSRF-TOKEN} header (value of the {@code
 * XSRF-TOKEN} cookie, which {@code GET /auth/csrf} sets).
 */
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "auth")
class AuthController {

    private final AuthService auth;
    private final AuthCookies cookies;

    AuthController(AuthService auth, AuthCookies cookies) {
        this.auth = auth;
        this.cookies = cookies;
    }

    @GetMapping("/csrf")
    @Operation(summary = "Sets the XSRF-TOKEN cookie that every POST must echo in X-XSRF-TOKEN")
    ResponseEntity<Void> csrf(@Parameter(hidden = true) CsrfToken token) {
        // Reading the token makes Spring Security write the cookie.
        token.getToken();
        return ResponseEntity.noContent().header(HttpHeaders.CACHE_CONTROL, "no-store").build();
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Creates an account and emails a 6-digit code",
            description = "409 email_taken when the email already has a confirmed account.")
    SignupResponse signUp(@Valid @RequestBody SignupRequest body, HttpServletRequest request) {
        PendingSignup pending =
                auth.signUp(
                        body.name(),
                        body.email(),
                        body.password(),
                        body.language(),
                        client(request));
        return new SignupResponse(
                pending.email(),
                pending.codeValidFor().toSeconds(),
                pending.resendAfter().toSeconds());
    }

    @PostMapping("/verify")
    @Operation(
            summary = "Confirms the email with its code and signs in",
            description = "400 invalid_code, code_expired or too_many_attempts (field: code).")
    MeResponse verify(
            @Valid @RequestBody VerifyRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        return signedIn(auth.verifyEmail(body.email(), body.code(), client(request)), response);
    }

    @PostMapping("/resend-code")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Emails a new code (429 resend_too_soon within 30 s)")
    void resendCode(@Valid @RequestBody EmailRequest body) {
        auth.resendCode(body.email());
    }

    @PostMapping("/login")
    @Operation(
            summary = "Signs in with email and password",
            description =
                    "401 invalid_credentials; 403 email_not_verified (a new code is sent) or"
                            + " account_banned; 429 too_many_attempts after 5 wrong passwords in 10"
                            + " minutes.")
    MeResponse logIn(
            @Valid @RequestBody LoginRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        boolean remember = body.remember() == null || body.remember();
        return signedIn(
                auth.logIn(body.email(), body.password(), remember, client(request)), response);
    }

    @PostMapping("/refresh")
    @Operation(
            summary = "New sign-in cookies from the refresh cookie",
            description =
                    "401 session_expired when the refresh cookie is missing, expired or reused.")
    MeResponse refresh(
            @Parameter(hidden = true) @CookieValue(name = AuthCookies.REFRESH, required = false)
                    String refreshToken,
            HttpServletRequest request,
            HttpServletResponse response) {
        try {
            return signedIn(auth.refresh(refreshToken, client(request)), response);
        } catch (ApiException ex) {
            cookies.clear(response);
            throw ex;
        }
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Signs this device out and clears the cookies")
    void logOut(
            @Parameter(hidden = true) @CookieValue(name = AuthCookies.REFRESH, required = false)
                    String refreshToken,
            HttpServletResponse response) {
        auth.logOut(refreshToken);
        cookies.clear(response);
    }

    @PostMapping("/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Signs the account out on every device")
    void logOutEverywhere(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            HttpServletResponse response) {
        auth.logOutEverywhere(user.id());
        cookies.clear(response);
    }

    @PostMapping("/forgot-password")
    @ResponseStatus(HttpStatus.ACCEPTED)
    @Operation(summary = "Emails a reset link when the account exists (same answer either way)")
    void forgotPassword(@Valid @RequestBody EmailRequest body, HttpServletRequest request) {
        auth.forgotPassword(body.email(), client(request));
    }

    @PostMapping("/reset-password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Sets a new password from a reset link and signs out every device",
            description = "400 invalid_token; 400 password_too_weak (field: password).")
    void resetPassword(@Valid @RequestBody ResetPasswordRequest body, HttpServletRequest request) {
        auth.resetPassword(body.token(), body.password(), client(request));
    }

    private MeResponse signedIn(SignIn signIn, HttpServletResponse response) {
        cookies.write(response, signIn.tokens());
        return MeResponse.from(signIn.account());
    }

    private static ClientInfo client(HttpServletRequest request) {
        return new ClientInfo(request.getRemoteAddr(), request.getHeader(HttpHeaders.USER_AGENT));
    }
}
