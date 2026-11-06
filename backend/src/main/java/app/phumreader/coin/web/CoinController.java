package app.phumreader.coin.web;

import app.phumreader.coin.service.CoinService;
import app.phumreader.coin.service.CoinViews.LedgerEntry;
import app.phumreader.coin.service.CoinViews.UnlockResult;
import app.phumreader.coin.service.CoinViews.Wallet;
import app.phumreader.common.idempotency.IdempotencyKeys;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.payment.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** The reader's coins, Fast Pass unlocks and coin history (plan P3-10). */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "coins")
class CoinController {

    private final CoinService coins;
    private final PaymentService payments;

    CoinController(CoinService coins, PaymentService payments) {
        this.coins = coins;
        this.payments = payments;
    }

    @GetMapping("/me/coins")
    @Operation(summary = "The reader's balance and whether the first-purchase bonus is on offer")
    Wallet wallet(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return new Wallet(
                coins.balance(user.id()), payments.firstPurchaseBonusAvailable(user.id()));
    }

    @PostMapping("/series/{slug}/episodes/{n}/unlock")
    @Operation(
            summary = "Unlock a Fast Pass episode with coins",
            description =
                    "Charged at most once: a retry with the same Idempotency-Key, or unlocking the"
                            + " same episode again, costs nothing. 402 not_enough_coins (with price"
                            + " and freeOn); 409 episode_not_locked when it is free to read.")
    UnlockResult unlock(
            @PathVariable String slug,
            @PathVariable int n,
            @Parameter(
                            name = IdempotencyKeys.HEADER,
                            in = ParameterIn.HEADER,
                            required = true,
                            description = "A new random value per unlock (8-100 characters)")
                    @RequestHeader(name = IdempotencyKeys.HEADER, required = false)
                    @Nullable String key,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return coins.unlock(user, slug, n, IdempotencyKeys.require(key));
    }

    @GetMapping("/me/coins/ledger")
    @Operation(summary = "Every change to the reader's coins, newest first")
    CursorPage<LedgerEntry> ledger(
            @RequestParam(required = false)
                    @Parameter(description = "nextCursor of the previous page")
                    @Nullable String cursor,
            @RequestParam(required = false)
                    @Parameter(description = "Page size, 1-100 (default 20)")
                    @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return coins.ledger(user, cursor, limit);
    }
}
