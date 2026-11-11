package app.phumreader.series.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.series.service.CreatorService;
import app.phumreader.series.service.CreatorViews.CreatorProfile;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.jspecify.annotations.Nullable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** A creator's public profile, {@code /creators/<handle>} on the website (V21-05). */
@RestController
@RequestMapping("/api/v1/creators")
@Tag(name = "creators")
class CreatorProfileController {

    private final CreatorService creators;

    CreatorProfileController(CreatorService creators) {
        this.creators = creators;
    }

    @GetMapping("/{handle}")
    @Operation(
            summary = "A creator's public profile with their published series",
            description =
                    "Public. Signed in, it also says whether you follow the creator and whether this"
                            + " is your own profile. 404 creator_not_found.")
    CreatorProfile profile(
            @PathVariable String handle,
            @Parameter(hidden = true) @AuthenticationPrincipal @Nullable CurrentUser user) {
        return creators.profile(handle, user == null ? null : user.id());
    }
}
