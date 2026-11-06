package app.phumreader.search.web;

import app.phumreader.series.service.CatalogViews.SeriesCard;
import java.util.List;

/**
 * Search results.
 *
 * @param items matching series, best first
 */
public record SearchResults(List<SeriesCard> items) {}
