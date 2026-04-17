package org.java.spring_04.board;

import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.scheduling.annotation.Scheduled;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.jdbc.core.JdbcTemplate;

@RestController
@RequestMapping("/api/admin")
public class BoardController {

    @Autowired
    private BoardService boardService;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    /**
     * 보드 목록 데이터 제공
     * GET /api/board/list
     */
    @GetMapping("/list")
    public List<Map<String, Object>> getBoardList() {
        return boardService.getBoardList();
    }

    /**
     * 특정 보드의 게시글 데이터 제공 (페이징 포함)
     * GET /api/board/posts/stockus?page=1
     */
    @GetMapping("/posts/{gid}")
    public List<Map<String, Object>> getPosts(
            @PathVariable("gid") String gid,
            @RequestParam(value = "page", defaultValue = "1") int page) {
        return boardService.getPostsByGallery(gid, page);
    }

    /**
     * 게시글 작성
     */
    @PostMapping("/write")
    public Map<String, Object> writePost(@RequestBody Map<String, String> payload, HttpSession session) {
        String uid = (String) session.getAttribute("uid");
        String nick = (String) session.getAttribute("nick");

        if (uid == null) return Map.of("success", false, "message", "로그인이 필요합니다.");

        try {
            boardService.insertPost(payload, uid, nick);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @Scheduled(fixedRate = 60000)
    public void runSyncTask() {
        try {
            boardService.syncGalleryPostCount();
        } catch (Exception e) {
            System.err.println("[Scheduler Error] 동기화 중 오류 발생: " + e.getMessage());
        }
    }
    @GetMapping("/roles")
    public ResponseEntity<?> getAdminOnlyData(HttpSession session) {
        System.out.println("\n[DEBUG] --- 관리자 권한 실시간 검증 시작 ---");

        String uid = (String) session.getAttribute("uid");
        System.out.println("[DEBUG] 1. 세션 UID 확인: " + uid);

        if (uid == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("로그인이 필요합니다.");
        }

        try {
            // 수정: user 테이블명 앞뒤에 백틱(`)을 추가하여 예약어 충돌 방지
            String checkSql = "SELECT member_division FROM user WHERE uid = ?";

            System.out.println("[DEBUG] 2. DB 조회 시도 (UID: " + uid + ")");
            String currentDivision = jdbcTemplate.queryForObject(checkSql, String.class, uid);

            System.out.println("[DEBUG] 3. DB 실시간 권한 조회 결과: [" + currentDivision + "]");

            if (!"admin".equals(currentDivision)) {
                System.out.println("[DEBUG] 4. 검증 실패: 현재 권한 [" + currentDivision + "]");
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body("관리자만 접근 가능합니다.");
            }

            System.out.println("[DEBUG] 5. 검증 성공: 관리자 확인됨");

            // 여기서도 테이블명이 user라면 백틱을 사용해야 할 수 있습니다.
            String rolesSql = "SELECT r.role_name, r.description, " +
                    "(SELECT COUNT(*) FROM `user` WHERE role_id = r.role_id) as user_count " +
                    "FROM roles r";

            List<Map<String, Object>> roles = jdbcTemplate.queryForList(rolesSql);
            return ResponseEntity.ok(roles);

        } catch (Exception e) {
            System.err.println("[DEBUG] 에러 상세: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("SQL 문법 오류 또는 데이터 없음: " + e.getMessage());
        }
    }
}