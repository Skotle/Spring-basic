package org.java.spring_04.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class RequestIpResolver {
    private final Set<String> trustedProxies;

    public RequestIpResolver(@Value("${app.security.trusted-proxies:127.0.0.1,::1}") String trustedProxies) {
        this.trustedProxies = Arrays.stream(trustedProxies.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(this::normalizeIp)
                .collect(Collectors.toUnmodifiableSet());
    }

    public String resolve(HttpServletRequest request) {
        String remoteAddr = normalizeIp(request.getRemoteAddr());
        if (isTrustedProxy(remoteAddr)) {
            String forwarded = firstHeaderToken(request.getHeader("X-Forwarded-For"));
            if (forwarded != null) {
                return normalizeIp(forwarded);
            }
            String realIp = firstHeaderToken(request.getHeader("X-Real-IP"));
            if (realIp != null) {
                return normalizeIp(realIp);
            }
        }
        return normalizeIp(remoteAddr);
    }

    private String firstHeaderToken(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String[] parts = value.split(",");
        if (parts.length == 0) {
            return null;
        }
        String token = parts[0].trim();
        return token.isEmpty() ? null : token;
    }

    private boolean isTrustedProxy(String remoteAddr) {
        return remoteAddr != null && trustedProxies.contains(normalizeIp(remoteAddr));
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
}
