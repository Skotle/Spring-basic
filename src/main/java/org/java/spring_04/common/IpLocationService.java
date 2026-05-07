package org.java.spring_04.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class IpLocationService {
    private static final Logger log = LoggerFactory.getLogger(IpLocationService.class);
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private static final String UNKNOWN = "unknown";

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofMillis(900))
            .build();

    private final Environment environment;
    private final ObjectMapper objectMapper;

    public IpLocationService(Environment environment, ObjectMapper objectMapper) {
        this.environment = environment;
        this.objectMapper = objectMapper;
    }

    public String resolveLabel(String ip) {
        if (!enabled() || isPrivateOrLocal(ip)) {
            return UNKNOWN;
        }

        long now = System.currentTimeMillis();
        CacheEntry cached = cache.get(ip);
        if (cached != null && now < cached.expiresAt()) {
            return cached.label();
        }

        String label = lookup(ip);
        cache.put(ip, new CacheEntry(label, now + cacheTtlMillis()));
        if (cache.size() > 4096) {
            cache.entrySet().removeIf(entry -> now >= entry.getValue().expiresAt());
        }
        return label;
    }

    private String lookup(String ip) {
        try {
            String endpoint = endpointTemplate().replace("{ip}", URI.create("http://" + ip).getHost());
            HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint))
                    .timeout(Duration.ofMillis(timeoutMillis()))
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                return UNKNOWN;
            }
            Map<String, Object> payload = objectMapper.readValue(response.body().getBytes(), MAP_TYPE);
            Object success = payload.get("success");
            if (success instanceof Boolean ok && !ok) {
                return UNKNOWN;
            }
            return joinLocation(text(payload.get("city")), text(payload.get("region")), text(payload.get("country")));
        } catch (Exception e) {
            log.debug("IP_LOCATION_LOOKUP_FAILED ip={} message={}", ip, e.getMessage());
            return UNKNOWN;
        }
    }

    private String joinLocation(String city, String region, String country) {
        StringBuilder builder = new StringBuilder();
        appendPart(builder, city);
        appendPart(builder, region);
        appendPart(builder, country);
        return builder.isEmpty() ? UNKNOWN : builder.toString();
    }

    private void appendPart(StringBuilder builder, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        if (!builder.isEmpty()) {
            builder.append("/");
        }
        builder.append(value.replaceAll("[\\r\\n]", "").trim());
    }

    private String text(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private boolean enabled() {
        return Boolean.parseBoolean(environment.getProperty("app.security.ip-location.enabled", "true"));
    }

    private String endpointTemplate() {
        return environment.getProperty(
                "app.security.ip-location.endpoint",
                "https://ipwho.is/{ip}?fields=success,country,region,city,ip"
        );
    }

    private int timeoutMillis() {
        return parseInt(environment.getProperty("app.security.ip-location.timeout-ms"), 1200);
    }

    private long cacheTtlMillis() {
        return Duration.ofHours(parseInt(environment.getProperty("app.security.ip-location.cache-hours"), 6)).toMillis();
    }

    private int parseInt(String value, int fallback) {
        try {
            return value == null || value.isBlank() ? fallback : Integer.parseInt(value.trim());
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private boolean isPrivateOrLocal(String ip) {
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            return true;
        }
        String value = ip.trim().toLowerCase();
        if ("127.0.0.1".equals(value) || "localhost".equals(value) || "::1".equals(value)) {
            return true;
        }
        if (value.startsWith("10.") || value.startsWith("192.168.")) {
            return true;
        }
        if (value.startsWith("172.")) {
            String[] parts = value.split("\\.");
            if (parts.length > 1) {
                int second = parseInt(parts[1], -1);
                return second >= 16 && second <= 31;
            }
        }
        return value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
    }

    private record CacheEntry(String label, long expiresAt) {
    }
}
