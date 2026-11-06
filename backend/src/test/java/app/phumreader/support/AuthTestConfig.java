package app.phumreader.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * A movable clock and an email recorder for sign-in tests ({@code @Import(AuthTestConfig.class)}).
 */
@TestConfiguration(proxyBeanMethods = false)
public class AuthTestConfig {

    @Bean
    @Primary
    MutableClock mutableClock() {
        return new MutableClock();
    }

    @Bean
    @Primary
    RecordingEmailSender recordingEmailSender() {
        return new RecordingEmailSender();
    }
}
