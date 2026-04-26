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

    @GetMapping("/manage/{gid}")
    public Map<String, Object> getBoardManageInfo(@PathVariable("gid") String gid,
                                                  @SessionAttribute(name = "uid", required = false) String uid,
                                                  @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid);
        try {
            return Map.of("success", true, "data", boardService.getBoardManageInfo(gid, uid, memberDivision));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @GetMapping("/manage/{gid}/settings")
    public Map<String, Object> getBoardSettings(@PathVariable("gid") String gid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid + "/settings");
        try {
            return Map.of("success", true, "data", boardService.getBoardSettings(gid));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/manage/{gid}/settings")
    public Map<String, Object> saveBoardSettings(@PathVariable("gid") String gid,
                                                 @RequestBody Map<String, String> payload,
                                                 @SessionAttribute(name = "uid", required = false) String uid,
                                                 @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid + "/settings");
        try {
            return Map.of("success", true, "data", boardService.saveBoardSettings(gid, payload, uid, memberDivision));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/manage/{gid}/manager")
    public Map<String, Object> assignManager(@PathVariable("gid") String gid,
                                             @RequestBody(required = false) Map<String, String> payload,
                                             @SessionAttribute(name = "uid", required = false) String uid,
                                             @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid + "/manager");
        try {
            String targetUid = payload == null ? null : payload.get("targetUid");
            boardService.assignManager(gid, targetUid, uid, memberDivision);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/manage/{gid}/submanager")
    public Map<String, Object> appointSubmanager(@PathVariable("gid") String gid,
                                                 @RequestBody Map<String, String> payload,
                                                 @SessionAttribute(name = "uid", required = false) String uid,
                                                 @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid + "/submanager");
        try {
            boardService.appointSubmanager(gid, payload.get("targetUid"), uid, memberDivision);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @DeleteMapping("/manage/{gid}/submanager/{targetUid}")
    public Map<String, Object> revokeSubmanager(@PathVariable("gid") String gid,
                                                @PathVariable("targetUid") String targetUid,
                                                @SessionAttribute(name = "uid", required = false) String uid,
                                                @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid + "/submanager/" + targetUid);
        try {
            boardService.revokeSubmanager(gid, targetUid, uid, memberDivision);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
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
