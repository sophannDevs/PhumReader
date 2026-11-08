package app.phumreader.payment.service;

import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.json.JsonMapper;

/** Starts the real PayWay gateway once {@code PAYWAY_MERCHANT_ID} is set. */
@Configuration
@EnableConfigurationProperties(PayWayProperties.class)
class PayWayConfig {

    @Bean
    @ConditionalOnExpression("!'${phumreader.payments.payway.merchant-id:}'.isEmpty()")
    PayWayGateway payWayGateway(PayWayProperties props, Clock clock, JsonMapper json) {
        if (props.apiKey().isBlank() || props.callbackUrl().isBlank()) {
            throw new IllegalStateException(
                    "phumreader.payments.payway needs api-key and callback-url when merchant-id is set");
        }
        return new HttpPayWayGateway(props, clock, json);
    }
}
