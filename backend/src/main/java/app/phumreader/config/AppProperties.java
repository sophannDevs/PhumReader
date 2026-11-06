package app.phumreader.config;

import jakarta.validation.constraints.NotBlank;
import org.hibernate.validator.constraints.URL;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * PhumReader settings ({@code phumreader.*}). Values come from the environment or {@code
 * backend/.env}; the app refuses to start when a required one is missing and names it.
 *
 * @param frontendUrl the website's address, used for links in emails and sign-in redirects
 */
@Validated
@ConfigurationProperties("phumreader")
public record AppProperties(@NotBlank @URL String frontendUrl) {}
