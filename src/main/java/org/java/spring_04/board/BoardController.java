package org.java.spring_04.board;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.java.spring_04.feature.FeatureService;
import org.java.spring_04.post.PostService;
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

    @Autowired
    private PostService postService;

    @Autowired
    private FeatureService featureService;

    @GetMapping("/list")
    public List<Map<String, Object>> getBoardList() {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/list");
        return boardService.getBoardList();
    }

    @GetMapping("/posts/{gid}")
    public List<Map<String, Object>> getPosts(
            @PathVariable("gid") String gid,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @SessionAttribute(name = "uid", required = false) String uid,
            @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/posts/" + gid + "?page=" + page);
        featureService.assertBoardReadable(gid, uid, memberDivision);
        return boardService.getPostsByGallery(gid, page);
    }

    @GetMapping("/posts/{gid}/{postNo}")
    public Map<String, Object> getPostDetail(
            @PathVariable("gid") String gid,
            @PathVariable("postNo") Long postNo,
            @SessionAttribute(name = "uid", required = false) String uid,
            @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/posts/" + gid + "/" + postNo);
        Map<String, Object> post = boardService.getPostDetail(gid, postNo);

        if (post == null) {
            return Map.of("success", false, "message", "게시글을 찾을 수 없습니다.");
        }
        if (!featureService.canViewPost(post, uid, memberDivision)) {
            return Map.of("success", false, "message", "게시글을 열람할 권한이 없습니다.");
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

    @PostMapping("/request/side-board")
    public Map<String, Object> requestSideBoard(@RequestBody Map<String, String> payload,
                                                @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/request/side-board");
        try {
            boardService.requestSideBoardCreation(payload, uid);
            return Map.of("success", true, "message", "사이드보드 개설 요청을 보냈습니다.");
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
            if (uid == null || uid.isBlank()) {
                Map<String, Object> settings = boardService.getBoardSettings(payload.get("gid"));
                if (!flagEnabled(settings.get("allow_guest_post"))) {
                    return Map.of("success", false, "message", "이 보드는 비회원 글쓰기가 비활성화되어 있습니다.");
                }
            }
            String memberDivision = (String) session.getAttribute("memberDivision");
            return postService.insertPost(payload, uid, nick, extractClientIp(request), memberDivision);
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

    private boolean flagEnabled(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        if (value == null) {
            return false;
        }
        String text = String.valueOf(value).trim();
        return text.equals("1") || text.equalsIgnoreCase("true") || text.equalsIgnoreCase("yes") || text.equalsIgnoreCase("on");
    }
}
