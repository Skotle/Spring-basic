package org.java.spring_04.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.BeanPropertyRowMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Optional;

@Repository
public class UserDAO {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    // 아이디 또는 이메일로 유저 조회
    public Optional<UserEntity> findByIdentifier(String identifier) {
        String sql = "SELECT uid, nick, nick_icon_type, password_hash, email, member_division " +
                "FROM user WHERE uid = ? OR email = ?";
        try {
            UserEntity user = jdbcTemplate.queryForObject(sql,
                    new BeanPropertyRowMapper<>(UserEntity.class), identifier, identifier);
            return Optional.ofNullable(user);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    // 신규 유저 삽입
    public void save(UserEntity user) {
        String email = user.getEmail();

        // 이메일이 없거나 공백만 있다면 명시적으로 null 대입
        if (email == null || email.trim().isEmpty()) {
            email = null;
        }

        String sql = "INSERT INTO user (uid, nick, password_hash, email, nick_icon_type, member_division) " +
                "VALUES (?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(sql,
                user.getUid(),
                user.getNick(),
                user.getPasswordHash(),
                email, // 여기서 null이 들어가야 UNIQUE 제약 조건을 피함
                "default",
                "user"
        );
    }
}