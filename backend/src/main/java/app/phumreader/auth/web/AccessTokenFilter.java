package app.phumreader.auth.web;

import app.phumreader.auth.service.JwtService;
import app.phumreader.common.security.CurrentUser;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Signs the request in when its access cookie holds a valid token. A missing, expired or forged
 * token leaves the request anonymous: protected endpoints then answer 401 and the website
 * refreshes. Created by SecurityConfig (not a bean, so it runs only inside the security chain).
 */
public class AccessTokenFilter extends OncePerRequestFilter {

    private final JwtService jwt;
    private final SecurityContextHolderStrategy contexts =
            SecurityContextHolder.getContextHolderStrategy();

    public AccessTokenFilter(JwtService jwt) {
        this.jwt = jwt;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = accessCookie(request);
        if (token != null) {
            jwt.verify(token)
                    .ifPresent(claims -> {
                        CurrentUser user = new CurrentUser(claims.userId(), claims.roles());
                        List<SimpleGrantedAuthority> authorities =
                                claims.roles().stream()
                                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role))
                                        .toList();
                        SecurityContext context = contexts.createEmptyContext();
                        context.setAuthentication(
                                UsernamePasswordAuthenticationToken.authenticated(
                                        user, null, authorities));
                        contexts.setContext(context);
                    });
        }
        chain.doFilter(request, response);
    }

    private static String accessCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (AuthCookies.ACCESS.equals(cookie.getName()) && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
