package org.java.spring_04;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import java.util.Map;

@RestController
public class AuthController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /* ── 로그인 ── */
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body,
                                     HttpServletRequest request) {

        String uid          = body.get("userID");
        String rawPassword  = body.get("password");

        // 1. user 테이블에서 uid로 조회
        String sql = "SELECT uid, nick, nick_icon_type, password_hash, member_division " +
                "FROM user WHERE uid = ?";
        var rows = jdbcTemplate.queryForList(sql, uid);

        if (rows.isEmpty()) {
            return Map.of("success", false, "message", "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        var user         = rows.get(0);
        String storedHash = (String) user.get("password_hash");

        // 2. BCrypt 비밀번호 검증
        if (!BCrypt.checkpw(rawPassword, storedHash)) {
            return Map.of("success", false, "message", "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        // 3. 이전 세션 무효화 후 새 세션 발급 (session fixation 방지)
        request.getSession(false); // 기존 세션이 있으면 가져옴
        HttpSession session = request.getSession(true);
        session.invalidate();
        session = request.getSession(true);

        // 4. 세션에 사용자 정보 저장
        session.setAttribute("uid",            user.get("uid"));
        session.setAttribute("nick",           user.get("nick"));
        session.setAttribute("nickIconType",   user.get("nick_icon_type"));
        session.setAttribute("memberDivision", user.get("member_division"));

        return Map.of(
                "success", true,
                "uid",     user.get("uid"),
                "nick",    user.get("nick")
        );
    }

    /* ── 로그인 상태 확인 ── */
    @GetMapping("/api/check-login")
    public Map<String, Object> checkLogin(HttpServletRequest request) {

        HttpSession session = request.getSession(false); // 세션이 없으면 null

        if (session == null || session.getAttribute("uid") == null) {
            return Map.of("loggedIn", false);
        }

        return Map.of(
                "loggedIn",       true,
                "uid",            session.getAttribute("uid"),
                "nick",           session.getAttribute("nick"),
                "nickIconType",   String.valueOf(session.getAttribute("nickIconType")),
                "memberDivision", session.getAttribute("memberDivision")
        );
    }

    /* ── 로그아웃 ── */
    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request) {

        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate(); // 세션 즉시 파기
        }

        return Map.of("message", "로그아웃 완료");
    }
}