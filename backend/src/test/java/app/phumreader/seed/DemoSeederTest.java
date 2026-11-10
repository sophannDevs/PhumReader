package app.phumreader.seed;

import static org.assertj.core.api.Assertions.assertThat;

import app.phumreader.support.IntegrationTest;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

/** Seeds the embedded database inside the test's transaction (rolled back afterwards). */
@IntegrationTest
@Transactional
class DemoSeederTest {

    @Autowired DemoSeeder seeder;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;

    @Test
    void seedsTheWholeDemoAndASecondRunChangesNothing() {
        DemoSeeder.SeedReport first = seeder.seed();

        assertThat(first.genres()).isEqualTo(8);
        assertThat(first.creators()).isEqualTo(12);
        assertThat(first.series()).isEqualTo(48);
        assertThat(first.comics()).isEqualTo(41);
        assertThat(first.novels()).isEqualTo(7);
        // Sum of every series' episodes (3 hand-written lists + the episode rule).
        assertThat(first.episodes()).isEqualTo(3_956);
        assertThat(first.episodeImages()).isEqualTo(3_367L * 9);
        assertThat(first.chapterTexts()).isEqualTo(589);
        assertThat(first.comments()).isEqualTo(48L * 3 + 3_956L * 3);
        assertThat(first.coinPacks()).isEqualTo(5);
        assertThat(first.featuredSlides()).isEqualTo(3);
        assertThat(first.rankings()).isEqualTo(48);

        long users = count("select count(*) from users");
        long ledger = count("select count(*) from coin_ledger");

        assertThat(seeder.seed()).isEqualTo(first);
        assertThat(count("select count(*) from users")).isEqualTo(users);
        assertThat(count("select count(*) from coin_ledger")).isEqualTo(ledger);
    }

    @Test
    void demoReaderHasThreeCoinsContinueReadingAndNoOrders() {
        seeder.seed();
        Map<String, Object> reader =
                jdbc.queryForMap(
                        "select id, password_hash, display_name, email_verified_at from users"
                                + " where email = 'reader@phumireader.app'");
        assertThat(reader.get("display_name")).isEqualTo("Sokha Chan");
        assertThat(reader.get("email_verified_at")).isNotNull();
        assertThat(passwords.matches("PhumiReader1!", (String) reader.get("password_hash")))
                .isTrue();

        Object id = reader.get("id");
        assertThat(count("select balance from coin_wallets where user_id = ?", id)).isEqualTo(3);
        assertThat(count("select coalesce(sum(amount), 0) from coin_ledger where user_id = ?", id))
                .isEqualTo(3);
        // No paid order yet, so the first-purchase bonus is still on offer (e2e flow 3).
        assertThat(count("select count(*) from payment_orders where user_id = ?", id)).isZero();
        assertThat(
                        jdbc.queryForList(
                                "select s.slug from reading_progress p join series s on s.id = p.series_id"
                                        + " where p.user_id = ? order by p.updated_at desc",
                                String.class,
                                id))
                .containsExactly(
                        "crown-of-ash", "tiny-dragon-cafe", "letters-to-tuesday", "sunday-sword");
    }

    @Test
    void standInCreatorCanLogInAndOwnsTheirSeries() {
        seeder.seed();
        String hash =
                jdbc.queryForObject(
                        "select password_hash from users where email = 'creator@toonwave.app'",
                        String.class);
        assertThat(passwords.matches("PhumiReader1!", hash)).isTrue();
        assertThat(
                        count(
                                "select count(*) from series s join users u on u.id = s.creator_id"
                                        + " where u.email = 'creator@toonwave.app'"))
                .isPositive();
        // The other demo creators and the commenters cannot log in.
        assertThat(
                        count(
                                "select count(*) from users where password_hash is not null"
                                        + " and email not in ('reader@phumireader.app', 'creator@toonwave.app')"))
                .isZero();
    }

    @Test
    void generatedEpisodesMatchTheWebsitesNumbers() {
        seeder.seed();
        // Expected values computed with the website's own rule (src/data/selectors.ts).
        assertEpisode("the-last-archivist", 1, "Chapter 1: Flour and Ink", 42_200, null, null);
        assertEpisode("the-last-archivist", 12, "Chapter 12: The Third Letter", 43_200, null, null);
        assertEpisode(
                "the-last-archivist",
                13,
                "Chapter 13: Flour and Ink",
                20_300,
                5,
                phnomPenhMidnight(2026, 11, 12));
        assertEpisode(
                "the-last-archivist",
                15,
                "Chapter 15: A Reply on the Counter",
                21_900,
                5,
                phnomPenhMidnight(2026, 11, 26));
        assertEpisode("crown-of-ash", 94, "(S2) Episode 94", 47_100, null, null);
        // Hand-written list: glass-compass episode 66 is Fast Pass, free on Nov 12, "22.5K" likes.
        assertEpisode(
                "glass-compass", 66, "Episode 66", 22_500, 5, phnomPenhMidnight(2026, 11, 12));

        assertThat(
                        jdbc.queryForObject(
                                "select published_at from episodes e join series s on s.id = e.series_id"
                                        + " where s.slug = 'the-last-archivist' and e.number = 1",
                                OffsetDateTime.class))
                .isEqualTo(phnomPenhMidnight(2026, 8, 20));
    }

    @Test
    void rankingsKeepTheDemoOrderAndMovement() {
        seeder.seed();
        var top =
                jdbc.queryForList(
                        "select s.title, r.previous_position from rankings r join series s on"
                                + " s.id = r.series_id where r.kind = 'COMICS' and r.position <= 5"
                                + " order by r.position");
        assertThat(top)
                .extracting(row -> row.get("title"))
                .containsExactly(
                        "Paper Tigers",
                        "Neon Monsoon",
                        "Tiny Dragon Café",
                        "The Orchard Pact",
                        "Summer Index");
        // "▲ 2", "—", "▲ 5", "▼ 1", "NEW"
        assertThat(top)
                .extracting(row -> row.get("previous_position"))
                .containsExactly(3, 2, 8, 3, null);
    }

    private void assertEpisode(
            String slug,
            int number,
            String title,
            long likes,
            Integer price,
            OffsetDateTime freeAt) {
        String where =
                " from episodes e join series s on s.id = e.series_id where s.slug = ? and e.number = ?";
        Map<String, Object> row =
                jdbc.queryForMap(
                        "select e.title, e.like_count, e.price_coins" + where, slug, number);
        assertThat(row.get("title")).isEqualTo(title);
        assertThat(((Number) row.get("like_count")).longValue()).isEqualTo(likes);
        Number actualPrice = (Number) row.get("price_coins");
        assertThat(actualPrice == null ? null : actualPrice.intValue()).isEqualTo(price);
        assertThat(
                        jdbc.queryForObject(
                                "select e.free_at" + where, OffsetDateTime.class, slug, number))
                .isEqualTo(freeAt);
    }

    private static OffsetDateTime phnomPenhMidnight(int year, int month, int day) {
        // Asia/Phnom_Penh is UTC+7 all year.
        return OffsetDateTime.of(year, month, day, 0, 0, 0, 0, ZoneOffset.ofHours(7))
                .withOffsetSameInstant(ZoneOffset.UTC);
    }

    private long count(String sql, Object... args) {
        Number n = jdbc.queryForObject(sql, Number.class, args);
        return n == null ? 0 : n.longValue();
    }
}
