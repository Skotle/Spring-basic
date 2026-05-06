package org.java.spring_04.auth;

import jakarta.annotation.PostConstruct;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.java.spring_04.common.AdminAccessService;
import org.java.spring_04.common.RequestIpResolver;
import org.java.spring_04.common.SecurityRateLimiter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Map;

@RestController
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private RequestIpResolver requestIpResolver;

    @Autowired
    private SecurityRateLimiter rateLimiter;

    @Autowired
    private AdminAccessService adminAccessService;

    @Autowired
    private Environment environment;

    @PostConstruct
    public void printAdminLoginCodeStatus() {
        String configuredAdminLoginCode = configuredAdminLoginCode();
        System.out.println("[" + LocalDateTime.now() + "] ADMIN_LOGIN_CODE set="
                + !configuredAdminLoginCode.isBlank()
                + " hashPrefix=" + adminCodeHashPrefix(configuredAdminLoginCode));
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String identifier = body.get("userID") == null ? "" : body.get("userID").trim();
        String ip = requestIpResolver.resolve(request);
        System.out.println("[" + LocalDateTime.now() + "] API /login userID=" + identifier + " ip=" + ip);
        if (!rateLimiter.allow("login", ip + ":" + identifier, 8, Duration.ofMinutes(10))) {
            return Map.of("success", false, "message", "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
        UserEntity user = authService.login(identifier, body.get("password"));

        if (user == null) {
            return Map.of("success", false, "message", "아이디 또는 비밀번호가 올바르지 않습니다.");
        }

        if (adminAccessService.isAdminDivision(user.getMemberDivision())) {
            return Map.of("success", false, "message", "관리자 계정은 관리자 전용 로그인으로만 로그인할 수 있습니다.");
        }

        clearSession(request);
        HttpSession session = request.getSession(true);
        request.changeSessionId();
        session.setAttribute("uid", user.getUid());
        session.setAttribute("nick", user.getNick());
        session.setAttribute("nickType", user.getNickType());
        session.setAttribute("nickIconType", user.getNickIconType());
        session.setAttribute("memberDivision", user.getMemberDivision());

        return Map.of(
                "success", true,
                "nick", user.getNick(),
                "uid", user.getUid(),
                "nickType", user.getNickType() == null ? "variable" : user.getNickType(),
                "nickIconType", user.getNickIconType() == null ? "default" : user.getNickIconType(),
                "memberDivision", user.getMemberDivision() == null ? "user" : user.getMemberDivision()
        );
    }

    @PostMapping("/admin/login")
    public Map<String, Object> adminLogin(@RequestBody Map<String, String> body, HttpServletRequest request) {
        String identifier = body.get("userID") == null ? "" : body.get("userID").trim();
        String ip = requestIpResolver.resolve(request);
        String configuredAdminLoginCode = configuredAdminLoginCode();
        System.out.println("[" + LocalDateTime.now() + "] API /admin/login userID=" + identifier
                + " ip=" + ip
                + " adminCodeSet=" + !configuredAdminLoginCode.isBlank()
                + " adminHashPrefix=" + adminCodeHashPrefix(configuredAdminLoginCode));

        if (!rateLimiter.allow("admin-login", ip + ":" + identifier, 5, Duration.ofMinutes(15))) {
            return Map.of("success", false, "message", "관리자 로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
        if (configuredAdminLoginCode.isBlank()) {
            return Map.of("success", false, "message", "관리자 전용 로그인 코드가 서버에 설정되지 않았습니다.");
        }
        if (!constantTimeEquals(configuredAdminLoginCode, body.get("adminCode"))) {
            return Map.of("success", false, "message", "관리자 전용 로그인 코드가 올바르지 않습니다.");
        }

        UserEntity user = authService.login(identifier, body.get("password"));
        if (user == null) {
            return Map.of("success", false, "message", "아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        if (!adminAccessService.isAdminDivision(user.getMemberDivision())) {
            return Map.of("success", false, "message", "관리자 권한 계정만 관리자 전용 로그인을 사용할 수 있습니다.");
        }

        clearSession(request);
        HttpSession session = request.getSession(true);
        request.changeSessionId();
        session.setAttribute("uid", user.getUid());
        session.setAttribute("nick", user.getNick());
        session.setAttribute("nickType", user.getNickType());
        session.setAttribute("nickIconType", user.getNickIconType());
        session.setAttribute("memberDivision", user.getMemberDivision());
        session.setAttribute("adminAuthenticated", true);

        return Map.of(
                "success", true,
                "nick", user.getNick(),
                "uid", user.getUid(),
                "nickType", user.getNickType() == null ? "variable" : user.getNickType(),
                "nickIconType", user.getNickIconType() == null ? "default" : user.getNickIconType(),
                "memberDivision", user.getMemberDivision() == null ? "user" : user.getMemberDivision()
        );
    }

    private boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) {
            return false;
        }
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                actual.trim().getBytes(StandardCharsets.UTF_8)
        );
    }

    private String configuredAdminLoginCode() {
        String environmentPropertyCode = firstPresent(
                environment.getProperty("app.security.admin-login-code"),
                environment.getProperty("APP_ADMIN_LOGIN_CODE"),
                environment.getProperty("APP_SECURITY_ADMIN_LOGIN_CODE"),
                environment.getProperty("ADMIN_LOGIN_CODE")
        );
        if (!environmentPropertyCode.isBlank()) {
            return environmentPropertyCode;
        }
        String systemPropertyCode = System.getProperty("app.security.admin-login-code", "");
        if (systemPropertyCode != null && !systemPropertyCode.isBlank()) {
            return systemPropertyCode.trim();
        }
        return firstPresent(
                System.getenv("APP_ADMIN_LOGIN_CODE"),
                System.getenv("APP_SECURITY_ADMIN_LOGIN_CODE"),
                System.getenv("ADMIN_LOGIN_CODE")
        );
    }

    private String firstPresent(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private String adminCodeHashPrefix(String value) {
        if (value == null || value.isBlank()) {
            return "none";
        }
        return sha256Hex(value.trim()).substring(0, 12);
    }

    private String sha256Hex(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder builder = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                builder.append(String.format("%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            return "hash-error";
        }
    }

    @PostMapping("/api/signup/request")
    public Map<String, Object> requestSignup(@RequestBody Map<String, String> body, HttpServletRequest request) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/signup/request userID=" + body.get("userID"));
        String key = requestIpResolver.resolve(request) + ":" + String.valueOf(body.getOrDefault("email", ""));
        if (!rateLimiter.allow("signup-request", key, 5, Duration.ofHours(1))) {
            return Map.of("success", false, "message", "인증 메일 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
        try {
            authService.requestSignupVerification(body);
            return Map.of("success", true, "message", "인증 메일을 발송했습니다.");
        } catch (Exception e) {
            return Map.of("success", false, "message", "이메일 인증 요청에 실패했습니다: " + e.getMessage());
        }
    }

    @PostMapping("/api/signup/verify")
    public Map<String, Object> verifySignup(@RequestBody Map<String, String> body, HttpServletRequest request) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/signup/verify userID=" + body.get("userID"));
        String key = requestIpResolver.resolve(request) + ":" + String.valueOf(body.getOrDefault("userID", ""));
        if (!rateLimiter.allow("signup-verify", key, 10, Duration.ofMinutes(30))) {
            return Map.of("success", false, "message", "인증 확인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.");
        }
        try {
            authService.confirmSignup(body);
            return Map.of("success", true, "message", "회원가입이 완료되었습니다.");
        } catch (Exception e) {
            return Map.of("success", false, "message", "이메일 인증 확인에 실패했습니다: " + e.getMessage());
        }
    }

    @PostMapping("/api/signup")
    public Map<String, Object> signup(@RequestBody Map<String, String> body, HttpServletRequest request) {
        return requestSignup(body, request);
    }

    @GetMapping("/api/signup/validate")
    public Map<String, Object> validateSignupField(@RequestParam("field") String field,
                                                   @RequestParam("value") String value,
                                                   @RequestParam(value = "nickType", required = false) String nickType) {
        try {
            return Map.of("success", true, "data", authService.validateSignupField(field, value, nickType));
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
        Object nickType = session.getAttribute("nickType");
        Object nickIconType = session.getAttribute("nickIconType");
        Object memberDivision = session.getAttribute("memberDivision");

        return Map.of(
                "loggedIn", true,
                "nick", nick == null ? "" : nick,
                "uid", uid == null ? "" : uid,
                "nickType", nickType == null ? "variable" : nickType,
                "nickIconType", nickIconType == null ? "default" : nickIconType,
                "memberDivision", memberDivision == null ? "user" : memberDivision
        );
    }

    @PostMapping("/logout")
    public Map<String, String> logout(HttpServletRequest request, HttpServletResponse response) throws IOException {
        clearSession(request);
        if (!isAjax(request)) {
            response.sendRedirect("/");
            return null;
        }
        return Map.of("message", "로그아웃이 완료되었습니다.");
    }

    @GetMapping("/logout")
    public void logoutByNavigation(HttpServletRequest request, HttpServletResponse response) throws IOException {
        clearSession(request);
        response.sendRedirect("/");
    }

    private boolean isAjax(HttpServletRequest request) {
        return "XMLHttpRequest".equals(request.getHeader("X-Requested-With"));
    }

    private void clearSession(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
    }
}
