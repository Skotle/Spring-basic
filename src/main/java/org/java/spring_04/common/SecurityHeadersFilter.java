package org.java.spring_04.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class SecurityHeadersFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        response.setHeader("X-XSS-Protection", "0");
        response.setHeader("X-Download-Options", "noopen");
        response.setHeader("X-Permitted-Cross-Domain-Policies", "none");
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
        response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
        if (request.getRequestURI().startsWith("/api/") || request.getRequestURI().startsWith("/admin")) {
            response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
            response.setHeader("Pragma", "no-cache");
        }
        if (request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"))) {
            response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
        }
        response.setHeader("Content-Security-Policy",
                "default-src 'self' https://storage.googleapis.com; " +
                        "connect-src 'self'; " +
                        "img-src 'self' data: https://storage.googleapis.com https://*.googlesyndication.com https://*.googleusercontent.com https://*.gstatic.com https://*.kakaocdn.net https://*.kakao.com; " +
                        "style-src 'self' 'unsafe-inline'; " +
                        "script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://pagead2.googlesyndication.com https://t1.kakaocdn.net; " +
                        "frame-src 'self' https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.kakao.com; " +
                        "font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
        filterChain.doFilter(request, response);
    }
}
