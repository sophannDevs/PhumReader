package app.phumreader.user.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.user.service.BlockService;
import app.phumreader.user.service.BlockService.BlockedAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Blocked accounts (V21-04): Settings lists them, comments and profiles block and unblock. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "account")
class BlockController {

    private final BlockService blocks;

    BlockController(BlockService blocks) {
        this.blocks = blocks;
    }

    @GetMapping("/me/blocks")
    @Operation(summary = "The accounts you blocked, newest first")
    List<BlockedAccount> list(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return blocks.list(user.id());
    }

    @PutMapping("/users/{id}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Block an account (blocking again changes nothing)",
            description = "400 cannot_block_self, 404 user_not_found.")
    void block(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        blocks.block(user.id(), id);
    }

    @DeleteMapping("/users/{id}/block")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Unblock an account (unblocking again changes nothing)")
    void unblock(
            @PathVariable UUID id,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        blocks.unblock(user.id(), id);
    }
}
