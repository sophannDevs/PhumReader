package app.phumreader.media.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.media.domain.UploadKind;
import app.phumreader.media.service.MediaService;
import app.phumreader.media.service.MediaViews.UploadTicket;
import app.phumreader.media.service.MediaViews.UploadView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Image uploads for creators: covers, banners, episode thumbnails and comic panels. */
@RestController
@RequestMapping("/api/v1/creator/uploads")
@PreAuthorize("hasRole('CREATOR')")
@Tag(name = "media")
class MediaController {

    private final MediaService media;

    MediaController(MediaService media) {
        this.media = media;
    }

    /**
     * @param contentType image/jpeg or image/png
     * @param size bytes, at most 20 MB
     */
    record CreateUploadRequest(
            @NotNull UploadKind kind, @NotBlank String contentType, @Positive long size) {}

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Start an image upload",
            description =
                    "Returns a presigned URL: PUT the file to it with the given headers, then call"
                            + " POST /creator/uploads/{id}/complete. 400 for a type or size the"
                            + " rules do not allow.")
    UploadTicket create(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @Valid @RequestBody CreateUploadRequest body) {
        return media.create(user.id(), body.kind(), body.contentType(), body.size());
    }

    @PostMapping("/{id}/complete")
    @Operation(
            summary = "Check the uploaded image and make its WebP variants",
            description =
                    "422 with a reason code (image_too_small, not_square, unsupported_type,"
                            + " corrupt_image, file_too_large, too_many_pixels) when a check"
                            + " fails; 409 upload_missing when the file is not in storage yet."
                            + " Calling it again after success answers the same.")
    UploadView complete(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return media.complete(user.id(), id);
    }

    @GetMapping("/{id}")
    @Operation(summary = "The state of one of the signed-in creator's uploads")
    UploadView get(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable UUID id) {
        return media.view(user.id(), id);
    }
}
