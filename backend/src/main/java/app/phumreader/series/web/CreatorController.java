package app.phumreader.series.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.series.service.CreatorService;
import app.phumreader.series.service.CreatorViews.CreatorDashboard;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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
}
