package app.phumreader.series.repository;

import java.sql.Array;
import java.sql.SQLException;
import java.time.DayOfWeek;
import java.util.Arrays;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** Reads {@code series.update_days} ('MONDAY' … 'SUNDAY') in week order. */
final class DayArrays {

    private DayArrays() {}

    static List<DayOfWeek> days(@Nullable Array array) throws SQLException {
        if (array == null) {
            return List.of();
        }
        return Arrays.stream((String[]) array.getArray()).map(DayOfWeek::valueOf).sorted().toList();
    }
}
