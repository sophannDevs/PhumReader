package app.phumreader.series.service;

import app.phumreader.common.error.ApiException;
import app.phumreader.common.security.CurrentUser;
import app.phumreader.series.repository.CreatorQueries;
import app.phumreader.series.repository.CreatorQueries.EditRow;
import app.phumreader.series.repository.CreatorQueries.SeriesNumbers;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import app.phumreader.series.service.CreatorViews.CreatorDashboard;
import app.phumreader.series.service.CreatorViews.CreatorSeries;
import app.phumreader.series.service.CreatorViews.CreatorTotals;
import app.phumreader.series.service.CreatorViews.SeriesEdit;
import app.phumreader.user.service.UserService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
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

    public CreatorService(CreatorQueries queries, CatalogService catalog, UserService users) {
        this.queries = queries;
        this.catalog = catalog;
        this.users = users;
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
        queries.insertProfile(userId, name);
        users.grantCreator(userId);
        return name;
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
                r.languages(),
                r.ageRating(),
                r.status(),
                r.visibility(),
                r.updateDay(),
                r.coverUrl(),
                r.bannerUrl(),
                r.tags());
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

    public CreatorDashboard dashboard(UUID userId) {
        Optional<String> penName = queries.penName(userId);
        if (penName.isEmpty()) {
            return new CreatorDashboard(false, null, NOTHING, List.of());
        }
        Map<UUID, SeriesNumbers> numbers =
                queries.seriesNumbers(userId).stream()
                        .collect(Collectors.toMap(SeriesNumbers::seriesId, Function.identity()));
        List<CreatorSeries> series =
                catalog.creatorCards(userId).stream()
                        .filter(card -> numbers.containsKey(card.id()))
                        .map(card -> row(card, numbers.get(card.id())))
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
        return new CreatorDashboard(true, penName.get(), totals, series);
    }

    private static CreatorSeries row(SeriesCard card, SeriesNumbers n) {
        return new CreatorSeries(
                card, n.visibility(), n.subscribers(), n.comments(), n.unlocks(), n.earnedCoins());
    }
}
