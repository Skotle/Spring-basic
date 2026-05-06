package org.java.spring_04.common;

import jakarta.servlet.http.HttpSession;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminAccessService {
    private final JdbcTemplate jdbcTemplate;

    public AdminAccessService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void assertAdmin(HttpSession session) {
        if (session == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login is required.");
        }

        Object uidValue = session.getAttribute("uid");
        String uid = uidValue == null ? "" : String.valueOf(uidValue).trim();
        if (uid.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login is required.");
        }

        String currentDivision = loadMemberDivision(uid);
        session.setAttribute("memberDivision", currentDivision);
        if (!isAdminDivision(currentDivision)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin permission is required.");
        }
        if (!Boolean.TRUE.equals(session.getAttribute("adminAuthenticated"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin login is required.");
        }
    }

    public boolean isAdminDivision(String division) {
        if (division == null) {
            return false;
        }
        String normalized = division.trim();
        return normalized.equals("1")
                || normalized.equalsIgnoreCase("admin")
                || normalized.equalsIgnoreCase("operator");
    }

    private String loadMemberDivision(String uid) {
        try {
            String division = jdbcTemplate.queryForObject(
                    "SELECT member_division FROM user WHERE uid = ?",
                    String.class,
                    uid
            );
            return division == null ? "" : division.trim();
        } catch (EmptyResultDataAccessException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login is required.");
        }
    }
}
