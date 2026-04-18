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

        HttpSession session = request.getSession(true);
        session.setAttribute("uid", user.getUid());
        session.setAttribute("nick", user.getNick());
        session.setAttribute("nickIconType", user.getNickIconType());
        session.setAttribute("memberDivision", user.getMemberDivision());

        System.out.println(LocalDateTime.now() + " 로그인 " + user.getNick() + "(" + user.getUid() + ")");
        return Map.of("success", true, "nick", user.getNick());
    }

    @PostMapping("/api/signup")
    public Map<String, Object> signup(@RequestBody Map<String, String> body) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/signup userID=" + body.get("userID"));
        try {
            authService.signup(body);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", "회원가입에 실패했습니다: " + e.getMessage());
        }
    }

    @GetMapping("/api/check-login")
    public Map<String, Object> checkLogin(HttpServletRequest request) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/check-login");
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
        System.out.println("[" + LocalDateTime.now() + "] API /logout");
        clearSession(request);
        return Map.of("message", "로그아웃이 완료되었습니다.");
    }

    private void clearSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object uid = session.getAttribute("uid");
            Object nick = session.getAttribute("nick");

            System.out.println(LocalDateTime.now() + " 세션 만료 처리: " + nick + "(" + uid + ")");
            session.invalidate();
        }
    }
}
