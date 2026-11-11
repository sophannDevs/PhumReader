package app.phumreader.notification.domain;

/**
 * A reader's quiet hours: no push from {@code from} o'clock up to (not including) {@code to}
 * o'clock, in Asia/Phnom_Penh. The window may wrap midnight (22 to 7); the same hour twice means no
 * quiet time.
 *
 * @param on the reader switched quiet hours on
 * @param from first quiet hour, 0-23
 * @param to first hour that is no longer quiet, 0-23
 */
public record QuietHours(boolean on, int from, int to) {

    /** Whether push waits at this hour of the day (0-23). */
    public boolean covers(int hour) {
        if (!on || from == to) {
            return false;
        }
        return from < to ? hour >= from && hour < to : hour >= from || hour < to;
    }
}
