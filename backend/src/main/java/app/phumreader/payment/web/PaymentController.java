package app.phumreader.payment.web;

import app.phumreader.common.idempotency.IdempotencyKeys;
import app.phumreader.common.paging.CursorPage;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.payment.domain.PaymentMethod;
import app.phumreader.payment.service.PaymentService;
import app.phumreader.payment.service.PaymentService.Outcome;
import app.phumreader.payment.service.PaymentViews.CoinShop;
import app.phumreader.payment.service.PaymentViews.OrderView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Coin packs, orders and the purchase history (plan P3-11). */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "payments")
class PaymentController {

    private final PaymentService payments;

    PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    /**
     * @param packId a pack from {@code GET /coins/packs}
     */
    public record OrderRequest(@NotNull Integer packId, @NotNull PaymentMethod method) {}

    /** Dev simulator: how the payment ends. */
    public record SimulateRequest(@NotNull Outcome outcome) {}

    @GetMapping("/coins/packs")
    @Operation(summary = "Coin packs and ways to pay (public)")
    CoinShop packs() {
        return payments.shop();
    }

    @PostMapping("/coins/orders")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Start buying a coin pack",
            description =
                    "The order stays open for orderExpiryMinutes. A retry with the same"
                            + " Idempotency-Key returns the same order.")
    OrderView createOrder(
            @Valid @RequestBody OrderRequest request,
            @Parameter(
                            name = IdempotencyKeys.HEADER,
                            in = ParameterIn.HEADER,
                            required = true,
                            description = "A new random value per order (8-100 characters)")
                    @RequestHeader(name = IdempotencyKeys.HEADER, required = false)
                    @Nullable String key,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return payments.createOrder(
                user, request.packId(), request.method(), IdempotencyKeys.require(key));
    }

    @GetMapping("/coins/orders/{number}")
    @Operation(summary = "One of the reader's orders (poll it while the reader pays)")
    OrderView order(
            @PathVariable String number,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return payments.order(user, number);
    }

    /**
     * @param reason why the reader wants the money back, 10-500 characters
     */
    public record RefundRequestBody(@NotNull @Size(max = 2000) String reason) {}

    @PostMapping("/coins/orders/{number}/refund-request")
    @Operation(
            summary = "Ask for a refund of a paid order",
            description =
                    "The order then carries refundRequest. 400 fields.reason (too_short, too_long);"
                            + " 409 not_paid and refund_requested (one request per order).")
    OrderView requestRefund(
            @PathVariable String number,
            @Valid @RequestBody RefundRequestBody body,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return payments.requestRefund(user, number, body.reason());
    }

    @PostMapping("/coins/orders/{number}/cancel")
    @Operation(summary = "Cancel an open order")
    OrderView cancel(
            @PathVariable String number,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return payments.cancel(user, number);
    }

    @PostMapping("/coins/orders/{number}/simulate")
    @Operation(
            summary = "Dev only: pay or fail an order without ABA PayWay",
            description = "404 when phumreader.payments.simulator is off (always in production).")
    OrderView simulate(
            @PathVariable String number,
            @Valid @RequestBody SimulateRequest request,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return payments.simulate(user, number, request.outcome());
    }

    @GetMapping("/me/coins/orders")
    @Operation(summary = "The reader's orders, newest first (purchase history)")
    CursorPage<OrderView> orders(
            @RequestParam(required = false)
                    @Parameter(description = "nextCursor of the previous page")
                    @Nullable String cursor,
            @RequestParam(required = false)
                    @Parameter(description = "Page size, 1-100 (default 20)")
                    @Nullable Integer limit,
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return payments.orders(user, cursor, limit);
    }
}
