package org.java.spring_04.common;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
public class IpLogController {
    private final RequestIpResolver requestIpResolver;

    public IpLogController(RequestIpResolver requestIpResolver) {
        this.requestIpResolver = requestIpResolver;
    }

    @PostMapping("/api/log-ip")
    public Map<String, Object> logIp(@RequestBody(required = false) Map<String, Object> payload,
                                     HttpServletRequest request) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/log-ip");

        String ip = requestIpResolver.resolve(request);
        Object userAgent = payload == null ? request.getHeader("User-Agent") : payload.getOrDefault("userAgent", request.getHeader("User-Agent"));

        System.out.println("--------------------------------------------------");
        System.out.println("[" + LocalDateTime.now() + "] IP LOG RECEIVED");
        System.out.println("접속 IP: " + ip);
        System.out.println("브라우저: " + userAgent);
        System.out.println("--------------------------------------------------");

        return Map.of("success", true, "message", "IP 기록 완료", "ip", ip);
    }
}
