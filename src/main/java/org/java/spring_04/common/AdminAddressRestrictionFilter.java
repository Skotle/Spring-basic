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
@Order(Ordered.HIGHEST_PRECEDENCE + 25)
public class AdminAddressRestrictionFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(AdminAddressRestrictionFilter.class);

    private final RequestIpResolver requestIpResolver;
    private final Environment environment;

    public AdminAddressRestrictionFilter(RequestIpResolver requestIpResolver, Environment environment) {
        this.requestIpResolver = requestIpResolver;
        this.environment = environment;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!isAdminPath(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = requestIpResolver.resolve(request);
        Set<String> allowedAddresses = allowedAdminAddresses();
        if (!allowedAddresses.contains(normalizeIp(ip))) {
            log.warn("ADMIN_ADDRESS_DENIED method={} path={} ip={} allowedCount={} ua={}",
                    request.getMethod(),
                    request.getRequestURI(),
                    ip,
                    allowedAddresses.size(),
                    request.getHeader("User-Agent"));
            reject(response);
            return;
        }

        log.info("ADMIN_ADDRESS_ALLOWED method={} path={} ip={}", request.getMethod(), request.getRequestURI(), ip);

        filterChain.doFilter(request, response);
    }

    private boolean isAdminPath(String uri) {
        return "/admin-login".equals(uri)
                || "/admin".equals(uri)
                || "/admin/login".equals(uri)
                || uri.startsWith("/admin/")
                || uri.startsWith("/api/admin/");
    }

    private Set<String> allowedAdminAddresses() {
        String raw = firstPresent(
                environment.getProperty("app.security.admin-allowed-addresses"),
                environment.getProperty("APP_ADMIN_ALLOWED_ADDRESSES"),
                environment.getProperty("APP_ADMIN_ALLOWED_IPS"),
                environment.getProperty("ADMIN_ALLOWED_IPS"),
                System.getProperty("app.security.admin-allowed-addresses", ""),
                System.getenv("APP_ADMIN_ALLOWED_ADDRESSES"),
                System.getenv("APP_ADMIN_ALLOWED_IPS"),
                System.getenv("ADMIN_ALLOWED_IPS")
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

    private void reject(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"success\":false,\"message\":\"Admin access is not allowed from this address.\"}");
    }
}
