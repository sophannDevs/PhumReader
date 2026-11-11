package app.phumreader.notification.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.notification.service.PushTokens;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Web push registration: the browser sends the token Firebase gave it once the reader allows it.
 */
@RestController
@RequestMapping("/api/v1/me/push-token")
@Tag(name = "account")
class PushTokenController {

    private final PushTokens tokens;

    PushTokenController(PushTokens tokens) {
        this.tokens = tokens;
    }

    /**
     * @param token the Firebase Cloud Messaging registration token of this browser
     */
    record TokenRequest(@NotBlank @Size(max = 4096) String token) {}

    @PutMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Saves this browser's push token",
            description =
                    "New-episode notices go to every saved token of the account while"
                            + " Settings > Notifications > New episodes push is on, outside the"
                            + " quiet hours.")
    void register(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody TokenRequest body) {
        tokens.register(user.id(), body.token());
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Forgets this browser's push token (the reader turned push off)")
    void unregister(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody TokenRequest body) {
        tokens.unregister(user.id(), body.token());
    }
}
