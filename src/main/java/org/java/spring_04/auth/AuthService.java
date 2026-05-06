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
    private static final Pattern UID_PATTERN = Pattern.compile("^[a-z][a-z0-9_]{3,19}$");
    private static final Pattern NICK_PATTERN = Pattern.compile("^[\\p{L}\\p{N}_ ]{1,20}$");
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
        if (identifier == null || identifier.isBlank() || password == null || password.isBlank()) {
            return null;
        }
        return userDAO.findByIdentifier(identifier)
                .filter(user -> BCrypt.checkpw(password, user.getPasswordHash()))
                .orElse(null);
    }

    public Map<String, Object> validateSignupField(String field, String value, String nickType) {
        String normalizedField = field == null ? "" : field.trim().toLowerCase();
        String normalizedValue = value == null ? "" : value.trim();
        String normalizedNickType = normalizeNickType(nickType);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("field", normalizedField);
        result.put("valid", true);
        result.put("message", "");

        switch (normalizedField) {
            case "uid" -> {
                if (!UID_PATTERN.matcher(normalizedValue).matches()) {
                    result.put("valid", false);
                    result.put("message", "\uc544\uc774\ub514\ub294 4~20\uc790\uc758 \uc601\ubb38 \uc18c\ubb38\uc790, \uc22b\uc790, \ubc11\uc904\ub9cc \uc0ac\uc6a9\ud560 \uc218 \uc788\uc73c\uba70 \uccab \uae00\uc790\ub294 \uc601\ubb38 \uc18c\ubb38\uc790\uc5ec\uc57c \ud569\ub2c8\ub2e4.");
                } else if (userDAO.existsByUid(normalizedValue)) {
                    result.put("valid", false);
                    result.put("message", "\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 \uc544\uc774\ub514\uc785\ub2c8\ub2e4.");
                }
            }
            case "nick" -> {
                if (!NICK_PATTERN.matcher(normalizedValue).matches()) {
                    result.put("valid", false);
                    result.put("message", "\ub2c9\ub124\uc784\uc740 1~20\uc790\uc758 \ubb38\uc790, \uc22b\uc790, \ubc11\uc904, \uacf5\ubc31\ub9cc \uc0ac\uc6a9\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.");
                } else if ("fixed".equals(normalizedNickType) && userDAO.existsByFixedNick(normalizedValue)) {
                    result.put("valid", false);
                    result.put("message", "\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 \uace0\uc815 \ub2c9\ub124\uc784\uc785\ub2c8\ub2e4.");
                }
            }
            case "email" -> {
                if (!EMAIL_PATTERN.matcher(normalizedValue).matches()) {
                    result.put("valid", false);
                    result.put("message", "\uc62c\ubc14\ub978 \uc774\uba54\uc77c \uc8fc\uc18c\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
                } else if (userDAO.existsByEmail(normalizedValue)) {
                    result.put("valid", false);
                    result.put("message", "\uc774\ubbf8 \uac00\uc785\ud55c \uc774\uba54\uc77c\uc785\ub2c8\ub2e4.");
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
                result.put("message", "\uc9c0\uc6d0\ud558\uc9c0 \uc54a\ub294 \uac80\uc99d \ud56d\ubaa9\uc785\ub2c8\ub2e4.");
            }
        }

        return result;
    }

    public void requestSignupVerification(Map<String, String> data) {
        signupVerificationRepository.deleteExpired();

        String uid = required(data.get("userID"), "\uc544\uc774\ub514\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
        String nick = required(data.get("username"), "\ub2c9\ub124\uc784\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
        String email = required(data.get("email"), "\uc774\uba54\uc77c\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
        String password = required(data.get("password"), "\ube44\ubc00\ubc88\ud638\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
        String nickType = normalizeNickType(data.get("nickType"));
        ensureSignupConsents(data);

        ensureFieldValid("uid", uid, nickType);
        ensureFieldValid("nick", nick, nickType);
        ensureFieldValid("email", email, nickType);
        ensureFieldValid("password", password, nickType);

        String code = generateVerificationCode();
        String passwordHash = BCrypt.hashpw(password, BCrypt.gensalt());
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(VERIFICATION_EXPIRE_MINUTES);

        signupVerificationRepository.upsertPendingSignup(uid, nick, email, passwordHash, nickType, code, expiresAt);
        emailVerificationService.sendSignupCode(email, uid, code);
    }

    public void confirmSignup(Map<String, String> data) {
        signupVerificationRepository.deleteExpired();

        String uid = required(data.get("userID"), "\uc544\uc774\ub514\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
        String email = required(data.get("email"), "\uc774\uba54\uc77c\uc744 \uc785\ub825\ud574 \uc8fc\uc138\uc694.");
        String code = required(data.get("code"), "\uc778\uc99d \ucf54\ub4dc\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.");

        Map<String, Object> pending = signupVerificationRepository.findByUidAndEmail(uid, email);
        if (pending == null) {
            throw new RuntimeException("\ub300\uae30 \uc911\uc778 \uc774\uba54\uc77c \uc778\uc99d \uc694\uccad\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.");
        }

        String savedCode = String.valueOf(pending.get("verification_code"));
        LocalDateTime expiresAt = toLocalDateTime(pending.get("expires_at"));
        if (expiresAt == null || expiresAt.isBefore(LocalDateTime.now())) {
            signupVerificationRepository.deleteByUid(uid);
            throw new RuntimeException("\uc778\uc99d \ucf54\ub4dc\uac00 \ub9cc\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc694\uccad\ud574 \uc8fc\uc138\uc694.");
        }
        if (!savedCode.equals(code.trim())) {
            throw new RuntimeException("\uc778\uc99d \ucf54\ub4dc\uac00 \uc62c\ubc14\ub974\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.");
        }
        if (userDAO.existsByUid(uid)) {
            signupVerificationRepository.deleteByUid(uid);
            throw new RuntimeException("\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 \uc544\uc774\ub514\uc785\ub2c8\ub2e4.");
        }
        if (userDAO.existsByEmail(email)) {
            signupVerificationRepository.deleteByUid(uid);
            throw new RuntimeException("\uc774\ubbf8 \uac00\uc785\ud55c \uc774\uba54\uc77c\uc785\ub2c8\ub2e4.");
        }
        if ("fixed".equals(normalizeNickType(String.valueOf(pending.get("nick_type"))))
                && userDAO.existsByFixedNick(String.valueOf(pending.get("nick")))) {
            signupVerificationRepository.deleteByUid(uid);
            throw new RuntimeException("\uc774\ubbf8 \uc0ac\uc6a9 \uc911\uc778 \uace0\uc815 \ub2c9\ub124\uc784\uc785\ub2c8\ub2e4.");
        }

        UserEntity user = new UserEntity();
        user.setUid(uid);
        user.setNick(String.valueOf(pending.get("nick")));
        user.setPasswordHash(String.valueOf(pending.get("password_hash")));
        user.setEmail(String.valueOf(pending.get("email")));
        user.setNickType(normalizeNickType(String.valueOf(pending.get("nick_type"))));
        user.setNickIconType("default");
        user.setMemberDivision("user");

        userDAO.save(user);
        signupVerificationRepository.deleteByUid(uid);
    }

    private void ensureFieldValid(String field, String value, String nickType) {
        Map<String, Object> result = validateSignupField(field, value, nickType);
        if (!Boolean.TRUE.equals(result.get("valid"))) {
            throw new RuntimeException(String.valueOf(result.get("message")));
        }
    }

    private void ensureSignupConsents(Map<String, String> data) {
        if (!flag(data.get("acceptedTerms"))) {
            throw new RuntimeException("\uc11c\ube44\uc2a4 \uc774\uc6a9 \uc57d\uad00 \ub3d9\uc758\uac00 \ud544\uc694\ud569\ub2c8\ub2e4.");
        }
        if (!flag(data.get("acceptedPrivacy"))) {
            throw new RuntimeException("\uac1c\uc778\uc815\ubcf4 \uc218\uc9d1 \ubc0f \uc774\uc6a9 \ub3d9\uc758\uac00 \ud544\uc694\ud569\ub2c8\ub2e4.");
        }
        if (!flag(data.get("acceptedOperations"))) {
            throw new RuntimeException("\uc774\uba54\uc77c \uc778\uc99d \ubc0f \uc6b4\uc601 \uc548\ub0b4 \ud655\uc778 \ub3d9\uc758\uac00 \ud544\uc694\ud569\ub2c8\ub2e4.");
        }
    }

    private String validatePasswordPolicy(String password) {
        if (password == null || password.isBlank()) {
            return "\ube44\ubc00\ubc88\ud638\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.";
        }
        if (password.length() < 8 || password.length() > 64) {
            return "\ube44\ubc00\ubc88\ud638\ub294 8\uc790 \uc774\uc0c1 64\uc790 \uc774\ud558\uc5ec\uc57c \ud569\ub2c8\ub2e4.";
        }
        if (!PASSWORD_UPPER.matcher(password).find()) {
            return "\ube44\ubc00\ubc88\ud638\uc5d0\ub294 \uc601\ubb38 \ub300\ubb38\uc790\ub97c 1\uc790 \uc774\uc0c1 \ud3ec\ud568\ud574 \uc8fc\uc138\uc694.";
        }
        if (!PASSWORD_LOWER.matcher(password).find()) {
            return "\ube44\ubc00\ubc88\ud638\uc5d0\ub294 \uc601\ubb38 \uc18c\ubb38\uc790\ub97c 1\uc790 \uc774\uc0c1 \ud3ec\ud568\ud574 \uc8fc\uc138\uc694.";
        }
        if (!PASSWORD_DIGIT.matcher(password).find()) {
            return "\ube44\ubc00\ubc88\ud638\uc5d0\ub294 \uc22b\uc790\ub97c 1\uc790 \uc774\uc0c1 \ud3ec\ud568\ud574 \uc8fc\uc138\uc694.";
        }
        if (!PASSWORD_SPECIAL.matcher(password).find()) {
            return "\ube44\ubc00\ubc88\ud638\uc5d0\ub294 \ud2b9\uc218\ubb38\uc790\ub97c 1\uc790 \uc774\uc0c1 \ud3ec\ud568\ud574 \uc8fc\uc138\uc694.";
        }
        return null;
    }

    private String generateVerificationCode() {
        int value = ThreadLocalRandom.current().nextInt(100000, 1000000);
        return String.valueOf(value);
    }

    private boolean flag(String value) {
        if (value == null) {
            return false;
        }
        String normalized = value.trim().toLowerCase();
        return normalized.equals("1") || normalized.equals("true") || normalized.equals("yes") || normalized.equals("on");
    }

    private String normalizeNickType(String value) {
        if (value == null) {
            return "variable";
        }
        String normalized = value.trim().toLowerCase();
        if (normalized.equals("fixed")
                || normalized.equals("fix")
                || normalized.equals("f")
                || normalized.equals("1")
                || normalized.equals("true")
                || normalized.equals("\uace0\uc815")
                || normalized.equals("\uace0\uc815\ub2c9")) {
            return "fixed";
        }
        return "variable";
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
