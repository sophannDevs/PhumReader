package app.phumreader.common.paging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import app.phumreader.common.error.ApiException;
import org.junit.jupiter.api.Test;

class CursorsTest {

    @Test
    void roundTripsAPositionKeyIncludingKhmer() {
        String key = "2026-11-05T10:00:00Z|ភូមិ";
        String cursor = Cursors.encode(key);
        assertThat(cursor).matches("[A-Za-z0-9_-]+");
        assertThat(Cursors.decode(cursor)).isEqualTo(key);
    }

    @Test
    void noCursorMeansTheFirstPage() {
        assertThat(Cursors.decode(null)).isNull();
        assertThat(Cursors.decode(" ")).isNull();
    }

    @Test
    void rejectsACursorItDidNotMake() {
        assertThatThrownBy(() -> Cursors.decode("not a cursor!"))
                .isInstanceOfSatisfying(
                        ApiException.class,
                        ex -> assertThat(ex.code()).isEqualTo("invalid_cursor"));
    }

    @Test
    void keepsTheLimitInRange() {
        assertThat(Cursors.limit(null)).isEqualTo(Cursors.DEFAULT_LIMIT);
        assertThat(Cursors.limit(0)).isEqualTo(1);
        assertThat(Cursors.limit(500)).isEqualTo(Cursors.MAX_LIMIT);
        assertThat(Cursors.limit(12)).isEqualTo(12);
    }
}
