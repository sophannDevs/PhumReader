package app.phumreader.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Same rule as the website: at least 3 of 8+ chars, upper+lower, a number, a symbol. */
class PasswordPolicyTest {

    @Test
    void acceptsThreeOfFourRules() {
        assertThat(PasswordPolicy.isStrongEnough("Toonwave1!")).isTrue();
        assertThat(PasswordPolicy.isStrongEnough("toonwave1!")).isTrue(); // length, number, symbol
        assertThat(PasswordPolicy.isStrongEnough("Ab1!")).isTrue(); // case, number, symbol
        assertThat(PasswordPolicy.isStrongEnough("Toonwaveee")).isFalse(); // length, case
        assertThat(PasswordPolicy.isStrongEnough("12345678")).isFalse(); // length, number
        assertThat(PasswordPolicy.isStrongEnough("ab c")).isFalse();
    }

    @Test
    void khmerLettersAreSymbolsNotCase() {
        // Like the website's /[a-z]/ and /[A-Z]/ checks: only A–Z count as upper and lower case.
        assertThat(PasswordPolicy.isStrongEnough("ភូមិ12345")).isTrue(); // length, number, symbol
    }

    @Test
    void refusesOverlongPasswords() {
        assertThat(PasswordPolicy.isStrongEnough("Aa1!".repeat(33))).isFalse();
    }
}
