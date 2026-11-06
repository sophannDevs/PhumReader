package app.phumreader.user.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "account")
class MeController {

    private final UserService users;

    MeController(UserService users) {
        this.users = users;
    }

    @GetMapping("/me")
    @Operation(summary = "The signed-in account (401 when not signed in)")
    MeResponse me(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return MeResponse.from(users.account(user.id()));
    }
}
