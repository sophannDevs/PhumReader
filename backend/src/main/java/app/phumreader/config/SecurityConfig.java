package app.phumreader.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.annotation.web.configurers.CsrfConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Security rules shared by every endpoint. Sign-in (JWT access and refresh cookies) is added in
 * Stage 1 Step 4; until then only the public endpoints below answer without a login.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /** Endpoints anyone may call with GET. */
    static final String[] PUBLIC_GET = {
        "/api/v1/health",
        "/actuator/health",
        "/actuator/health/**",
        "/v3/api-docs",
        "/v3/api-docs/**",
        "/swagger-ui.html",
        "/swagger-ui/**"
    };

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver errors)
            throws Exception {
        http
                // Cookie-to-header CSRF: XSRF-TOKEN cookie, X-XSRF-TOKEN header on every write.
                .csrf(CsrfConfigurer::spa)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .authorizeHttpRequests(auth ->
                        auth.requestMatchers(HttpMethod.GET, PUBLIC_GET)
                                .permitAll()
                                .anyRequest()
                                .authenticated())
                // 401 and 403 use the same JSON error body as every other error.
                .exceptionHandling(e ->
                        e.authenticationEntryPoint((request, response, ex) ->
                                        errors.resolveException(request, response, null, ex))
                                .accessDeniedHandler((request, response, ex) ->
                                        errors.resolveException(request, response, null, ex)));
        return http.build();
    }
}
