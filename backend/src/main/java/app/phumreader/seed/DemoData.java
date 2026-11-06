package app.phumreader.seed;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * The parts of {@code src/data/demo-data.json} the seed uses (the website's demo content; the build
 * copies it to {@code seed/demo-data.json} on the classpath). Field names follow the JSON.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
record DemoData(
        LocalDate today,
        String timezone,
        Account demoAccount,
        List<String> genres,
        List<Series> series,
        List<HeroSlide> homeHero,
        List<ContinueEntry> continueReading,
        List<String> rankingMovement,
        List<String> chapterNames,
        Map<String, List<Episode>> episodesSample,
        List<Panel> comicPanels,
        List<Map<String, Object>> novelChapterText,
        String creatorNote,
        Comments comments,
        FastPass fastPass,
        List<CoinPack> coinPacks,
        Map<String, String> synopsisByGenre) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Account(String email, String password, String name, int startingCoins) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Series(
            String id,
            String slug,
            String title,
            String type,
            String genre,
            String creator,
            String cover,
            String views,
            String likes,
            int freeEpisodes,
            int fastPassEpisodes,
            String updateDay,
            Badges badges,
            String status,
            List<String> language,
            String ageRating) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Badges(boolean up, @JsonProperty("isNew") boolean isNew) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record HeroSlide(String series, String tag, String blurb) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record ContinueEntry(String series, int episode, double progress) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Episode(int n, String title, String date, String likes, String thumb, String access) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Panel(String src, int width, int height, String alt) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Comment(String name, String when, String text, int likes) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record Comments(List<Comment> series, List<Comment> episode) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record FastPass(int price, int freeAfterDays) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record CoinPack(int coins, int bonus, String tag) {}
}
