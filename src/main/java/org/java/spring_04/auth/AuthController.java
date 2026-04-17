package org.java.spring_04.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;

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

        // 1. 기존 개별 저장 (기존 기능 유지용)
        session.setAttribute("uid", user.getUid());
        session.setAttribute("nick", user.getNick());

        // 2. 중요: BoardController에서 사용할 "user" 맵 객체 저장
        Map<String, Object> userMap = new HashMap<>();
        userMap.put("uid", user.getUid());
        userMap.put("nick", user.getNick());
        userMap.put("memberDivision", user.getMemberDivision()); // DB에서 가져온 admin 또는 user 값

        session.setAttribute("user", userMap);

        System.out.println(LocalDateTime.now() + " 로그인 성공: " + user.getNick() + " / 세션에 'user' 객체 생성됨");
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
        // 공통 메서드 호출
        clearSession(request);

        return Map.of("message", "로그아웃 완료");
    }

    /**
     * 세션 만료 전용 공통 메서드 (private)
     * 비밀번호 변경, 회원 탈퇴 등 세션 말소가 필요한 모든 곳에서 호출 가능
     */
    private void clearSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false); // 기존 세션 확인 (없으면 null)
        if (session != null) {
            Object uid = session.getAttribute("uid");
            Object nick = session.getAttribute("nick");

            System.out.println(LocalDateTime.now() + " 세션 만료 처리: " + nick + "(" + uid + ")");

            session.invalidate(); // 세션 즉시 파기
        }
    }
}