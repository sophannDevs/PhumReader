package app.phumreader.series.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.series.service.CreatorService;
import app.phumreader.series.service.CreatorViews.CreatorDashboard;
import app.phumreader.series.service.CreatorViews.CreatorEarnings;
import app.phumreader.series.service.CreatorViews.CreatorProfile;
import app.phumreader.series.service.CreatorViews.SeriesEdit;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** The creator dashboard (plan P3-14, stats only). */
@RestController
@RequestMapping("/api/v1/creator")
@Tag(name = "creator")
class CreatorController {

    private final CreatorService creators;

    CreatorController(CreatorService creators) {
        this.creators = creators;
    }

    @GetMapping("/dashboard")
    @Operation(
            summary = "The signed-in creator's series and their numbers",
            description =
                    "Readers who are not creators get creator: false and no series (the page's"
                            + " empty state).")
    CreatorDashboard dashboard(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return creators.dashboard(user.id());
    }

    /**
     * @param penName the name shown on the creator's series
     * @param acceptTerms must be true: the Creator terms were accepted (A11)
     */
    record BecomeCreatorRequest(
            @NotBlank @Size(max = 60) String penName, @AssertTrue boolean acceptTerms) {}

    record BecomeCreatorResponse(String penName) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Accept the Creator terms and become a creator",
            description =
                    "Adds the CREATOR role. Call POST /auth/refresh afterwards so the access token"
                            + " carries it. 409 already_creator when the account already is one.")
    BecomeCreatorResponse become(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody BecomeCreatorRequest body) {
        return new BecomeCreatorResponse(creators.becomeCreator(user.id(), body.penName()));
    }

    /**
     * @param name the pen name, 1-60 characters
     * @param location up to 60 characters; blank clears it
     * @param bio up to 200 characters; blank clears it
     */
    record ProfileRequest(
            @NotBlank @Size(max = 200) String name,
            @Nullable @Size(max = 200) String location,
            @Nullable @Size(max = 1000) String bio) {}

    @PatchMapping("/profile")
    @Operation(
            summary = "Edit the public profile: name, location and bio (the handle stays)",
            description =
                    "400 fields.name / location / bio (required, too_long: name and location 60,"
                            + " bio 200); 403 not_a_creator.")
    CreatorProfile updateProfile(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody ProfileRequest body) {
        return creators.updateProfile(user.id(), body.name(), body.location(), body.bio());
    }

    @GetMapping("/earnings")
    @Operation(
            summary =
                    "Earnings of the last 6 months: coins from Fast Pass unlocks, by month and series",
            description = "403 not_a_creator. Nothing is paid out by the API yet.")
    CreatorEarnings earnings(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return creators.earnings(user.id());
    }

    /**
     * @param method aba or bank (no account details are stored: the payout provider's form comes
     *     later)
     */
    record PayoutMethodRequest(@NotNull @Size(max = 10) String method) {}

    @PutMapping("/payout-method")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
            summary = "Choose where payouts will go",
            description = "400 fields.method invalid_method; 403 not_a_creator.")
    void setPayoutMethod(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody PayoutMethodRequest body) {
        creators.setPayoutMethod(user.id(), body.method());
    }

    @DeleteMapping("/payout-method")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove the payout method")
    void removePayoutMethod(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        creators.setPayoutMethod(user.id(), null);
    }

    @GetMapping("/series/{id}")
    @PreAuthorize("hasRole('CREATOR')")
    @Operation(
            summary = "One of the signed-in creator's series, as the edit form shows it",
            description = "403 for another creator's series, 404 when it does not exist.")
    SeriesEdit series(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return creators.ownedSeries(user, id);
    }
}
