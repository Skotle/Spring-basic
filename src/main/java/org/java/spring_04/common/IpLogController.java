package org.java.spring_04.common;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
public class IpLogController {

    @PostMapping("/api/log-ip")
    public Map<String, Object> logIp(@RequestBody Map<String, Object> payload) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/log-ip");

        Object ip = payload.get("ip");
        Object userAgent = payload.get("userAgent");

        System.out.println("--------------------------------------------------");
        System.out.println("[" + LocalDateTime.now() + "] IP LOG RECEIVED");
        System.out.println("접속 IP: " + ip);
        System.out.println("브라우저: " + userAgent);
        System.out.println("--------------------------------------------------");

        return Map.of("success", true, "message", "IP 기록 완료");
    }
}
