package org.java.spring_04.auth;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Map;

@Repository
public class SignupVerificationRepository {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void initialize() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS signup_verification (
                    request_id BIGINT NOT NULL AUTO_INCREMENT,
                    uid VARCHAR(50) NOT NULL,
                    nick VARCHAR(100) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    verification_code VARCHAR(20) NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (request_id),
                    UNIQUE KEY uk_signup_verification_uid (uid),
                    UNIQUE KEY uk_signup_verification_email (email)
                )
                """);
    }

    public void upsertPendingSignup(String uid, String nick, String email, String passwordHash, String code, LocalDateTime expiresAt) {
        jdbcTemplate.update("""
                INSERT INTO signup_verification (uid, nick, email, password_hash, verification_code, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    nick = VALUES(nick),
                    email = VALUES(email),
                    password_hash = VALUES(password_hash),
                    verification_code = VALUES(verification_code),
                    expires_at = VALUES(expires_at),
                    created_at = CURRENT_TIMESTAMP
                """, uid, nick, email, passwordHash, code, expiresAt);
    }

    public Map<String, Object> findByUidAndEmail(String uid, String email) {
        try {
            return jdbcTemplate.queryForMap("""
                    SELECT request_id, uid, nick, email, password_hash, verification_code, expires_at
                    FROM signup_verification
                    WHERE uid = ? AND email = ?
                    """, uid, email);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public void deleteByUid(String uid) {
        jdbcTemplate.update("DELETE FROM signup_verification WHERE uid = ?", uid);
    }

    public void deleteExpired() {
        jdbcTemplate.update("DELETE FROM signup_verification WHERE expires_at < NOW()");
    }
}
