package org.java.spring_04.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 12)
public class SecurityProbeFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(SecurityProbeFilter.class);

    private final RequestIpResolver requestIpResolver;
    private final IpLocationService ipLocationService;
    private final SecurityRateLimiter rateLimiter;

    public SecurityProbeFilter(RequestIpResolver requestIpResolver,
                               IpLocationService ipLocationService,
                               SecurityRateLimiter rateLimiter) {
        this.requestIpResolver = requestIpResolver;
        this.ipLocationService = ipLocationService;
        this.rateLimiter = rateLimiter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (!isSuspiciousProbe(uri)) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = requestIpResolver.resolve(request);
        if (!rateLimiter.allow("security-probe", ip, 8, Duration.ofMinutes(10))) {
            log.warn("SECURITY_PROBE_RATE_LIMITED method={} path={} ip={} location={} ua={}",
                    request.getMethod(),
                    uri,
                    ip,
                    ipLocationService.resolveLabel(ip),
                    trimHeader(request.getHeader("User-Agent"), 180));
            response.setStatus(429);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"success\":false,\"message\":\"Too many suspicious requests.\"}");
            return;
        }

        log.warn("SECURITY_PROBE_BLOCKED method={} path={} ip={} location={} ua={}",
                request.getMethod(),
                uri,
                ip,
                ipLocationService.resolveLabel(ip),
                trimHeader(request.getHeader("User-Agent"), 180));
        response.setStatus(HttpServletResponse.SC_NOT_FOUND);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"message\":\"Not found.\"}");
    }

    private boolean isSuspiciousProbe(String uri) {
        if (uri == null || uri.isBlank()) {
            return false;
        }
        String path = uri.toLowerCase(Locale.ROOT);
        return path.contains("..")
                || path.contains("%2e")
                || path.endsWith("/.env")
                || path.endsWith("/.env.local")
                || path.contains("/.git")
                || path.endsWith(".php")
                || path.endsWith(".bak")
                || path.endsWith(".sql")
                || path.endsWith(".ini")
                || path.endsWith(".yml")
                || path.endsWith(".yaml")
                || path.endsWith(".config")
                || path.endsWith("/wp-login.php")
                || path.endsWith("/xmlrpc.php");
    }

    private String trimHeader(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String sanitized = value.replaceAll("[\\r\\n]", "").trim();
        return sanitized.length() <= maxLength ? sanitized : sanitized.substring(0, maxLength);
    }
}
