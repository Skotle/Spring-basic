package org.java.spring_04.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserDAO {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public Optional<UserEntity> findByIdentifier(String identifier) {
        String sql = """
                SELECT uid, nick, nick_icon_type, password_hash, email, member_division
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

    public void save(UserEntity user) {
        ensureDefaultUserRole();

        String sql = """
                INSERT INTO user (uid, nick, password_hash, email, nick_icon_type, member_division, role_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """;

        Integer roleId = jdbcTemplate.queryForObject(
                "SELECT role_id FROM roles WHERE LOWER(role_name) = 'user' LIMIT 1",
                Integer.class
        );
        if (roleId == null) {
            throw new IllegalStateException("기본 user 역할을 찾을 수 없습니다.");
        }

        jdbcTemplate.update(
                sql,
                user.getUid(),
                user.getNick(),
                user.getPasswordHash(),
                user.getEmail(),
                "default",
                "user",
                roleId
        );
    }

    private void ensureDefaultUserRole() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM roles WHERE LOWER(role_name) = 'user'",
                Integer.class
        );
        if (count == null || count == 0) {
            jdbcTemplate.update(
                    "INSERT INTO roles (role_name, description) VALUES (?, ?)",
                    "user",
                    "Default member role"
            );
        }
    }
}
