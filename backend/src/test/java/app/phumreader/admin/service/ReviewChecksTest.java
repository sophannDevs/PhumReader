package app.phumreader.admin.service;

import static org.assertj.core.api.Assertions.assertThat;

import app.phumreader.admin.domain.FlagKind;
import app.phumreader.admin.repository.AdminQueries.LiveTitle;
import app.phumreader.admin.service.AdminViews.ReviewFlag;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The automatic checks on a series in review (V21-01): the website's contact rule, similar titles.
 */
class ReviewChecksTest {

    @Test
    void contactDetailsAndLinksInTheSummaryAreFound() {
        assertThat(ReviewChecks.contact("Say hi to @mara.draws!")).contains("@mara.draws");
        assertThat(ReviewChecks.contact("More at https://example.com/x?y=1 today"))
                .contains("https://example.com/x?y=1");
        assertThat(ReviewChecks.contact("Visit WWW.Example.com")).contains("WWW.Example.com");
        assertThat(ReviewChecks.contact("Join t.me/maradraws now")).contains("t.me/maradraws");
        assertThat(ReviewChecks.contact("Call 012 345 678")).contains("012 345 678");
        assertThat(ReviewChecks.contact("Call 012-345-6789.")).contains("012-345-6789");
        assertThat(ReviewChecks.contact("Call 0123456789")).contains("0123456789");
        // The first one wins.
        assertThat(ReviewChecks.contact("t.me/first or @second")).contains("t.me/first");
        // A non-breaking space ends a link, as in the browser.
        char noBreakSpace = 0xA0;
        assertThat(ReviewChecks.contact("www.example.com" + noBreakSpace + "and more"))
                .contains("www.example.com");

        assertThat(ReviewChecks.contact("A quiet story about the sea.")).isEmpty();
        assertThat(ReviewChecks.contact("Me @ home, @ab")).isEmpty();
        assertThat(ReviewChecks.contact("Born in 1998, 12 chapters, 12345678 fans")).isEmpty();
        assertThat(ReviewChecks.contact("Number 01234567890123")).isEmpty();
        assertThat(ReviewChecks.contact("")).isEmpty();
    }

    @Test
    void aTitleLikeALiveSeriesTitleIsFound() {
        UUID self = UUID.randomUUID();
        List<LiveTitle> live =
                List.of(
                        new LiveTitle(UUID.randomUUID(), "Sea"),
                        new LiveTitle(UUID.randomUUID(), "Glass Compass"),
                        new LiveTitle(UUID.randomUUID(), "The Glass Compass Saga"));

        // Equal (case and spacing ignored), containing, contained.
        assertThat(ReviewChecks.similar(self, "  glass   COMPASS ", live))
                .contains("Glass Compass");
        assertThat(ReviewChecks.similar(self, "Glass Compass Returns", live))
                .contains("Glass Compass");
        assertThat(ReviewChecks.similar(self, "Compass Saga", live))
                .contains("The Glass Compass Saga");
        // Titles under 4 characters on either side do not count.
        assertThat(ReviewChecks.similar(self, "Sea", live)).isEmpty();
        assertThat(ReviewChecks.similar(self, "Sea Light", live)).isEmpty();
        assertThat(ReviewChecks.similar(self, "Tide of Glass", live)).isEmpty();
        // The series itself is not compared with itself.
        assertThat(ReviewChecks.similar(self, "Mango", List.of(new LiveTitle(self, "Mango"))))
                .isEmpty();
    }

    @Test
    void flagsComeContactFirstAndWatermarkIsNeverSet() {
        List<ReviewFlag> flags =
                ReviewChecks.flags(
                        UUID.randomUUID(),
                        "Glass Compass",
                        "Write to @mara_draws",
                        List.of(new LiveTitle(UUID.randomUUID(), "Glass Compass")));
        assertThat(flags)
                .containsExactly(
                        new ReviewFlag(FlagKind.CONTACT, "@mara_draws"),
                        new ReviewFlag(FlagKind.SIMILAR, "Glass Compass"));
        assertThat(ReviewChecks.flags(UUID.randomUUID(), "Mango Rain", "Rain.", List.of()))
                .isEmpty();
    }
}
