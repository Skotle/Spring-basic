package org.java.spring_04.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;

@Component
public class OriginPolicyFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (isUnsafeMethod(request.getMethod()) && !isSameOrigin(request)) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Cross-site request blocked.");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private boolean isUnsafeMethod(String method) {
        return "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method);
    }

    private boolean isSameOrigin(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        if (origin != null && !origin.isBlank()) {
            return matchesRequestOrigin(request, origin);
        }

        String referer = request.getHeader("Referer");
        if (referer != null && !referer.isBlank()) {
            return matchesRequestOrigin(request, referer);
        }

        return true;
    }

    private boolean matchesRequestOrigin(HttpServletRequest request, String source) {
        try {
            URI uri = URI.create(source);
            String scheme = request.getScheme();
            String host = request.getServerName();
            int port = normalizePort(scheme, request.getServerPort());
            int sourcePort = normalizePort(uri.getScheme(), uri.getPort());
            return scheme.equalsIgnoreCase(uri.getScheme())
                    && host.equalsIgnoreCase(uri.getHost())
                    && port == sourcePort;
        } catch (Exception ignored) {
            return false;
        }
    }

    private int normalizePort(String scheme, int port) {
        if (port > 0) {
            return port;
        }
        if ("https".equalsIgnoreCase(scheme)) {
            return 443;
        }
        return 80;
    }
}
