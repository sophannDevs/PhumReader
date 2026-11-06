package app.phumreader.auth.service;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class DeviceNamesTest {

    @ParameterizedTest
    @CsvSource(
            delimiter = '|',
            nullValues = "-",
            value = {
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " Chrome/140.0.0.0 Safari/537.36|Chrome|Windows",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0|Edge|Windows",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like"
                        + " Gecko) Version/18.5 Safari/605.1.15|Safari|macOS",
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15"
                        + " (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1|Chrome|iPhone",
                "Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko)"
                        + " SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36"
                        + "|Samsung Internet|Android",
                "Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0"
                        + "|Firefox|Linux",
                "curl/8.9.1|-|-",
            })
    void namesTheBrowserAndTheSystem(String userAgent, String browser, String system) {
        assertThat(DeviceNames.browser(userAgent)).isEqualTo(browser);
        assertThat(DeviceNames.system(userAgent)).isEqualTo(system);
    }

    @ParameterizedTest
    @CsvSource(nullValues = "-", value = "-")
    void noUserAgentMeansUnknown(String userAgent) {
        assertThat(DeviceNames.browser(userAgent)).isNull();
        assertThat(DeviceNames.system(userAgent)).isNull();
    }
}
