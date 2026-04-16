package org.java.spring_04.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
public class AuthController {

    @Autowired
    private AuthService authService;

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        UserEntity user = authService.login(body.get("userID"), body.get("password"));

        if (user == null) {
            return Map.of("success", false, "message", "인증 실패");
        }

        HttpSession session = request.getSession(true);
        session.setAttribute("uid", user.getUid());
        session.setAttribute("nick", user.getNick());
        // ... 세션 정보 저장
        System.out.println(LocalDateTime.now()+" 로그인: "+user.getNick()+"("+user.getUid()+")");
        return Map.of("success", true, "nick", user.getNick());
    }

    @PostMapping("/api/signup")
    public Map<String, Object> signup(@RequestBody Map<String, String> body) {
        try {
            authService.signup(body);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", "가입 실패: " + e.getMessage());
        }
    }
    @GetMapping("/api/check-login") // 브라우저가 요청하는 경로와 일치
    public Map<String, Object> checkLogin(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("uid") == null) {
            return Map.of("loggedIn", false);
        }
        return Map.of(
                "loggedIn", true,
                "nick", session.getAttribute("nick"),
                "uid", session.getAttribute("uid")
        );
    }
    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request) {

        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate(); // 세션 즉시 파기
        }

        return Map.of("message", "로그아웃 완료");
    }
}