package org.java.spring_04.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Pattern;

@Service
public class AuthService {
    private static final int VERIFICATION_EXPIRE_MINUTES = 10;
    private static final Pattern UID_PATTERN = Pattern.compile("^[a-zA-Z0-9_]{4,20}$");
    private static final Pattern NICK_PATTERN = Pattern.compile("^[\\p{L}\\p{N}_ ]{2,20}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern PASSWORD_UPPER = Pattern.compile("[A-Z]");
    private static final Pattern PASSWORD_LOWER = Pattern.compile("[a-z]");
    private static final Pattern PASSWORD_DIGIT = Pattern.compile("\\d");
    private static final Pattern PASSWORD_SPECIAL = Pattern.compile("[^A-Za-z0-9]");

    @Autowired
    private UserDAO userDAO;

    @Autowired
    private SignupVerificationRepository signupVerificationRepository;

    @Autowired
    private EmailVerificationService emailVerificationService;

    public UserEntity login(String identifier, String password) {
        return userDAO.findByIdentifier(identifier)
                .filter(user -> BCrypt.checkpw(password, user.getPasswordHash()))
                .orElse(null);
    }

    public Map<String, Object> validateSignupField(String field, String value) {
        String normalizedField = field == null ? "" : field.trim().toLowerCase();
        String normalizedValue = value == null ? "" : value.trim();
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("field", normalizedField);
        result.put("valid", true);
        result.put("message", "");

        switch (normalizedField) {
            case "uid" -> {
                if (!UID_PATTERN.matcher(normalizedValue).matches()) {
                    result.put("valid", false);
                    result.put("message", "아이디는 4-20자의 영문, 숫자, 밑줄만 사용할 수 있습니다.");
                } else if (userDAO.existsByUid(normalizedValue)) {
                    result.put("valid", false);
                    result.put("message", "이미 사용 중인 아이디입니다.");
                }
            }
            case "nick" -> {
                if (!NICK_PATTERN.matcher(normalizedValue).matches()) {
                    result.put("valid", false);
                    result.put("message", "닉네임은 2-20자의 문자, 숫자, 밑줄, 공백만 사용할 수 있습니다.");
                } else if (userDAO.existsByNick(normalizedValue)) {
                    result.put("valid", false);
                    result.put("message", "이미 사용 중인 닉네임입니다.");
                }
            }
            case "email" -> {
                if (!EMAIL_PATTERN.matcher(normalizedValue).matches()) {
                    result.put("valid", false);
                    result.put("message", "올바른 이메일 주소를 입력해 주세요.");
                } else if (userDAO.existsByEmail(normalizedValue)) {
                    result.put("valid", false);
                    result.put("message", "이미 가입된 이메일입니다.");
                }
            }
            case "password" -> {
                String passwordMessage = validatePasswordPolicy(normalizedValue);
                if (passwordMessage != null) {
                    result.put("valid", false);
                    result.put("message", passwordMessage);
                }
            }
            default -> {
                result.put("valid", false);
                result.put("message", "지원하지 않는 검증 항목입니다.");
            }
        }

        return result;
    }

    public void requestSignupVerification(Map<String, String> data) {
        signupVerificationRepository.deleteExpired();

        String uid = required(data.get("userID"), "아이디를 입력해 주세요.");
        String nick = required(data.get("username"), "닉네임을 입력해 주세요.");
        String email = required(data.get("email"), "이메일을 입력해 주세요.");
        String password = required(data.get("password"), "비밀번호를 입력해 주세요.");

        ensureFieldValid("uid", uid);
        ensureFieldValid("nick", nick);
        ensureFieldValid("email", email);
        ensureFieldValid("password", password);

        String code = generateVerificationCode();
        String passwordHash = BCrypt.hashpw(password, BCrypt.gensalt());
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(VERIFICATION_EXPIRE_MINUTES);

        signupVerificationRepository.upsertPendingSignup(uid, nick, email, passwordHash, code, expiresAt);
        emailVerificationService.sendSignupCode(email, uid, code);
    }

    public void confirmSignup(Map<String, String> data) {
        signupVerificationRepository.deleteExpired();

        String uid = required(data.get("userID"), "아이디를 입력해 주세요.");
        String email = required(data.get("email"), "이메일을 입력해 주세요.");
        String code = required(data.get("code"), "인증 코드를 입력해 주세요.");

        Map<String, Object> pending = signupVerificationRepository.findByUidAndEmail(uid, email);
        if (pending == null) {
            throw new RuntimeException("대기 중인 이메일 인증 요청이 없습니다.");
        }

        String savedCode = String.valueOf(pending.get("verification_code"));
        LocalDateTime expiresAt = toLocalDateTime(pending.get("expires_at"));
        if (expiresAt == null || expiresAt.isBefore(LocalDateTime.now())) {
            signupVerificationRepository.deleteByUid(uid);
            throw new RuntimeException("인증 코드가 만료되었습니다. 다시 요청해 주세요.");
        }
        if (!savedCode.equals(code.trim())) {
            throw new RuntimeException("인증 코드가 올바르지 않습니다.");
        }
        if (userDAO.existsByUid(uid)) {
            signupVerificationRepository.deleteByUid(uid);
            throw new RuntimeException("이미 사용 중인 아이디입니다.");
        }
        if (userDAO.existsByEmail(email)) {
            signupVerificationRepository.deleteByUid(uid);
            throw new RuntimeException("이미 가입된 이메일입니다.");
        }

        UserEntity user = new UserEntity();
        user.setUid(uid);
        user.setNick(String.valueOf(pending.get("nick")));
        user.setPasswordHash(String.valueOf(pending.get("password_hash")));
        user.setEmail(String.valueOf(pending.get("email")));
        user.setNickIconType("default");
        user.setMemberDivision("user");

        userDAO.save(user);
        signupVerificationRepository.deleteByUid(uid);
    }

    private void ensureFieldValid(String field, String value) {
        Map<String, Object> result = validateSignupField(field, value);
        if (!Boolean.TRUE.equals(result.get("valid"))) {
            throw new RuntimeException(String.valueOf(result.get("message")));
        }
    }

    private String validatePasswordPolicy(String password) {
        if (password == null || password.isBlank()) {
            return "비밀번호를 입력해 주세요.";
        }
        if (password.length() < 8 || password.length() > 64) {
            return "비밀번호는 8자 이상 64자 이하여야 합니다.";
        }
        if (!PASSWORD_UPPER.matcher(password).find()) {
            return "비밀번호에 영문 대문자를 1자 이상 포함해 주세요.";
        }
        if (!PASSWORD_LOWER.matcher(password).find()) {
            return "비밀번호에 영문 소문자를 1자 이상 포함해 주세요.";
        }
        if (!PASSWORD_DIGIT.matcher(password).find()) {
            return "비밀번호에 숫자를 1자 이상 포함해 주세요.";
        }
        if (!PASSWORD_SPECIAL.matcher(password).find()) {
            return "비밀번호에 특수문자를 1자 이상 포함해 주세요.";
        }
        return null;
    }

    private String generateVerificationCode() {
        int value = ThreadLocalRandom.current().nextInt(100000, 1000000);
        return String.valueOf(value);
    }

    private String required(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new RuntimeException(message);
        }
        return value.trim();
    }

    private LocalDateTime toLocalDateTime(Object value) {
        if (value instanceof LocalDateTime localDateTime) {
            return localDateTime;
        }
        if (value instanceof java.sql.Timestamp timestamp) {
            return timestamp.toLocalDateTime();
        }
        return null;
    }
}
