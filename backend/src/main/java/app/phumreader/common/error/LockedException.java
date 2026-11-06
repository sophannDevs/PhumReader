package app.phumreader.common.error;

import java.time.LocalDate;

/**
 * 402: the episode needs an unlock (Fast Pass). The body carries the price and the day it becomes
 * free, so the website can show the unlock dialog straight away.
 */
public class LockedException extends RuntimeException {

    private final String code;
    private final int price;
    private final LocalDate freeOn;

    public LockedException(String code, String message, int price, LocalDate freeOn) {
        super(message);
        this.code = code;
        this.price = price;
        this.freeOn = freeOn;
    }

    public String code() {
        return code;
    }

    public int price() {
        return price;
    }

    public LocalDate freeOn() {
        return freeOn;
    }
}
