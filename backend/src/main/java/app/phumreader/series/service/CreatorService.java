package app.phumreader.series.service;

import app.phumreader.series.repository.CreatorQueries;
import app.phumreader.series.repository.CreatorQueries.SeriesNumbers;
import app.phumreader.series.service.CatalogViews.SeriesCard;
import app.phumreader.series.service.CreatorViews.CreatorDashboard;
import app.phumreader.series.service.CreatorViews.CreatorSeries;
import app.phumreader.series.service.CreatorViews.CreatorTotals;
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

    public CreatorService(CreatorQueries queries, CatalogService catalog) {
        this.queries = queries;
        this.catalog = catalog;
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
