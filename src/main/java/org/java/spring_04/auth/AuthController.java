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
        System.out.println("[" + LocalDateTime.now() + "] API /login userID=" + body.get("userID"));
        UserEntity user = authService.login(body.get("userID"), body.get("password"));

        if (user == null) {
            return Map.of("success", false, "message", "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        clearSession(request);
        HttpSession session = request.getSession(true);
        session.setAttribute("uid", user.getUid());
        session.setAttribute("nick", user.getNick());
        session.setAttribute("nickIconType", user.getNickIconType());
        session.setAttribute("memberDivision", user.getMemberDivision());

        return Map.of("success", true, "nick", user.getNick());
    }

    @PostMapping("/api/signup/request")
    public Map<String, Object> requestSignup(@RequestBody Map<String, String> body) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/signup/request userID=" + body.get("userID"));
        try {
            authService.requestSignupVerification(body);
            return Map.of("success", true, "message", "인증 메일을 발송했습니다.");
        } catch (Exception e) {
            return Map.of("success", false, "message", "이메일 인증 요청에 실패했습니다: " + e.getMessage());
        }
    }

    @PostMapping("/api/signup/verify")
    public Map<String, Object> verifySignup(@RequestBody Map<String, String> body) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/signup/verify userID=" + body.get("userID"));
        try {
            authService.confirmSignup(body);
            return Map.of("success", true, "message", "회원가입이 완료되었습니다.");
        } catch (Exception e) {
            return Map.of("success", false, "message", "이메일 인증 확인에 실패했습니다: " + e.getMessage());
        }
    }

    @PostMapping("/api/signup")
    public Map<String, Object> signup(@RequestBody Map<String, String> body) {
        return requestSignup(body);
    }

    @GetMapping("/api/signup/validate")
    public Map<String, Object> validateSignupField(@RequestParam("field") String field,
                                                   @RequestParam("value") String value) {
        try {
            return Map.of("success", true, "data", authService.validateSignupField(field, value));
        } catch (Exception e) {
            return Map.of(
                    "success", true,
                    "data", Map.of(
                            "field", field,
                            "valid", false,
                            "message", e.getMessage()
                    )
            );
        }
    }

    @GetMapping("/api/check-login")
    public Map<String, Object> checkLogin(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null || session.getAttribute("uid") == null) {
            return Map.of("loggedIn", false);
        }

        Object nick = session.getAttribute("nick");
        Object uid = session.getAttribute("uid");
        Object nickIconType = session.getAttribute("nickIconType");
        Object memberDivision = session.getAttribute("memberDivision");

        return Map.of(
                "loggedIn", true,
                "nick", nick == null ? "" : nick,
                "uid", uid == null ? "" : uid,
                "nickIconType", nickIconType == null ? "default" : nickIconType,
                "memberDivision", memberDivision == null ? "user" : memberDivision
        );
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request) {
        clearSession(request);
        return Map.of("message", "로그아웃이 완료되었습니다.");
    }

    private void clearSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
