package org.java.spring_04.auth;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class AuthService {

    @Autowired
    private UserDAO userDAO;

    public UserEntity login(String identifier, String password) {
        return userDAO.findByIdentifier(identifier)
                .filter(user -> BCrypt.checkpw(password, user.getPasswordHash()))
                .orElse(null); // 비밀번호 불일치 시 null 반환
    }

    public void signup(Map<String, String> data) throws Exception {
        UserEntity user = new UserEntity();
        user.setUid(data.get("userID"));
        user.setNick(data.get("username"));
        user.setPasswordHash(BCrypt.hashpw(data.get("password"), BCrypt.gensalt())); // 암호화
        user.setEmail(data.get("email"));
        user.setNickIconType("default");
        user.setMemberDivision("user");

        userDAO.save(user);
    }
}