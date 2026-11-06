package app.phumreader;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/** PhumReader API: the backend for the PhumReader website (see docs/BACKEND.md). */
@SpringBootApplication
@ConfigurationPropertiesScan
public class PhumReaderApplication {

    public static void main(String[] args) {
        SpringApplication.run(PhumReaderApplication.class, args);
    }
}
