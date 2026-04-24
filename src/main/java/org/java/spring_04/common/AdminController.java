package org.java.spring_04.common;

import jakarta.servlet.http.HttpSession;
import org.java.spring_04.board.BoardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Controller
public class AdminController {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private BoardService boardService;

    @GetMapping("/admin/boards")
    public String boardManagerPage(HttpSession session) {
        ensureAdmin(session);
        return "admin-board-managers";
    }

    @ResponseBody
    @GetMapping("/api/admin/boards")
    public List<Map<String, Object>> getBoards(HttpSession session) {
        ensureAdmin(session);
        return boardService.getBoardList();
    }

    @ResponseBody
    @GetMapping("/api/admin/boards/{gid}")
    public Map<String, Object> getBoardManageInfo(@PathVariable("gid") String gid, HttpSession session) {
        ensureAdmin(session);
        return Map.of("success", true, "data", boardService.getBoardManageInfo(gid, null, "admin"));
    }

    @ResponseBody
    @GetMapping("/api/admin/users/search")
    public List<Map<String, Object>> searchUsers(@RequestParam("q") String query, HttpSession session) {
        ensureAdmin(session);
        String normalized = query == null ? "" : query.trim();
        if (normalized.isEmpty()) {
            return List.of();
        }

        return jdbcTemplate.queryForList("""
                SELECT uid, nick, email, member_division
                FROM user
                WHERE uid LIKE CONCAT('%', ?, '%')
                   OR nick LIKE CONCAT('%', ?, '%')
                ORDER BY uid ASC
                LIMIT 20
                """, normalized, normalized);
    }

    @ResponseBody
    @PostMapping("/api/admin/boards/{gid}/manager")
    public Map<String, Object> assignManager(@PathVariable("gid") String gid,
                                             @RequestBody Map<String, String> payload,
                                             HttpSession session) {
        ensureAdmin(session);
        String uid = (String) session.getAttribute("uid");
        boardService.assignManager(gid, payload.get("targetUid"), uid, "admin");
        return Map.of("success", true);
    }

    @ResponseBody
    @PostMapping("/api/admin/boards/{gid}/submanagers")
    public Map<String, Object> appointSubmanager(@PathVariable("gid") String gid,
                                                 @RequestBody Map<String, String> payload,
                                                 HttpSession session) {
        ensureAdmin(session);
        String uid = (String) session.getAttribute("uid");
        boardService.appointSubmanager(gid, payload.get("targetUid"), uid, "admin");
        return Map.of("success", true);
    }

    @ResponseBody
    @DeleteMapping("/api/admin/boards/{gid}/submanagers/{targetUid}")
    public Map<String, Object> revokeSubmanager(@PathVariable("gid") String gid,
                                                @PathVariable("targetUid") String targetUid,
                                                HttpSession session) {
        ensureAdmin(session);
        String uid = (String) session.getAttribute("uid");
        boardService.revokeSubmanager(gid, targetUid, uid, "admin");
        return Map.of("success", true);
    }

    private void ensureAdmin(HttpSession session) {
        Object division = session.getAttribute("memberDivision");
        if (division == null) {
            throw new ResponseStatusException(UNAUTHORIZED, "로그인이 필요합니다.");
        }

        String normalized = String.valueOf(division).trim();
        if (!normalized.equals("1") && !normalized.equalsIgnoreCase("admin")) {
            throw new ResponseStatusException(FORBIDDEN, "어드민 권한이 필요합니다.");
        }
    }
}
