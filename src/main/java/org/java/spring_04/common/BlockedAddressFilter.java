package org.java.spring_04.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 8)
public class BlockedAddressFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(BlockedAddressFilter.class);

    private final RequestIpResolver requestIpResolver;
    private final IpLocationService ipLocationService;
    private final Environment environment;

    public BlockedAddressFilter(RequestIpResolver requestIpResolver,
                                IpLocationService ipLocationService,
                                Environment environment) {
        this.requestIpResolver = requestIpResolver;
        this.ipLocationService = ipLocationService;
        this.environment = environment;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String ip = normalizeIp(requestIpResolver.resolve(request));
        if (!blockedAddresses().contains(ip)) {
            filterChain.doFilter(request, response);
            return;
        }

        log.warn("BLOCKED_ADDRESS_DENIED method={} path={} ip={} location={} ua={}",
                request.getMethod(),
                request.getRequestURI(),
                ip,
                ipLocationService.resolveLabel(ip),
                trimHeader(request.getHeader("User-Agent"), 180));
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"message\":\"Forbidden.\"}");
    }

    private Set<String> blockedAddresses() {
        String raw = firstPresent(
                environment.getProperty("app.security.blocked-addresses"),
                environment.getProperty("APP_SECURITY_BLOCKED_ADDRESSES"),
                environment.getProperty("APP_BLOCKED_IPS"),
                environment.getProperty("BLOCKED_IPS"),
                System.getProperty("app.security.blocked-addresses", ""),
                System.getenv("APP_SECURITY_BLOCKED_ADDRESSES"),
                System.getenv("APP_BLOCKED_IPS"),
                System.getenv("BLOCKED_IPS")
        );
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(this::normalizeIp)
                .collect(Collectors.toUnmodifiableSet());
    }

    private String firstPresent(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private String normalizeIp(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        String normalized = value.trim();
        if (normalized.startsWith("::ffff:")) {
            normalized = normalized.substring(7);
        }
        if ("::1".equals(normalized) || "0:0:0:0:0:0:0:1".equals(normalized)) {
            return "127.0.0.1";
        }
        return normalized;
    }

    private String trimHeader(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String sanitized = value.replaceAll("[\\r\\n]", "").trim();
        return sanitized.length() <= maxLength ? sanitized : sanitized.substring(0, maxLength);
    }
}
