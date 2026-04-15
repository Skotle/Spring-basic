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
    public Map<String, Object> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String identifier = body.get("userID"); // 아이디 혹은 이메일
        String rawPassword = body.get("password");

        // [수정] uid 또는 email 컬럼에서 입력값을 찾음
        String sql = "SELECT uid, nick, nick_icon_type, password_hash, member_division " +
                "FROM user WHERE uid = ? OR email = ?";
        var rows = jdbcTemplate.queryForList(sql, identifier, identifier);

        if (rows.isEmpty()) {
            return Map.of("success", false, "message", "아이디/이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        var user = rows.get(0);
        String storedHash = (String) user.get("password_hash");

        if (!BCrypt.checkpw(rawPassword, storedHash)) {
            return Map.of("success", false, "message", "아이디/이메일 또는 비밀번호가 올바르지 않습니다.");
        }

        // 세션 보안 처리 및 정보 저장
        HttpSession oldSession = request.getSession(false);
        if (oldSession != null) oldSession.invalidate();
        HttpSession session = request.getSession(true);

        session.setAttribute("uid", user.get("uid"));
        session.setAttribute("nick", user.get("nick"));
        session.setAttribute("nickIconType", user.get("nick_icon_type"));
        session.setAttribute("memberDivision", user.get("member_division"));

        return Map.of("success", true, "uid", user.get("uid"), "nick", user.get("nick"));
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




    //가입 컨트롤러
    /* AuthController.java 내부에 추가 */
    @PostMapping("/api/signup")
    public Map<String, Object> signup(@RequestBody Map<String, String> body) {
        String uid = body.get("userID");
        String username = body.get("username");
        String password = body.get("password");
        String email = body.get("email");

        if (uid == null || username == null || password == null) {
            return Map.of("success", false, "message", "필수 정보를 모두 입력해주세요.");
        }

        try {
            String hashedPassword = BCrypt.hashpw(password, BCrypt.gensalt());
            String sql = "INSERT INTO user (uid, nick, password_hash, email, nick_icon_type, member_division) " +
                    "VALUES (?, ?, ?, ?, 'default', 'user')";

            // 이메일이 비어있으면 NULL로 저장
            jdbcTemplate.update(sql, uid, username, hashedPassword,
                    (email != null && !email.isEmpty()) ? email : null);

            return Map.of("success", true);
        } catch (Exception e) {
            if (e.getMessage().contains("UNIQUE")) {
                return Map.of("success", false, "message", "이미 사용 중인 아이디 또는 이메일입니다.");
            }
            return Map.of("success", false, "message", "서버 오류가 발생했습니다.");
        }
    }
}