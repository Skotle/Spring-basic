package org.java.spring_04.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;

@Component
public class OriginPolicyFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(OriginPolicyFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (isUnsafeMethod(request.getMethod()) && !isSameOrigin(request)) {
            log.warn("ORIGIN_POLICY_DENIED method={} path={} remote={} origin={} referer={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    request.getRemoteAddr(),
                    request.getHeader("Origin"),
                    request.getHeader("Referer"));
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
            String scheme = forwardedScheme(request);
            String host = forwardedHost(request);
            int port = normalizePort(scheme, forwardedPort(request, scheme));
            int sourcePort = normalizePort(uri.getScheme(), uri.getPort());
            return scheme.equalsIgnoreCase(uri.getScheme())
                    && host.equalsIgnoreCase(uri.getHost())
                    && port == sourcePort;
        } catch (Exception ignored) {
            return false;
        }
    }

    private String forwardedScheme(HttpServletRequest request) {
        String proto = request.getHeader("X-Forwarded-Proto");
        return proto == null || proto.isBlank() ? request.getScheme() : proto.split(",")[0].trim();
    }

    private String forwardedHost(HttpServletRequest request) {
        String host = request.getHeader("X-Forwarded-Host");
        if (host == null || host.isBlank()) {
            host = request.getHeader("Host");
        }
        if (host == null || host.isBlank()) {
            return request.getServerName();
        }
        String first = host.split(",")[0].trim();
        int colon = first.lastIndexOf(':');
        return colon > -1 ? first.substring(0, colon) : first;
    }

    private int forwardedPort(HttpServletRequest request, String scheme) {
        String forwardedPort = request.getHeader("X-Forwarded-Port");
        if (forwardedPort != null && !forwardedPort.isBlank()) {
            try {
                return Integer.parseInt(forwardedPort.split(",")[0].trim());
            } catch (NumberFormatException ignored) {
            }
        }
        String host = request.getHeader("X-Forwarded-Host");
        if (host == null || host.isBlank()) {
            host = request.getHeader("Host");
        }
        if (host != null) {
            String first = host.split(",")[0].trim();
            int colon = first.lastIndexOf(':');
            if (colon > -1) {
                try {
                    return Integer.parseInt(first.substring(colon + 1));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return request.getServerPort() > 0 ? request.getServerPort() : ("https".equalsIgnoreCase(scheme) ? 443 : 80);
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
