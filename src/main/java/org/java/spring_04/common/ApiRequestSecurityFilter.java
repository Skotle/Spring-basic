package org.java.spring_04.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Map;
import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 30)
public class ApiRequestSecurityFilter extends OncePerRequestFilter {
    private static final Duration MAX_CLOCK_SKEW = Duration.ofMinutes(10);
    private static final Pattern REQUEST_ID = Pattern.compile("^[A-Za-z0-9._:-]{12,100}$");
    private static final Pattern SHA_256_HEX = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    public ApiRequestSecurityFilter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!requiresValidation(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (isMultipart(request)) {
            try {
                validateHeaderEnvelope(request);
            } catch (IllegalArgumentException e) {
                reject(response, e.getMessage());
                return;
            }
            filterChain.doFilter(request, response);
            return;
        }

        byte[] body = request.getInputStream().readAllBytes();
        CachedBodyHttpServletRequest wrapped = new CachedBodyHttpServletRequest(request, body);

        try {
            validateSecurityEnvelope(wrapped, body);
        } catch (IllegalArgumentException e) {
            reject(response, e.getMessage());
            return;
        }

        filterChain.doFilter(wrapped, response);
    }

    private boolean requiresValidation(HttpServletRequest request) {
        if (!isUnsafeMethod(request.getMethod())) {
            return false;
        }
        String uri = request.getRequestURI();
        return uri.startsWith("/api/")
                || "/login".equals(uri);
    }

    private boolean isUnsafeMethod(String method) {
        return "POST".equalsIgnoreCase(method)
                || "PUT".equalsIgnoreCase(method)
                || "PATCH".equalsIgnoreCase(method)
                || "DELETE".equalsIgnoreCase(method);
    }

    private boolean isMultipart(HttpServletRequest request) {
        String contentType = request.getContentType();
        return contentType != null && contentType.toLowerCase().startsWith("multipart/");
    }

    private void validateSecurityEnvelope(HttpServletRequest request, byte[] body) {
        SecurityEnvelope envelope = validateHeaderEnvelope(request);

        String payloadHash = requireHeader(request, "X-Payload-Hash");
        if (!SHA_256_HEX.matcher(payloadHash).matches() || !payloadHash.equalsIgnoreCase(sha256Hex(body))) {
            throw new IllegalArgumentException("Invalid payload hash.");
        }

        Map<String, Object> payload = parsePayload(body);
        requirePayloadValue(payload, "__security_request_id", envelope.requestId());
        requirePayloadValue(payload, "__security_timestamp", String.valueOf(envelope.timestamp()));
        requirePayloadValue(payload, "__security_path", envelope.clientPath());
        requirePayloadValue(payload, "__security_method", request.getMethod().toUpperCase());
        requirePayloadValue(payload, "__security_origin", envelope.clientOrigin());
        requireOptionalPayloadValue(payload, "__security_timezone", envelope.timezone());
        requireOptionalPayloadValue(payload, "__security_language", envelope.language());
    }

    private SecurityEnvelope validateHeaderEnvelope(HttpServletRequest request) {
        String requestedWith = requireHeader(request, "X-Requested-With");
        if (!"XMLHttpRequest".equals(requestedWith)) {
            throw new IllegalArgumentException("Invalid request marker.");
        }

        String requestId = requireHeader(request, "X-Request-Id");
        if (!REQUEST_ID.matcher(requestId).matches()) {
            throw new IllegalArgumentException("Invalid request id.");
        }

        long timestamp = parseTimestamp(requireHeader(request, "X-Request-Timestamp"));
        long now = System.currentTimeMillis();
        if (Math.abs(now - timestamp) > MAX_CLOCK_SKEW.toMillis()) {
            throw new IllegalArgumentException("Expired request timestamp.");
        }

        String clientPath = requireHeader(request, "X-Client-Path");
        if (clientPath.length() > 1024 || !clientPath.startsWith("/")) {
            throw new IllegalArgumentException("Invalid client path.");
        }

        String clientOrigin = requireHeader(request, "X-Client-Origin");
        if (!sameOrigin(request, clientOrigin)) {
            throw new IllegalArgumentException("Invalid client origin.");
        }

        String timezone = optionalHeader(request, "X-Client-Timezone", 80);
        String language = optionalHeader(request, "X-Client-Language", 40);

        return new SecurityEnvelope(requestId, timestamp, clientPath, clientOrigin, timezone, language);
    }

    private String requireHeader(HttpServletRequest request, String name) {
        String value = request.getHeader(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing security header: " + name);
        }
        return value.trim();
    }

    private String optionalHeader(HttpServletRequest request, String name, int maxLength) {
        String value = request.getHeader(name);
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() > maxLength || trimmed.contains("\r") || trimmed.contains("\n")) {
            throw new IllegalArgumentException("Invalid security header: " + name);
        }
        return trimmed;
    }

    private long parseTimestamp(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid request timestamp.");
        }
    }

    private Map<String, Object> parsePayload(byte[] body) {
        if (body.length == 0) {
            throw new IllegalArgumentException("Missing request payload.");
        }
        try {
            return objectMapper.readValue(body, MAP_TYPE);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid request payload.");
        }
    }

    private void requirePayloadValue(Map<String, Object> payload, String key, String expected) {
        Object value = payload.get(key);
        if (!(value instanceof String text) || !expected.equals(text)) {
            throw new IllegalArgumentException("Invalid security payload.");
        }
    }

    private void requireOptionalPayloadValue(Map<String, Object> payload, String key, String expected) {
        if (expected == null || expected.isBlank()) {
            return;
        }
        requirePayloadValue(payload, key, expected);
    }

    private boolean sameOrigin(HttpServletRequest request, String source) {
        try {
            URI uri = URI.create(source);
            int requestPort = normalizePort(request.getScheme(), request.getServerPort());
            int sourcePort = normalizePort(uri.getScheme(), uri.getPort());
            return request.getScheme().equalsIgnoreCase(uri.getScheme())
                    && request.getServerName().equalsIgnoreCase(uri.getHost())
                    && requestPort == sourcePort;
        } catch (Exception e) {
            return false;
        }
    }

    private int normalizePort(String scheme, int port) {
        if (port > 0) {
            return port;
        }
        return "https".equalsIgnoreCase(scheme) ? 443 : 80;
    }

    private String sha256Hex(byte[] body) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(body));
        } catch (Exception e) {
            throw new IllegalArgumentException("Unable to validate payload.");
        }
    }

    private void reject(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        objectMapper.writeValue(response.getWriter(), Map.of(
                "success", false,
                "message", message
        ));
    }

    private record SecurityEnvelope(String requestId, long timestamp, String clientPath, String clientOrigin,
                                    String timezone, String language) {
    }
}
