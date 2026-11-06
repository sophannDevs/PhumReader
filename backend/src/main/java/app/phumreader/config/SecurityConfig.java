package app.phumreader.config;

import app.phumreader.auth.service.JwtService;
import app.phumreader.auth.web.AccessTokenFilter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Security rules shared by every endpoint: stateless, signed in by the access cookie ({@link
 * AccessTokenFilter}), cookie-to-header CSRF on every write, JSON 401/403.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    /** Endpoints anyone may call with GET. */
    static final String[] PUBLIC_GET = {
        "/api/v1/health",
        "/api/v1/auth/csrf",
        // Public catalog (P3-06) and search.
        "/api/v1/home",
        "/api/v1/rankings",
        "/api/v1/genres",
        "/api/v1/genres/*",
        "/api/v1/series",
        "/api/v1/series/*",
        "/api/v1/series/*/episodes",
        // Reading free episodes and comment threads (P3-09, P3-13); locked episodes answer 402.
        "/api/v1/series/*/episodes/*",
        "/api/v1/series/*/comments",
        "/api/v1/series/*/episodes/*/comments",
        "/api/v1/search",
        // Coin packs on the Coins page (P3-11).
        "/api/v1/coins/packs",
        "/actuator/health",
        "/actuator/health/**",
        "/v3/api-docs",
        "/v3/api-docs/**",
        "/swagger-ui.html",
        "/swagger-ui/**"
    };

    /** Endpoints anyone may call with POST (they still need the CSRF header). */
    static final String[] PUBLIC_POST = {
        "/api/v1/auth/signup",
        "/api/v1/auth/verify",
        "/api/v1/auth/resend-code",
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password"
    };

    /** Argon2id password hashes (Spring Security 5.8+ parameters). */
    @Bean
    PasswordEncoder passwordEncoder() {
        return Argon2PasswordEncoder.defaultsForSpringSecurity_v5_8();
    }

    @Bean
    SecurityFilterChain apiSecurity(
            HttpSecurity http,
            JwtService jwt,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver errors)
            throws Exception {
        http
                // Cookie-to-header CSRF: XSRF-TOKEN cookie, X-XSRF-TOKEN header on every write.
                // One stable token per browser: by default Spring replaces it whenever a request
                // becomes authenticated, which with cookie sign-in means on every request.
                .csrf(csrf ->
                                csrf.spa()
                                        .sessionAuthenticationStrategy(
                                                new NullAuthenticatedSessionStrategy()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .addFilterBefore(
                        new AccessTokenFilter(jwt), UsernamePasswordAuthenticationFilter.class)
                .authorizeHttpRequests(auth ->
                        auth.requestMatchers(HttpMethod.GET, PUBLIC_GET)
                                .permitAll()
                                .requestMatchers(HttpMethod.POST, PUBLIC_POST)
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
