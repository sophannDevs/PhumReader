package app.phumreader.search.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Turns the Meilisearch index on when {@code phumreader.search.url} is set. */
@Configuration
@EnableScheduling
class SearchConfig {

    @Bean
    @ConditionalOnExpression("!'${phumreader.search.url:}'.isBlank()")
    SearchIndex searchIndex(
            @Value("${phumreader.search.url}") String url,
            @Value("${phumreader.search.key:}") String key,
            @Value("${phumreader.search.index:series}") String index) {
        return new MeilisearchIndex(url, key, index);
    }
}
