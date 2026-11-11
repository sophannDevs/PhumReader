package app.phumreader.series.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.series.domain.ReviewDecision;
import app.phumreader.series.domain.ReviewItem;
import app.phumreader.series.domain.SeriesVisibility;
import app.phumreader.series.repository.CreatorQueries;
import app.phumreader.series.repository.CreatorQueries.EditRow;
import app.phumreader.series.repository.CreatorQueries.MonthlySeries;
import app.phumreader.series.repository.CreatorQueries.MonthlyTotal;
import app.phumreader.series.repository.CreatorQueries.ProfileRow;
import app.phumreader.series.repository.CreatorQueries.ReviewRow;
import app.phumreader.series.repository.CreatorQueries.SeriesNumbers;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import app.phumreader.series.service.CreatorInput.SeriesFastPass;
import app.phumreader.series.service.CreatorViews.CreatorDashboard;
import app.phumreader.series.service.CreatorViews.CreatorEarnings;
import app.phumreader.series.service.CreatorViews.CreatorProfile;
import app.phumreader.series.service.CreatorViews.CreatorSeries;
import app.phumreader.series.service.CreatorViews.CreatorTotals;
import app.phumreader.series.service.CreatorViews.EarningsMonth;
import app.phumreader.series.service.CreatorViews.EarningsSeries;
import app.phumreader.series.service.CreatorViews.PayoutMonth;
import app.phumreader.series.service.CreatorViews.RequestedChange;
import app.phumreader.series.service.CreatorViews.SeriesEdit;
import app.phumreader.series.service.CreatorViews.SeriesReview;
import app.phumreader.user.service.UserService;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The creator dashboard (plan P3-14 stats; writing pages come later). Being a creator is read from
 * the database, not from the access token, so it is right even before the token is refreshed.
 */
@Service
@Transactional(readOnly = true)
public class CreatorService {

    private static final CreatorTotals NOTHING = new CreatorTotals(0, 0, 0, 0, 0, 0, 0);

    private final CreatorQueries queries;
    private final CatalogService catalog;
    private final UserService users;
    private final Clock clock;

    public CreatorService(
            CreatorQueries queries, CatalogService catalog, UserService users, Clock clock) {
        this.queries = queries;
        this.catalog = catalog;
        this.users = users;
        this.clock = clock;
    }

    /**
     * The reader accepts the Creator terms (A11) and becomes a creator. The CREATOR role reaches
     * their access token with the next refresh.
     */
    @Transactional
    public String becomeCreator(UUID userId, String penName) {
        if (queries.penName(userId).isPresent()) {
            throw ApiException.conflict("already_creator", "This account is already a creator.");
        }
        String name = penName.trim();
        if (name.isEmpty()) {
            throw ApiException.invalidField("penName", "required", "Enter a pen name.");
        }
        queries.insertProfile(userId, name, Handles.free(name, queries::handleTaken));
        users.grantCreator(userId);
        return name;
    }

    /** 403 {@code not_a_creator} unless the account accepted the Creator terms. */
    public void requireCreator(UUID userId) {
        if (queries.penName(userId).isEmpty()) {
            throw ApiException.forbidden(
                    "not_a_creator", "Accept the Creator terms to publish on PhumReader.");
        }
    }

    /**
     * Ownership rule for every creator write (P3-05): only the series' own creator passes. An
     * unknown series is 404, somebody else's is 403.
     */
    public SeriesEdit ownedSeries(CurrentUser user, UUID seriesId) {
        EditRow r = requireOwnedSeries(user, seriesId);
        return new SeriesEdit(
                r.id(),
                r.slug(),
                r.type(),
                r.title(),
                r.summary(),
                r.genreSlug(),
                r.secondGenreSlug(),
                r.languages(),
                r.ageRating(),
                r.status(),
                r.breakMessage(),
                r.visibility(),
                r.updateDays().stream().map(Weekday::of).toList(),
                r.releaseHour(),
                new SeriesFastPass(r.fastPass(), r.fastPassAhead()),
                r.commentsEnabled(),
                r.coverUrl(),
                r.bannerUrl(),
                r.tags(),
                review(queries.latestReview(r.id()).orElse(null)));
    }

    /** Same rule for writes that need the series' row. */
    EditRow requireOwnedSeries(CurrentUser user, UUID seriesId) {
        EditRow row =
                queries.editRow(seriesId)
                        .orElseThrow(
                                () -> ApiException.notFound("series_not_found", "No such series."));
        if (!row.creatorId().equals(user.id())) {
            throw ApiException.forbidden(
                    "not_your_series", "This series belongs to another creator.");
        }
        return row;
    }

    /** The series' latest submission for review (V21-01), if it was ever submitted. */
    Optional<ReviewRow> latestReview(UUID seriesId) {
        return queries.latestReview(seriesId);
    }

    public CreatorDashboard dashboard(UUID userId) {
        Optional<String> penName = queries.penName(userId);
        if (penName.isEmpty()) {
            return new CreatorDashboard(false, null, null, NOTHING, List.of());
        }
        Map<UUID, SeriesNumbers> numbers =
                queries.seriesNumbers(userId).stream()
                        .collect(Collectors.toMap(SeriesNumbers::seriesId, Function.identity()));
        Map<UUID, ReviewRow> reviews = queries.latestReviews(userId);
        List<CreatorSeries> series =
                catalog.creatorCards(userId).stream()
                        .filter(card -> numbers.containsKey(card.id()))
                        .map(card ->
                                row(card, numbers.get(card.id()), review(reviews.get(card.id()))))
                        .toList();
        CreatorTotals totals =
                new CreatorTotals(
                        series.size(),
                        series.stream().mapToLong(s -> s.series().views()).sum(),
                        series.stream().mapToLong(s -> s.series().likes()).sum(),
                        series.stream().mapToLong(CreatorSeries::subscribers).sum(),
                        series.stream().mapToLong(CreatorSeries::comments).sum(),
                        series.stream().mapToLong(CreatorSeries::unlocks).sum(),
                        series.stream().mapToLong(CreatorSeries::earnedCoins).sum());
        return new CreatorDashboard(
                true, penName.get(), queries.handle(userId).orElse(null), totals, series);
    }

    // ---------- public profile (V21-05) ----------

    /** 404 {@code creator_not_found}. Anyone can read it; {@code viewer} adds following / owner. */
    public CreatorProfile profile(String handle, @Nullable UUID viewer) {
        ProfileRow row =
                queries.profile(handle.toLowerCase(Locale.ROOT))
                        .orElseThrow(() ->
                                ApiException.notFound("creator_not_found", "No such creator."));
        Set<UUID> live = Set.copyOf(queries.publishedSeries(row.userId()));
        List<SeriesCard> series =
                catalog.creatorCards(row.userId()).stream()
                        .filter(c -> live.contains(c.id()))
                        .toList();
        return new CreatorProfile(
                row.userId(),
                row.handle(),
                row.penName(),
                row.avatarUrl(),
                row.bio(),
                row.location(),
                row.since().toInstant(),
                row.followers(),
                series.stream().mapToLong(SeriesCard::views).sum(),
                series.stream().mapToLong(SeriesCard::likes).sum(),
                viewer != null && queries.follows(viewer, row.userId()),
                row.userId().equals(viewer),
                series);
    }

    public static final int MAX_NAME = 60;
    public static final int MAX_LOCATION = 60;
    public static final int MAX_BIO = 200;

    /**
     * Edit profile: name (up to 60, required), location (up to 60) and bio (up to 200). The handle
     * stays. Blank location / bio clear them.
     */
    @Transactional
    public CreatorProfile updateProfile(
            UUID userId, String name, @Nullable String location, @Nullable String bio) {
        requireCreator(userId);
        String penName = name == null ? "" : name.strip();
        if (penName.isEmpty()) {
            throw ApiException.invalidField("name", "required", "Enter a name.");
        }
        if (penName.length() > MAX_NAME) {
            throw ApiException.invalidField(
                    "name", "too_long", "Use at most " + MAX_NAME + " characters.");
        }
        String place = blankToNull(location);
        if (place != null && place.length() > MAX_LOCATION) {
            throw ApiException.invalidField(
                    "location", "too_long", "Use at most " + MAX_LOCATION + " characters.");
        }
        String about = blankToNull(bio);
        if (about != null && about.length() > MAX_BIO) {
            throw ApiException.invalidField(
                    "bio", "too_long", "Use at most " + MAX_BIO + " characters.");
        }
        queries.updateProfile(userId, penName, place, about);
        return profile(queries.handle(userId).orElseThrow(), userId);
    }

    private static @Nullable String blankToNull(@Nullable String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }

    // ---------- earnings (V21-05) ----------

    private static final int EARNINGS_MONTHS = 6;
    private static final int HISTORY_MONTHS = 3;

    /** Coins from unlocks of the creator's Fast Pass episodes, by month and series. */
    public CreatorEarnings earnings(UUID userId) {
        requireCreator(userId);
        YearMonth current = YearMonth.now(clock.withZone(CatalogService.ZONE));
        List<YearMonth> months = new ArrayList<>();
        for (int i = EARNINGS_MONTHS - 1; i >= 0; i--) {
            months.add(current.minusMonths(i));
        }
        OffsetDateTime from =
                months.getFirst().atDay(1).atStartOfDay(CatalogService.ZONE).toOffsetDateTime();
        Map<YearMonth, MonthlyTotal> totals =
                queries.earningsByMonth(userId, from).stream()
                        .collect(
                                Collectors.toMap(
                                        t -> YearMonth.from(t.month()), Function.identity()));
        List<EarningsMonth> monthRows =
                months.stream()
                        .map(m -> {
                            MonthlyTotal t = totals.get(m);
                            return new EarningsMonth(
                                    m.toString(),
                                    t == null ? 0 : t.coins(),
                                    t == null ? 0 : t.unlocks(),
                                    t == null ? 0 : t.readers());
                        })
                        .toList();

        Map<UUID, Map<YearMonth, MonthlySeries>> bySeries = new HashMap<>();
        for (MonthlySeries s : queries.earningsBySeries(userId, from)) {
            bySeries.computeIfAbsent(s.seriesId(), k -> new HashMap<>())
                    .put(YearMonth.from(s.month()), s);
        }
        Map<UUID, SeriesNumbers> numbers =
                queries.seriesNumbers(userId).stream()
                        .collect(Collectors.toMap(SeriesNumbers::seriesId, Function.identity()));
        List<EarningsSeries> series =
                catalog.creatorCards(userId).stream()
                        .filter(c -> numbers.containsKey(c.id()))
                        .filter(c -> numbers.get(c.id()).visibility() != SeriesVisibility.DRAFT)
                        .map(c -> {
                            Map<YearMonth, MonthlySeries> mine =
                                    bySeries.getOrDefault(c.id(), Map.of());
                            List<Long> coins =
                                    months.stream()
                                            .map(m ->
                                                    mine.containsKey(m) ? mine.get(m).coins() : 0L)
                                            .toList();
                            long unlocks =
                                    mine.values().stream().mapToLong(MonthlySeries::unlocks).sum();
                            return new EarningsSeries(
                                    c.id(),
                                    c.slug(),
                                    c.title(),
                                    c.cover(),
                                    numbers.get(c.id()).visibility(),
                                    coins,
                                    unlocks);
                        })
                        .toList();

        List<PayoutMonth> history =
                monthRows.stream()
                        .filter(m -> !m.month().equals(current.toString()) && m.coins() > 0)
                        .sorted(Comparator.comparing(EarningsMonth::month).reversed())
                        .limit(HISTORY_MONTHS)
                        .map(m -> new PayoutMonth(m.month(), m.coins()))
                        .toList();
        String method = queries.profile(userId).map(ProfileRow::payoutMethod).orElse(null);
        return new CreatorEarnings(
                monthRows,
                series,
                history,
                method == null ? null : method.toLowerCase(Locale.ROOT));
    }

    /** Remembers where payouts will go ({@code aba} or {@code bank}); {@code null} removes it. */
    @Transactional
    public void setPayoutMethod(UUID userId, @Nullable String method) {
        requireCreator(userId);
        String stored = method == null ? null : method.toUpperCase(Locale.ROOT);
        if (stored != null && !stored.equals("ABA") && !stored.equals("BANK")) {
            throw ApiException.invalidField("method", "invalid_method", "Use one of: aba, bank");
        }
        queries.setPayoutMethod(userId, stored);
    }

    private static CreatorSeries row(
            SeriesCard card, SeriesNumbers n, @Nullable SeriesReview review) {
        return new CreatorSeries(
                card,
                n.visibility(),
                n.subscribers(),
                n.comments(),
                n.unlocks(),
                n.earnedCoins(),
                review);
    }

    /**
     * The latest submission for review as the creator sees it; the items in the admin page's order.
     */
    private static @Nullable SeriesReview review(@Nullable ReviewRow r) {
        if (r == null) {
            return null;
        }
        return new SeriesReview(
                r.submittedAt().toInstant(),
                r.decision() == null ? null : ReviewDecision.valueOf(r.decision()),
                r.note(),
                r.items().stream()
                        .map(i -> new RequestedChange(ReviewItem.ofKey(i.item()), i.fixed()))
                        .sorted(Comparator.comparing(RequestedChange::item))
                        .toList());
    }
}
