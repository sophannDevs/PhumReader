package app.phumreader.user.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.user.service.SettingsViews.Settings;
import app.phumreader.user.service.SettingsViews.SettingsChange;
import app.phumreader.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Settings page: profile name, language, appearance, reader defaults, notifications (P3-17). */
@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "account")
class SettingsController {

    private final UserService users;

    SettingsController(UserService users) {
        this.users = users;
    }

    @GetMapping("/settings")
    @Operation(summary = "The signed-in account's settings")
    Settings settings(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return users.settings(user.id());
    }

    @PatchMapping("/settings")
    @Operation(
            summary = "Saves the settings that are sent and returns all of them",
            description =
                    "Only the fields in the body change, e.g. {\"reader\":{\"size\":20}}."
                            + " 400 invalid_text_size (field reader.size).")
    Settings updateSettings(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody SettingsChange body) {
        return users.updateSettings(user.id(), body);
    }

    @PatchMapping("/profile")
    @Operation(
            summary = "Changes the display name",
            description = "2 to 60 characters after trimming; 400 name_too_short.")
    MeResponse updateProfile(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody ProfileRequest body) {
        return MeResponse.from(users.rename(user.id(), body.displayName()));
    }

    @PutMapping("/avatar")
    @Operation(
            summary = "Sets the profile picture from a finished AVATAR upload",
            description =
                    "Upload with POST /creator/uploads (kind AVATAR) and /complete first. 400"
                            + " upload_invalid or upload_not_ready (field uploadId).")
    MeResponse setAvatar(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody AvatarRequest body) {
        return MeResponse.from(users.setAvatar(user.id(), body.uploadId()));
    }

    @DeleteMapping("/avatar")
    @Operation(summary = "Removes the profile picture (the website shows initials again)")
    MeResponse removeAvatar(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        return MeResponse.from(users.removeAvatar(user.id()));
    }

    record AvatarRequest(@NotNull UUID uploadId) {}

    record ProfileRequest(@NotBlank @Size(max = 60) String displayName) {}
}
