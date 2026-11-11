package app.phumreader.help.web;

import app.phumreader.common.security.CurrentUser;
import app.phumreader.help.service.HelpService;
import app.phumreader.help.service.HelpService.Ticket;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Help center: contact tickets and "Was this helpful?" votes (V21-07). */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "help")
class HelpController {

    private final HelpService help;

    HelpController(HelpService help) {
        this.help = help;
    }

    /**
     * @param topic payment, account, reading, creator, report or other
     * @param order payments only: TW-12345678
     * @param message 20 to 1000 characters
     * @param locale the site language, "en" or "km"
     */
    record TicketRequest(
            @NotBlank @Size(max = 30) String topic,
            @NotBlank @Size(max = 254) String email,
            @Nullable @Size(max = 30) String order,
            @NotNull @Size(max = 5000) String message,
            @Nullable @Size(max = 5) String locale) {}

    /** The ticket number to show, "T-58214". */
    record TicketResponse(String ticket) {}

    record VoteRequest(@NotNull Boolean helpful) {}

    /** One answer per help article; articles are numbered by their place in the Help list. */
    record VoteView(int article, boolean helpful) {}

    @PostMapping("/help/tickets")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
            summary = "Sends a Contact us message and returns the ticket number",
            description =
                    "Works signed in or not. The ticket is emailed to the support address."
                            + " 400 invalid_topic, invalid_email, message_too_short,"
                            + " message_too_long or invalid_order (each names its field);"
                            + " 429 too_many_requests (5 per hour).")
    TicketResponse createTicket(
            @Parameter(hidden = true) @AuthenticationPrincipal @Nullable CurrentUser user,
            @Valid @RequestBody TicketRequest body,
            HttpServletRequest request) {
        Ticket ticket =
                help.createTicket(
                        user != null ? user.id() : null,
                        request.getRemoteAddr(),
                        body.topic(),
                        body.email(),
                        body.order(),
                        body.message(),
                        body.locale());
        return new TicketResponse(ticket.ticket());
    }

    @GetMapping("/me/help-votes")
    @Operation(summary = "The account's answers to \"Was this helpful?\", by article number")
    List<VoteView> votes(@Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user) {
        List<VoteView> views = new ArrayList<>();
        for (Map.Entry<Integer, Boolean> vote : help.votes(user.id()).entrySet()) {
            views.add(new VoteView(vote.getKey(), vote.getValue()));
        }
        return views;
    }

    @PutMapping("/me/help-votes/{article}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Saves the answer for a help article (a new answer replaces the old)")
    void vote(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable int article,
            @Valid @RequestBody VoteRequest body) {
        help.vote(user.id(), article, body.helpful());
    }

    @DeleteMapping("/me/help-votes/{article}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Takes the answer back")
    void clearVote(
            @Parameter(hidden = true) @AuthenticationPrincipal CurrentUser user,
            @PathVariable int article) {
        help.clearVote(user.id(), article);
    }
}
