package app.phumreader.seed;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Seeds the demo content at startup when the {@code seed} profile is on: {@code ./gradlew bootRun
 * --args='--spring.profiles.active=dev,seed'}. Safe to run again.
 */
@Component
@Profile("seed")
class SeedRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedRunner.class);

    private final DemoSeeder seeder;

    SeedRunner(DemoSeeder seeder) {
        this.seeder = seeder;
    }

    @Override
    public void run(ApplicationArguments args) {
        long started = System.nanoTime();
        DemoSeeder.SeedReport report = seeder.seed();
        log.info(
                "Demo data seeded in {} ms: {}", (System.nanoTime() - started) / 1_000_000, report);
    }
}
