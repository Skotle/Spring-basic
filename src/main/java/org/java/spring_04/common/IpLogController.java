package org.java.spring_04.common;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class IpLogController {
    private static final Logger log = LoggerFactory.getLogger(IpLogController.class);

    private final RequestIpResolver requestIpResolver;

    public IpLogController(RequestIpResolver requestIpResolver) {
        this.requestIpResolver = requestIpResolver;
    }

    @PostMapping("/api/log-ip")
    public Map<String, Object> logIp(@RequestBody(required = false) Map<String, Object> payload,
                                     HttpServletRequest request) {
        String ip = requestIpResolver.resolve(request);
        Object userAgent = payload == null
                ? request.getHeader("User-Agent")
                : payload.getOrDefault("userAgent", request.getHeader("User-Agent"));

        log.info("Client activity logged. ip={} userAgent={}", maskIp(ip), abbreviate(userAgent, 160));
        return Map.of("success", true, "message", "OK");
    }

    private String maskIp(String ip) {
        if (ip == null || ip.isBlank()) {
            return "";
        }
        if (ip.contains(":")) {
            int lastColon = ip.lastIndexOf(':');
            return lastColon <= 0 ? "****" : ip.substring(0, lastColon) + ":****";
        }
        String[] parts = ip.split("\\.");
        if (parts.length == 4) {
            return parts[0] + "." + parts[1] + "." + parts[2] + ".***";
        }
        return "****";
    }

    private String abbreviate(Object value, int maxLength) {
        String text = value == null ? "" : String.valueOf(value).replaceAll("[\\r\\n\\t]+", " ").trim();
        if (text.length() <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + "...";
    }
}
