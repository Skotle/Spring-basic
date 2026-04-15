package org.java.spring_04;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Map;
import java.util.UUID;

@RestController
public class AuthController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body,
                                     HttpServletResponse response) {

        String userID = body.get("userID");
        String password = body.get("password");

        // 1. 사용자 조회

        String sql = "SELECT * FROM users WHERE userID = ?";
        var users = jdbcTemplate.queryForList(sql, userID);

        if (users.isEmpty()) {
            return Map.of("success", false, "message", "로그인 실패");
        }

        var user = users.get(0);
        String passwordHash = (String) user.get("passwordHash");

        // 2. 비밀번호 검증 (bcrypt)
        if (!BCrypt.checkpw(password, passwordHash)) {
            return Map.of("success", false, "message", "로그인 실패");
        }

        // 3. 토큰 생성
        String accessToken = UUID.randomUUID().toString();
        String refreshToken = UUID.randomUUID().toString();

        // 4. DB 저장
        jdbcTemplate.update(
                "UPDATE users SET accessToken = ?, refreshToken = ? WHERE userID = ?",
                accessToken, refreshToken, userID
        );

        // 5. 쿠키 설정
        Cookie accessCookie = new Cookie("accessToken", accessToken);
        accessCookie.setHttpOnly(true);
        accessCookie.setPath("/");
        accessCookie.setMaxAge(60 * 60);

        Cookie refreshCookie = new Cookie("refreshToken", refreshToken);
        refreshCookie.setHttpOnly(true);
        refreshCookie.setPath("/");
        refreshCookie.setMaxAge(7 * 24 * 60 * 60);

        response.addCookie(accessCookie);
        response.addCookie(refreshCookie);

        return Map.of(
                "success", true,
                "username", user.get("username"),
                "userID", user.get("userID")
        );
    }

    @GetMapping("/api/check-login")
    public Map<String, Object> checkLogin(@CookieValue(value = "accessToken", required = false) String token) {

        if (token == null) {
            return Map.of("loggedIn", false);
        }

        var users = jdbcTemplate.queryForList(
                "SELECT * FROM users WHERE accessToken = ?",
                token
        );

        if (users.isEmpty()) {
            return Map.of("loggedIn", false);
        }

        var user = users.get(0);

        return Map.of(
                "loggedIn", true,
                "username", user.get("username"),
                "ID", user.get("userID")
        );
    }
    @PostMapping("/logout")
    public Map<String, String> logout(
            @CookieValue(value = "accessToken", required = false) String token,
            HttpServletResponse response
    ) {

        if (token != null) {
            jdbcTemplate.update(
                    "UPDATE users SET accessToken = NULL, refreshToken = NULL WHERE accessToken = ?",
                    token
            );
        }

        Cookie access = new Cookie("accessToken", null);
        access.setMaxAge(0);
        access.setPath("/");

        Cookie refresh = new Cookie("refreshToken", null);
        refresh.setMaxAge(0);
        refresh.setPath("/");

        response.addCookie(access);
        response.addCookie(refresh);

        return Map.of("message", "로그아웃 완료");
    }
}