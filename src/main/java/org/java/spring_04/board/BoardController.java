package org.java.spring_04.board;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.java.spring_04.common.RequestIpResolver;
import org.java.spring_04.feature.FeatureService;
import org.java.spring_04.post.PostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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

    @Autowired
    private RequestIpResolver requestIpResolver;

    @GetMapping("/list")
    public List<Map<String, Object>> getBoardList() {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/list");
        return boardService.getBoardList();
    }

    @GetMapping("/topics")
    public Map<String, Object> getBoardTopics() {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/topics");
        try {
            return Map.of("success", true, "topics", boardService.getBoardTopics());
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage(), "topics", List.of());
        }
    }

    @GetMapping("/my")
    public Map<String, Object> getMyBoardDashboard(@SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/my");
        try {
            return Map.of("success", true, "data", boardService.getMyBoardDashboard(uid));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @GetMapping("/posts/{gid}")
    public ResponseEntity<?> getPosts(@PathVariable("gid") String gid,
                                      @RequestParam(value = "page", defaultValue = "1") int page,
                                      @SessionAttribute(name = "uid", required = false) String uid,
                                      @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {

        try {
            System.out.println("[" + LocalDateTime.now() + "] API /api/board/posts/" + gid + "?page=" + page);
            featureService.assertBoardReadable(gid, uid, memberDivision);
            return ResponseEntity.ok(boardService.getPostsByGallery(gid, page));

        } catch (Exception e) {
            String message = e.getMessage() == null ? "게시글 목록을 불러오지 못했습니다." : e.getMessage();
            boolean accessDenied = message.contains("전용 보드") || message.contains("비공개");
            System.out.println("[" + LocalDateTime.now() + "] API DENY /api/board/posts/" + gid + " message=" + message);
            return ResponseEntity.status(accessDenied ? HttpStatus.FORBIDDEN : HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", message));
        }
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
            Map<String, Object> data = boardService.getBoardManageInfo(gid, uid, memberDivision);
            enrichWriteAccess(gid, uid, memberDivision, data);
            return Map.of("success", true, "data", data);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @GetMapping("/rankings")
    public Map<String, Object> getBoardRankings() {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/rankings");
        try {
            return Map.of("success", true, "data", boardService.getBoardRankingData());
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @GetMapping("/manage/{gid}/settings")
    public Map<String, Object> getBoardSettings(@PathVariable("gid") String gid,
                                                @SessionAttribute(name = "uid", required = false) String uid,
                                                @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid + "/settings");
        try {
            if (!boardService.canEditBoardSettings(gid, uid, memberDivision)) {
                return Map.of("success", false, "message", "보드 설정을 조회할 권한이 없습니다.");
            }
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
            String password = payload == null ? null : payload.get("password");
            boardService.assignManager(gid, targetUid, uid, memberDivision, password);
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
            boardService.appointSubmanager(gid, payload.get("targetUid"), uid, memberDivision, payload.get("password"));
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @DeleteMapping("/manage/{gid}/submanager/{targetUid}")
    public Map<String, Object> revokeSubmanager(@PathVariable("gid") String gid,
                                                @PathVariable("targetUid") String targetUid,
                                                @RequestBody(required = false) Map<String, String> payload,
                                                @SessionAttribute(name = "uid", required = false) String uid,
                                                @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid + "/submanager/" + targetUid);
        try {
            boardService.revokeSubmanager(gid, targetUid, uid, memberDivision, payload == null ? null : payload.get("password"));
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/manage/{gid}/submanager/{targetUid}/permissions")
    public Map<String, Object> updateSubmanagerPermissions(@PathVariable("gid") String gid,
                                                           @PathVariable("targetUid") String targetUid,
                                                           @RequestBody Map<String, String> payload,
                                                           @SessionAttribute(name = "uid", required = false) String uid,
                                                           @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/board/manage/" + gid + "/submanager/" + targetUid + "/permissions");
        try {
            return Map.of("success", true, "data", boardService.updateSubmanagerPermissions(gid, targetUid, payload, uid, memberDivision));
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
        return requestIpResolver.resolve(request);
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

    @SuppressWarnings("unchecked")
    private void enrichWriteAccess(String gid, String uid, String memberDivision, Map<String, Object> data) {
        Object permissionsValue = data.get("permissions");
        if (!(permissionsValue instanceof Map<?, ?>)) {
            return;
        }
        Map<String, Object> permissions = (Map<String, Object>) permissionsValue;
        Map<String, Object> settings = data.get("settings") instanceof Map<?, ?> settingsMap
                ? (Map<String, Object>) settingsMap
                : Map.of();
        boolean loggedIn = uid != null && !uid.isBlank();
        boolean guestAllowed = flagEnabled(settings.get("allow_guest_post"));
        boolean canParticipate = featureService.canParticipateInBoard(gid, uid, memberDivision);
        boolean joinRequired = featureService.requiresBoardJoin(gid, uid, memberDivision);
        boolean canWritePost = canParticipate && (loggedIn || guestAllowed);
        permissions.put("canParticipateBoard", canParticipate);
        permissions.put("joinRequired", joinRequired);
        permissions.put("canWritePost", canWritePost);
        permissions.put("writePermissionLabel", writePermissionLabel(settings, joinRequired, canParticipate, loggedIn));
    }

    private String writePermissionLabel(Map<String, Object> settings, boolean joinRequired, boolean canParticipate, boolean loggedIn) {
        String visibility = settings.get("visibility") == null ? "" : String.valueOf(settings.get("visibility")).trim().toLowerCase();
        boolean guestAllowed = flagEnabled(settings.get("allow_guest_post"));
        if (joinRequired) {
            return "[잠김]";
        }
        if (!canParticipate) {
            return "[잠김]";
        }
        if ("members".equals(visibility)) {
            return "글쓰기: 보드 멤버만 가능";
        }
        if (guestAllowed) {
            return "글쓰기: 비회원 포함 누구나 가능";
        }
        if (loggedIn) {
            return "글쓰기: 로그인 사용자 가능";
        }
        return "[잠김]";
    }
}
