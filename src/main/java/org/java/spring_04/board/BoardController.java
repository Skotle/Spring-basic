package org.java.spring_04.board;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/board")
public class BoardController {

    @Autowired
    private BoardService boardService;

    @GetMapping("/list")
    public List<Map<String, Object>> getBoardList() {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/list");
        return boardService.getBoardList();
    }

    @GetMapping("/posts/{gid}")
    public List<Map<String, Object>> getPosts(
            @PathVariable("gid") String gid,
            @RequestParam(value = "page", defaultValue = "1") int page) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/posts/" + gid + "?page=" + page);
        return boardService.getPostsByGallery(gid, page);
    }

    @GetMapping("/posts/{gid}/{postNo}")
    public Map<String, Object> getPostDetail(
            @PathVariable("gid") String gid,
            @PathVariable("postNo") Long postNo) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/posts/" + gid + "/" + postNo);
        Map<String, Object> post = boardService.getPostDetail(gid, postNo);

        if (post == null) {
            return Map.of("success", false, "message", "게시글을 찾을 수 없습니다.");
        }

        return Map.of("success", true, "post", post);
    }

    @PostMapping("/write")
    public Map<String, Object> writePost(@RequestBody Map<String, String> payload,
                                         HttpServletRequest request,
                                         HttpSession session) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/write gid=" + payload.get("gid"));
        String uid = (String) session.getAttribute("uid");
        String nick = (String) session.getAttribute("nick");

        try {
            boardService.insertPost(payload, uid, nick, extractClientIp(request));
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
    private String extractClientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }

        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        return request.getRemoteAddr();
    }
}
