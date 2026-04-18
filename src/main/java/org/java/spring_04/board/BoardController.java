package org.java.spring_04.board;

import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/board")
public class BoardController {

    @Autowired
    private BoardService boardService;

    @GetMapping("/list")
    public List<Map<String, Object>> getBoardList() {
        return boardService.getBoardList();
    }

    @GetMapping("/posts/{gid}")
    public List<Map<String, Object>> getPosts(
            @PathVariable("gid") String gid,
            @RequestParam(value = "page", defaultValue = "1") int page) {
        return boardService.getPostsByGallery(gid, page);
    }

    @GetMapping("/posts/{gid}/{postNo}")
    public Map<String, Object> getPostDetail(
            @PathVariable("gid") String gid,
            @PathVariable("postNo") Long postNo) {
        Map<String, Object> post = boardService.getPostDetail(gid, postNo);

        if (post == null) {
            return Map.of("success", false, "message", "게시글을 찾을 수 없습니다.");
        }

        return Map.of("success", true, "post", post);
    }

    @PostMapping("/write")
    public Map<String, Object> writePost(@RequestBody Map<String, String> payload, HttpSession session) {
        String uid = (String) session.getAttribute("uid");
        String nick = (String) session.getAttribute("nick");

        if (uid == null) {
            return Map.of("success", false, "message", "로그인이 필요합니다.");
        }

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
}
