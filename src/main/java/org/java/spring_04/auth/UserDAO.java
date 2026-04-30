package org.java.spring_04.auth;

import jakarta.annotation.PostConstruct;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UserDAO {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void initializeUserSchema() {
        try {
            jdbcTemplate.execute("ALTER TABLE user ADD COLUMN nick_type VARCHAR(20) NOT NULL DEFAULT 'variable'");
        } catch (Exception ignored) {
        }
    }

    public Optional<UserEntity> findByIdentifier(String identifier) {
        String sql = """
                SELECT uid, nick, nick_type, nick_icon_type, password_hash, email, member_division
                FROM user
                WHERE uid = ? OR email = ?
                """;
        try {
            UserEntity user = jdbcTemplate.queryForObject(
                    sql,
                    new BeanPropertyRowMapper<>(UserEntity.class),
                    identifier,
                    identifier
            );
            return Optional.ofNullable(user);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public boolean existsByUid(String uid) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user WHERE uid = ?",
                Integer.class,
                uid
        );
        return count != null && count > 0;
    }

    public boolean existsByEmail(String email) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user WHERE email = ?",
                Integer.class,
                email
        );
        return count != null && count > 0;
    }

    public boolean existsByNick(String nick) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user WHERE nick = ?",
                Integer.class,
                nick
        );
        return count != null && count > 0;
    }

    public boolean existsByFixedNick(String nick) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user WHERE nick = ? AND COALESCE(nick_type, 'variable') = 'fixed'",
                Integer.class,
                nick
        );
        return count != null && count > 0;
    }

    public void save(UserEntity user) {
        String normalizedNickType = user.getNickType() == null || user.getNickType().isBlank()
                ? "variable"
                : user.getNickType().trim().toLowerCase();
        String normalizedNickIconType = user.getNickIconType() == null || user.getNickIconType().isBlank()
                ? "default"
                : user.getNickIconType().trim().toLowerCase();
        String sql = """
                INSERT INTO user (uid, nick, password_hash, email, nick_type, nick_icon_type, member_division)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """;

        jdbcTemplate.update(
                sql,
                user.getUid(),
                user.getNick(),
                user.getPasswordHash(),
                user.getEmail(),
                normalizedNickType,
                normalizedNickIconType,
                "user"
        );
    }
}
