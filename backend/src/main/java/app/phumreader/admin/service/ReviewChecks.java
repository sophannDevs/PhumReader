package app.phumreader.admin.service;

import app.phumreader.admin.domain.FlagKind;
import app.phumreader.admin.repository.AdminQueries.LiveTitle;
import app.phumreader.admin.service.AdminViews.ReviewFlag;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The automatic checks on a series waiting for review (V21-01), worked out when the queue is read.
 * The contact rule is the website's (src/lib/admin.ts, {@code autoFlags}); a watermark cannot be
 * detected yet, so {@link FlagKind#WATERMARK} is never set.
 */
final class ReviewChecks {

    /** JavaScript's {@code \s}: Java's {@code \s} misses the Unicode spaces. */
    private static final String SPACE =
            "\\t\\n\\x0B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF";

    private static final String NOT_SPACE = "[^" + SPACE + "]";

    /**
     * Handles ({@code @name}), http(s) links, {@code www.} and {@code t.me/} addresses, and phone
     * numbers of 9 or 10 digits (groups of 3, 3 and 3-4, with an optional space or dash between
     * them).
     */
    static final Pattern CONTACT =
            Pattern.compile(
                    "@[\\w.]{3,}|https?://"
                            + NOT_SPACE
                            + "+|www\\."
                            + NOT_SPACE
                            + "+|t\\.me/"
                            + NOT_SPACE
                            + "+|\\b\\d{3}[ -]?\\d{3}[ -]?\\d{3,4}\\b",
                    Pattern.CASE_INSENSITIVE);

    private static final Pattern SPACES = Pattern.compile("[" + SPACE + "]+");

    /** Shorter titles match too much to be worth a flag. */
    static final int MIN_TITLE_LENGTH = 4;

    private ReviewChecks() {}

    /** The flags of one series: contact details first, then a similar live title. */
    static List<ReviewFlag> flags(UUID id, String title, String summary, List<LiveTitle> live) {
        List<ReviewFlag> flags = new ArrayList<>();
        contact(summary).ifPresent(found -> flags.add(new ReviewFlag(FlagKind.CONTACT, found)));
        similar(id, title, live)
                .ifPresent(other -> flags.add(new ReviewFlag(FlagKind.SIMILAR, other)));
        return flags;
    }

    /** The first contact detail or link in the summary. */
    static Optional<String> contact(String summary) {
        Matcher m = CONTACT.matcher(summary);
        return m.find() ? Optional.of(m.group()) : Optional.empty();
    }

    /**
     * The title of another live series whose title equals, contains or is inside this one, case and
     * spacing ignored; both need at least {@link #MIN_TITLE_LENGTH} characters.
     */
    static Optional<String> similar(UUID id, String title, List<LiveTitle> live) {
        String mine = normalise(title);
        if (mine.length() < MIN_TITLE_LENGTH) {
            return Optional.empty();
        }
        for (LiveTitle other : live) {
            if (other.id().equals(id)) {
                continue;
            }
            String theirs = normalise(other.title());
            if (theirs.length() >= MIN_TITLE_LENGTH
                    && (theirs.contains(mine) || mine.contains(theirs))) {
                return Optional.of(other.title());
            }
        }
        return Optional.empty();
    }

    /** Lower case, runs of spaces as one, no spaces at the ends. */
    static String normalise(String title) {
        return SPACES.matcher(title.toLowerCase(Locale.ROOT)).replaceAll(" ").strip();
    }
}
