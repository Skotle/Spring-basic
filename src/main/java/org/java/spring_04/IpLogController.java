package org.java.spring_04;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import java.time.LocalDateTime;
import java.util.Map;

@RestController // JSON 응답을 위해 RestController 사용
public class IpLogController {

    @PostMapping("/api/log-ip")
    public Map<String, Object> logIp(@RequestBody Map<String, Object> payload) {
        // 클라이언트가 보낸 데이터 추출
        Object ip = payload.get("ip");
        Object userAgent = payload.get("userAgent");

        // 서버 콘솔에 시간과 함께 출력
        System.out.println("--------------------------------------------------");
        System.out.println("[" + LocalDateTime.now() + "] IP LOG RECEIVED");
        System.out.println("접속 IP: " + ip);
        System.out.println("브라우저: " + userAgent);
        System.out.println("--------------------------------------------------");

        // 클라이언트에 성공 응답 전송
        return Map.of("success", true, "message", "IP 기록 완료");
    }
}