package app.phumreader.seed;

import app.phumreader.seed.DemoRules.SeedEpisode;
import app.phumreader.series.service.Handles;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.sql.Types;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.json.JsonMapper;

/**
 * Loads the website's demo content into the database: genres, the 12 demo creators, 48 series with
 * every episode, comic panels and novel chapters, comments, coin packs, the home hero, rankings and
 * the demo reader with 3 coins and four Continue reading entries.
 *
 * <p>Every row gets a stable id and is inserted with {@code ON CONFLICT DO NOTHING}, so running the
 * seed again changes nothing. All of it runs in one transaction.
 */
@Component
public class DemoSeeder {

    static final String SOURCE = "seed/demo-data.json";

    /** Demo accounts that can log in use this domain (as in the design); the others cannot. */
    private static final String READER_DOMAIN = "readers.phumreader.invalid";

    private static final String CREATOR_DOMAIN = "creators.phumreader.invalid";
    private static final String CREATOR_LOGIN = "creator@toonwave.app";
    private static final int BATCH = 1_000;

    private static final int UUID_T = Types.OTHER;
    private static final int TEXT = Types.VARCHAR;
    private static final int INT = Types.INTEGER;
    private static final int BIGINT = Types.BIGINT;
    private static final int TIME = Types.TIMESTAMP_WITH_TIMEZONE;
    private static final int BOOL = Types.BOOLEAN;

    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final JsonMapper json;
    private final PasswordEncoder passwords;

    public DemoSeeder(
            JdbcTemplate jdbc,
            PlatformTransactionManager transactionManager,
            JsonMapper json,
            PasswordEncoder passwords) {
        this.jdbc = jdbc;
        this.transaction = new TransactionTemplate(transactionManager);
        this.json = json;
        this.passwords = passwords;
    }

    /** What the database holds after seeding. */
    public record SeedReport(
            long genres,
            long creators,
            long series,
            long comics,
            long novels,
            long episodes,
            long episodeImages,
            long chapterTexts,
            long comments,
            long coinPacks,
            long featuredSlides,
            long rankings) {}

    public SeedReport seed() {
        DemoData data = load();
        return transaction.execute(status -> write(data));
    }

    DemoData load() {
        try (InputStream in = new ClassPathResource(SOURCE).getInputStream()) {
            return json.readValue(in, DemoData.class);
        } catch (IOException ex) {
            throw new UncheckedIOException("Cannot read " + SOURCE, ex);
        }
    }

    private SeedReport write(DemoData data) {
        Context ctx = new Context(data);
        genres(ctx);
        users(ctx);
        series(ctx);
        episodes(ctx);
        comments(ctx);
        coinPacks(ctx);
        homeAndRankings(ctx);
        demoReader(ctx);
        return report();
    }

    // ---------- genres ----------

    private void genres(Context ctx) {
        List<Object[]> rows = new ArrayList<>();
        List<String> genres = ctx.data.genres();
        for (int i = 0; i < genres.size(); i++) {
            String name = genres.get(i);
            rows.add(new Object[] {i + 1, DemoRules.genreSlug(name), name, i + 1});
            ctx.genreIds.put(name, i + 1);
        }
        batch(
                "insert into genres (id, slug, name, position) values (?, ?, ?, ?) on conflict do nothing",
                new int[] {Types.SMALLINT, TEXT, TEXT, Types.SMALLINT},
                rows);
    }

    // ---------- users: creators and commenters ----------

    private void users(Context ctx) {
        OffsetDateTime joined = ctx.at(ctx.data.today().minusYears(1));
        String demoPassword = passwords.encode(ctx.data.demoAccount().password());

        List<Object[]> users = new ArrayList<>();
        List<Object[]> roles = new ArrayList<>();
        List<Object[]> profiles = new ArrayList<>();

        Set<String> creators = new LinkedHashSet<>();
        ctx.data.series().forEach(s -> creators.add(s.creator()));
        for (String name : creators) {
            UUID id = DemoRules.id("creator", name);
            ctx.creatorIds.put(name, id);
            boolean login = DemoRules.STAND_IN_CREATOR.equals(name);
            users.add(
                    new Object[] {
                        id,
                        login ? CREATOR_LOGIN : DemoRules.slug(name) + "@" + CREATOR_DOMAIN,
                        login ? joined : null,
                        login ? demoPassword : null,
                        name,
                        joined
                    });
            roles.add(new Object[] {id, "READER"});
            roles.add(new Object[] {id, "CREATOR"});
            profiles.add(new Object[] {id, name, joined, joined});
        }

        Set<String> commenters = new LinkedHashSet<>();
        Stream.concat(ctx.data.comments().series().stream(), ctx.data.comments().episode().stream())
                .forEach(c -> commenters.add(c.name()));
        for (String name : commenters) {
            UUID id = DemoRules.id("commenter", name);
            ctx.commenterIds.put(name, id);
            users.add(
                    new Object[] {
                        id, DemoRules.slug(name) + "@" + READER_DOMAIN, null, null, name, joined
                    });
            roles.add(new Object[] {id, "READER"});
        }

        batch(
                "insert into users (id, email, email_verified_at, password_hash, display_name,"
                        + " created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict do nothing",
                new int[] {UUID_T, TEXT, TIME, TEXT, TEXT, TIME, TIME},
                users.stream().map(u -> append(u, u[5])).toList());
        batch(
                "insert into user_roles (user_id, role) values (?, ?) on conflict do nothing",
                new int[] {UUID_T, TEXT},
                roles);
        batch(
                "insert into creator_profiles (user_id, pen_name, handle, accepted_terms_at,"
                        + " created_at, updated_at) values (?, ?, ?, ?, ?, ?)"
                        + " on conflict do nothing",
                new int[] {UUID_T, TEXT, TEXT, TIME, TIME, TIME},
                withHandles(profiles));
        settings(DemoRules.id("creator", DemoRules.STAND_IN_CREATOR), ctx);
    }

    /** The creator rows with the handle the name asks for (a number is added when it is taken). */
    private static List<Object[]> withHandles(List<Object[]> profiles) {
        Set<String> taken = new HashSet<>();
        List<Object[]> rows = new ArrayList<>();
        for (Object[] p : profiles) {
            String handle = Handles.free((String) p[1], taken::contains);
            taken.add(handle);
            rows.add(new Object[] {p[0], p[1], handle, p[2], p[3], p[3]});
        }
        return rows;
    }

    // ---------- series ----------

    private void series(Context ctx) {
        List<Object[]> rows = new ArrayList<>();
        for (DemoData.Series s : ctx.data.series()) {
            UUID id = DemoRules.id("series", s.id());
            ctx.seriesIds.put(s.slug(), id);
            List<SeedEpisode> episodes = DemoRules.episodes(ctx.data, s);
            ctx.episodes.put(s.slug(), episodes);
            LocalDate firstRelease = episodes.getFirst().date();
            // "NEW" series launched two weeks before the demo's today; the others with their first
            // episode.
            OffsetDateTime launched =
                    ctx.at(s.badges().isNew() ? ctx.data.today().minusDays(14) : firstRelease);
            long likes = DemoRules.parseCount(s.likes());
            rows.add(
                    new Object[] {
                        id,
                        s.slug(),
                        ctx.creatorIds.get(s.creator()),
                        s.type().toUpperCase(Locale.ROOT),
                        s.title(),
                        ctx.data.synopsisByGenre().getOrDefault(s.genre(), ""),
                        ctx.genreIds.get(s.genre()),
                        "{" + String.join(",", s.language()) + "}",
                        s.ageRating().toUpperCase(Locale.ROOT),
                        s.status().toUpperCase(Locale.ROOT),
                        "{" + DemoRules.weekday(s.updateDay()) + "}",
                        s.cover(),
                        DemoRules.parseCount(s.views()),
                        likes,
                        Math.round(likes * DemoRules.SUBSCRIBERS_PER_LIKE),
                        launched,
                        launched,
                        launched
                    });
        }
        batch(
                "insert into series (id, slug, creator_id, type, title, summary, genre_id, languages,"
                        + " age_rating, status, visibility, update_days, cover_url, view_count,"
                        + " like_count, subscriber_count, launched_at, created_at, updated_at)"
                        + " values (?, ?, ?, ?, ?, ?, ?, cast(? as text[]), ?, ?, 'PUBLISHED',"
                        + " cast(? as text[]), ?, ?, ?, ?, ?, ?, ?) on conflict do nothing",
                new int[] {
                    UUID_T,
                    TEXT,
                    UUID_T,
                    TEXT,
                    TEXT,
                    TEXT,
                    Types.SMALLINT,
                    TEXT,
                    TEXT,
                    TEXT,
                    TEXT,
                    TEXT,
                    BIGINT,
                    BIGINT,
                    BIGINT,
                    TIME,
                    TIME,
                    TIME
                },
                rows);
    }

    // ---------- episodes, comic panels, novel chapters ----------

    private void episodes(Context ctx) {
        OffsetDateTime today = ctx.at(ctx.data.today());
        String chapterBlocks = json.writeValueAsString(ctx.data.novelChapterText());
        int chapterWords = wordCount(ctx.data.novelChapterText());

        List<Object[]> episodes = new ArrayList<>();
        List<Object[]> images = new ArrayList<>();
        List<Object[]> chapters = new ArrayList<>();
        for (DemoData.Series s : ctx.data.series()) {
            boolean novel = "novel".equals(s.type());
            for (SeedEpisode e : ctx.episodes.get(s.slug())) {
                UUID id = episodeId(s, e.number());
                // Fast Pass episodes are out now for coins and free from their date on.
                OffsetDateTime published = e.fastPass() ? today : ctx.at(e.date());
                episodes.add(
                        new Object[] {
                            id,
                            ctx.seriesIds.get(s.slug()),
                            e.number(),
                            e.title(),
                            published,
                            e.fastPass() ? ctx.at(e.date()) : null,
                            e.fastPass() ? ctx.data.fastPass().price() : null,
                            e.thumb(),
                            novel ? ctx.data.creatorNote() : null,
                            e.likes(),
                            published,
                            published
                        });
                if (novel) {
                    chapters.add(new Object[] {id, chapterBlocks, chapterWords});
                } else {
                    List<DemoData.Panel> panels = ctx.data.comicPanels();
                    for (int i = 0; i < panels.size(); i++) {
                        DemoData.Panel p = panels.get(i);
                        images.add(
                                new Object[] {id, i + 1, p.src(), p.width(), p.height(), p.alt()});
                    }
                }
            }
        }
        batch(
                "insert into episodes (id, series_id, number, title, status, published_at, free_at,"
                        + " price_coins, thumbnail_url, creator_note, like_count, created_at,"
                        + " updated_at) values (?, ?, ?, ?, 'PUBLISHED', ?, ?, ?, ?, ?, ?, ?, ?)"
                        + " on conflict do nothing",
                new int[] {
                    UUID_T,
                    UUID_T,
                    INT,
                    TEXT,
                    TIME,
                    TIME,
                    Types.SMALLINT,
                    TEXT,
                    TEXT,
                    BIGINT,
                    TIME,
                    TIME
                },
                episodes);
        batch(
                "insert into episode_images (episode_id, position, storage_key, width, height, alt)"
                        + " values (?, ?, ?, ?, ?, ?) on conflict do nothing",
                new int[] {UUID_T, Types.SMALLINT, TEXT, INT, INT, TEXT},
                images);
        batch(
                "insert into chapter_texts (episode_id, blocks, word_count)"
                        + " values (?, cast(? as jsonb), ?) on conflict do nothing",
                new int[] {UUID_T, TEXT, INT},
                chapters);
    }

    // ---------- comments: the demo's three per series page and three per episode ----------

    private void comments(Context ctx) {
        OffsetDateTime noon = ctx.at(ctx.data.today()).plusHours(12);
        List<Object[]> rows = new ArrayList<>();
        for (DemoData.Series s : ctx.data.series()) {
            UUID seriesId = ctx.seriesIds.get(s.slug());
            List<DemoData.Comment> onSeries = ctx.data.comments().series();
            for (int i = 0; i < onSeries.size(); i++) {
                rows.add(
                        comment(
                                ctx,
                                DemoRules.id("comment", s.id() + ":series:" + i),
                                seriesId,
                                null,
                                onSeries.get(i),
                                noon));
            }
            List<DemoData.Comment> onEpisode = ctx.data.comments().episode();
            for (SeedEpisode e : ctx.episodes.get(s.slug())) {
                for (int i = 0; i < onEpisode.size(); i++) {
                    rows.add(
                            comment(
                                    ctx,
                                    DemoRules.id("comment", s.id() + ":" + e.number() + ":" + i),
                                    seriesId,
                                    episodeId(s, e.number()),
                                    onEpisode.get(i),
                                    noon));
                }
            }
        }
        batch(
                "insert into comments (id, series_id, episode_id, author_id, body, like_count,"
                        + " created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
                        + " on conflict do nothing",
                new int[] {UUID_T, UUID_T, UUID_T, UUID_T, TEXT, INT, TIME, TIME},
                rows);
    }

    private static Object[] comment(
            Context ctx,
            UUID id,
            UUID seriesId,
            UUID episodeId,
            DemoData.Comment c,
            OffsetDateTime noon) {
        OffsetDateTime at = noon.minus(DemoRules.parseAgo(c.when()));
        return new Object[] {
            id, seriesId, episodeId, ctx.commenterIds.get(c.name()), c.text(), c.likes(), at, at
        };
    }

    // ---------- coin packs (prices stay null until A2 is settled) ----------

    private void coinPacks(Context ctx) {
        List<Object[]> rows = new ArrayList<>();
        List<DemoData.CoinPack> packs = ctx.data.coinPacks();
        for (int i = 0; i < packs.size(); i++) {
            DemoData.CoinPack p = packs.get(i);
            String tag =
                    p.tag() == null ? null : p.tag().toUpperCase(Locale.ROOT).replace(' ', '_');
            rows.add(new Object[] {i + 1, p.coins(), p.bonus(), tag, i + 1});
        }
        batch(
                "insert into coin_packs (id, coins, bonus_coins, tag, position)"
                        + " values (?, ?, ?, ?, ?) on conflict do nothing",
                new int[] {Types.SMALLINT, INT, INT, TEXT, Types.SMALLINT},
                rows);
    }

    // ---------- home hero and rankings ----------

    private void homeAndRankings(Context ctx) {
        List<Object[]> slides = new ArrayList<>();
        List<DemoData.HeroSlide> hero = ctx.data.homeHero();
        for (int i = 0; i < hero.size(); i++) {
            DemoData.HeroSlide h = hero.get(i);
            slides.add(new Object[] {i + 1, ctx.seriesIds.get(h.series()), h.tag(), h.blurb()});
        }
        batch(
                "insert into featured_slides (position, series_id, tag, blurb)"
                        + " values (?, ?, ?, ?) on conflict do nothing",
                new int[] {Types.SMALLINT, UUID_T, TEXT, TEXT},
                slides);

        // Same order as rankings() in src/data/selectors.ts.
        Comparator<DemoData.Series> byViews =
                Comparator.comparingLong((DemoData.Series s) -> DemoRules.parseCount(s.views()))
                        .reversed();
        List<DemoData.Series> comics =
                ctx.data.series().stream().filter(s -> "comic".equals(s.type())).toList();
        List<DemoData.Series> top =
                DemoRules.HOME_COMICS.stream()
                        .flatMap(t -> comics.stream().filter(s -> s.title().equals(t)))
                        .toList();
        List<DemoData.Series> orderedComics = new ArrayList<>(top);
        comics.stream().filter(s -> !top.contains(s)).sorted(byViews).forEach(orderedComics::add);
        List<DemoData.Series> orderedNovels =
                ctx.data.series().stream()
                        .filter(s -> "novel".equals(s.type()))
                        .sorted(byViews)
                        .toList();

        OffsetDateTime computed = ctx.at(ctx.data.today());
        List<Object[]> rows = new ArrayList<>();
        rankingRows(ctx, "COMICS", orderedComics, computed, rows);
        rankingRows(ctx, "NOVELS", orderedNovels, computed, rows);
        batch(
                "insert into rankings (kind, position, series_id, previous_position, computed_at)"
                        + " values (?, ?, ?, ?, ?) on conflict do nothing",
                new int[] {TEXT, INT, UUID_T, INT, TIME},
                rows);
    }

    private static void rankingRows(
            Context ctx,
            String kind,
            List<DemoData.Series> ordered,
            OffsetDateTime computed,
            List<Object[]> rows) {
        List<String> movement = ctx.data.rankingMovement();
        for (int i = 0; i < ordered.size(); i++) {
            int position = i + 1;
            String move = i < movement.size() ? movement.get(i) : "—";
            rows.add(
                    new Object[] {
                        kind,
                        position,
                        ctx.seriesIds.get(ordered.get(i).slug()),
                        previousPosition(position, move),
                        computed
                    });
        }
    }

    /** "▲ 2" at rank 1 → was 3; "▼ 1" at rank 4 → was 3; "—" → same; "NEW" → null. */
    static Integer previousPosition(int position, String movement) {
        String m = movement.trim();
        if (m.equals("NEW")) {
            return null;
        }
        if (m.startsWith("▲")) {
            return position + Integer.parseInt(m.substring(1).trim());
        }
        if (m.startsWith("▼")) {
            return Math.max(1, position - Integer.parseInt(m.substring(1).trim()));
        }
        return position;
    }

    // ---------- the demo reader ----------

    private void demoReader(Context ctx) {
        DemoData.Account account = ctx.data.demoAccount();
        UUID id = DemoRules.id("reader", account.email());
        OffsetDateTime joined = ctx.at(ctx.data.today().minusDays(60));
        jdbc.update(
                "insert into users (id, email, email_verified_at, password_hash, display_name,"
                        + " created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?) on conflict do nothing",
                new Object[] {
                    id,
                    account.email(),
                    joined,
                    passwords.encode(account.password()),
                    account.name(),
                    joined,
                    joined
                },
                new int[] {UUID_T, TEXT, TIME, TEXT, TEXT, TIME, TIME});
        jdbc.update(
                "insert into user_roles (user_id, role) values (?, 'READER') on conflict do nothing",
                new Object[] {id},
                new int[] {UUID_T});
        settings(id, ctx);

        // Starting coins as one BONUS ledger row; the wallet balance always equals the ledger.
        int coins = account.startingCoins();
        int wallet =
                jdbc.update(
                        "insert into coin_wallets (user_id, balance, updated_at) values (?, ?, ?)"
                                + " on conflict do nothing",
                        new Object[] {id, coins, joined},
                        new int[] {UUID_T, INT, TIME});
        if (wallet == 1 && coins > 0) {
            jdbc.update(
                    "insert into coin_ledger (user_id, amount, balance_after, reason, note,"
                            + " created_at) values (?, ?, ?, 'BONUS', 'Welcome coins', ?)",
                    new Object[] {id, coins, coins, joined},
                    new int[] {UUID_T, INT, INT, TIME});
        }

        // Continue reading: the first entry is the most recent.
        OffsetDateTime latest = ctx.at(ctx.data.today()).plusHours(10);
        List<Object[]> progress = new ArrayList<>();
        List<DemoData.ContinueEntry> entries = ctx.data.continueReading();
        for (int i = 0; i < entries.size(); i++) {
            DemoData.ContinueEntry c = entries.get(i);
            DemoData.Series s = ctx.series(c.series());
            progress.add(
                    new Object[] {
                        id,
                        ctx.seriesIds.get(c.series()),
                        episodeId(s, c.episode()),
                        (float) c.progress(),
                        c.episode(),
                        latest.minusHours(i)
                    });
        }
        batch(
                "insert into reading_progress (user_id, series_id, episode_id, progress,"
                        + " max_episode_number, updated_at) values (?, ?, ?, ?, ?, ?)"
                        + " on conflict do nothing",
                new int[] {UUID_T, UUID_T, UUID_T, Types.REAL, INT, TIME},
                progress);
    }

    private void settings(UUID userId, Context ctx) {
        jdbc.update(
                "insert into user_settings (user_id, updated_at) values (?, ?) on conflict do nothing",
                new Object[] {userId, ctx.at(ctx.data.today())},
                new int[] {UUID_T, TIME});
    }

    // ---------- helpers ----------

    private SeedReport report() {
        return new SeedReport(
                count("genres", ""),
                count("creator_profiles", ""),
                count("series", ""),
                count("series", "where type = 'COMIC'"),
                count("series", "where type = 'NOVEL'"),
                count("episodes", ""),
                count("episode_images", ""),
                count("chapter_texts", ""),
                count("comments", ""),
                count("coin_packs", ""),
                count("featured_slides", ""),
                count("rankings", ""));
    }

    private long count(String table, String where) {
        Long n = jdbc.queryForObject("select count(*) from " + table + " " + where, Long.class);
        return n == null ? 0 : n;
    }

    private void batch(String sql, int[] types, List<Object[]> rows) {
        for (int from = 0; from < rows.size(); from += BATCH) {
            jdbc.batchUpdate(sql, rows.subList(from, Math.min(rows.size(), from + BATCH)), types);
        }
    }

    private static UUID episodeId(DemoData.Series series, int number) {
        return DemoRules.id("episode", series.id() + ":" + number);
    }

    private static Object[] append(Object[] row, Object value) {
        Object[] copy = Arrays.copyOf(row, row.length + 1);
        copy[row.length] = value;
        return copy;
    }

    private static int wordCount(List<Map<String, Object>> blocks) {
        return blocks.stream()
                .map(b -> b.get("text"))
                .filter(String.class::isInstance)
                .mapToInt(t -> ((String) t).trim().split("\\s+").length)
                .sum();
    }

    /** Ids and generated episodes shared by the steps of one seed run. */
    private static final class Context {
        final DemoData data;
        final ZoneId zone;
        final Map<String, Integer> genreIds = new LinkedHashMap<>();
        final Map<String, UUID> creatorIds = new LinkedHashMap<>();
        final Map<String, UUID> commenterIds = new LinkedHashMap<>();
        final Map<String, UUID> seriesIds = new LinkedHashMap<>();
        final Map<String, List<SeedEpisode>> episodes = new LinkedHashMap<>();

        Context(DemoData data) {
            this.data = data;
            this.zone = ZoneId.of(data.timezone());
        }

        /** Midnight of that day in Phnom Penh, as UTC. */
        OffsetDateTime at(LocalDate day) {
            return day.atStartOfDay(zone).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
        }

        DemoData.Series series(String slug) {
            return data.series().stream()
                    .filter(s -> s.slug().equals(slug))
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("Unknown series " + slug));
        }
    }
}
