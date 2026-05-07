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
import java.util.List;
import java.util.UUID;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class ServiceRequestLoggingFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(ServiceRequestLoggingFilter.class);
    private static final long SLOW_REQUEST_MS = 1500L;
    private static final List<String> STATIC_PREFIXES = List.of("/css/", "/js/", "/images/", "/favicon", "/ads.txt", "/robots.txt");

    private final RequestIpResolver requestIpResolver;
    private final IpLocationService ipLocationService;

    public ServiceRequestLoggingFilter(RequestIpResolver requestIpResolver, IpLocationService ipLocationService) {
        this.requestIpResolver = requestIpResolver;
        this.ipLocationService = ipLocationService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (isLowValueStaticRequest(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        String requestId = firstNonBlank(request.getHeader("X-Request-Id"), UUID.randomUUID().toString());
        long startedAt = System.nanoTime();
        request.setAttribute("serviceRequestId", requestId);

        String ip = requestIpResolver.resolve(request);

        log.info("SERVICE_REQUEST_START id={} method={} path={} query={} ip={} location={} ua={} session={} referer={}",
                requestId,
                request.getMethod(),
                request.getRequestURI(),
                sanitizeQuery(request.getQueryString()),
                ip,
                ipLocationService.resolveLabel(ip),
                trimHeader(request.getHeader("User-Agent"), 180),
                request.getSession(false) == null ? "none" : "present",
                trimHeader(request.getHeader("Referer"), 240));

        try {
            filterChain.doFilter(request, response);
        } finally {
            long elapsedMs = (System.nanoTime() - startedAt) / 1_000_000L;
            int status = response.getStatus();
            if (status >= 500) {
                log.error("SERVICE_REQUEST_END id={} status={} elapsedMs={} method={} path={}",
                        requestId, status, elapsedMs, request.getMethod(), request.getRequestURI());
            } else if (status >= 400) {
                log.warn("SERVICE_REQUEST_END id={} status={} elapsedMs={} method={} path={}",
                        requestId, status, elapsedMs, request.getMethod(), request.getRequestURI());
            } else if (elapsedMs >= SLOW_REQUEST_MS) {
                log.warn("SERVICE_REQUEST_SLOW id={} status={} elapsedMs={} method={} path={}",
                        requestId, status, elapsedMs, request.getMethod(), request.getRequestURI());
            } else if (isImportantPath(request.getRequestURI()) || isUnsafeMethod(request.getMethod())) {
                log.info("SERVICE_REQUEST_END id={} status={} elapsedMs={} method={} path={}",
                        requestId, status, elapsedMs, request.getMethod(), request.getRequestURI());
            }
        }
    }

    private boolean isLowValueStaticRequest(String uri) {
        if (uri == null) {
            return false;
        }
        return STATIC_PREFIXES.stream().anyMatch(uri::startsWith);
    }

    private boolean isImportantPath(String uri) {
        return uri != null && (uri.startsWith("/api/")
                || uri.startsWith("/admin")
                || uri.startsWith("/board")
                || uri.startsWith("/m/board")
                || uri.startsWith("/profile")
                || "/login".equals(uri)
                || "/logout".equals(uri));
    }

    private boolean isUnsafeMethod(String method) {
        return "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method);
    }

    private String sanitizeQuery(String query) {
        if (query == null || query.isBlank()) {
            return "";
        }
        return query
                .replaceAll("(?i)(password|pass|token|code|secret)=[^&]*", "$1=***")
                .replaceAll("[\\r\\n]", "");
    }

    private String trimHeader(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String sanitized = value.replaceAll("[\\r\\n]", "").trim();
        return sanitized.length() <= maxLength ? sanitized : sanitized.substring(0, maxLength);
    }

    private String firstNonBlank(String first, String fallback) {
        return first == null || first.isBlank() ? fallback : first.trim();
    }
}
