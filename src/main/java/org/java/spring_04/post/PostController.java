package org.java.spring_04.post;

import jakarta.servlet.http.HttpServletRequest;
import org.java.spring_04.board.BoardService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    @Autowired
    private PostService postService;

    @Autowired
    private BoardService boardService;

    @GetMapping("/list")
    public List<Map<String, Object>> getPostList(@RequestParam("gid") String gallId) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/list?gid=" + gallId);
        return postService.getPostsByGallery(gallId);
    }

    @GetMapping("/recommend")
    public List<Map<String, Object>> getRecommendPosts() {
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/recommend");
        return postService.getTopRecommendedPosts();
    }

    @GetMapping("/detail/{postId}")
    public Map<String, Object> getPostDetail(@PathVariable("postId") Long postId) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/detail/" + postId);
        return postService.getPostDetail(postId);
    }

    @GetMapping("/get/{gid}/{postNo}")
    public Map<String, Object> getPostByGalleryAndNumber(
            @PathVariable("gid") String gid,
            @PathVariable("postNo") Long postNo,
            HttpServletRequest request,
            @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/get/" + gid + "/" + postNo);
        Map<String, Object> post = postService.getPostDetail(gid, postNo);

        if (post == null) {
            return Map.of("success", false, "message", "게시글을 찾을 수 없습니다.");
        }

        return Map.of(
                "success", true,
                "post", post,
                "comments", postService.getComments(gid, postNo),
                "voteState", postService.getVoteState(gid, postNo, uid, extractClientIp(request))
        );
    }

    @PostMapping("/write")
    public Map<String, Object> writePost(@RequestBody Map<String, String> payload,
                                         HttpServletRequest request,
                                         @SessionAttribute(name = "uid", required = false) String uid,
                                         @SessionAttribute(name = "nick", required = false) String nick) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        String clientIp = extractClientIp(request);
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/write gid=" + payload.get("gid") + " actor=" + actor + " ip=" + clientIp + " titleLength=" + lengthOf(payload.get("title")));

        if (uid == null || uid.isBlank()) {
            Map<String, Object> settings = boardService.getBoardSettings(payload.get("gid"));
            if (!flagEnabled(settings.get("allow_guest_post"))) {
                return Map.of("success", false, "message", "이 보드는 비회원 글쓰기가 비활성화되어 있습니다.");
            }
        }

        try {
            Map<String, Object> result = postService.insertPost(payload, uid, nick, clientIp);
            System.out.println("[" + LocalDateTime.now() + "] API RESULT /api/posts/write success=" + result.get("success") + " postNo=" + result.get("postNo"));
            return result;
        } catch (Exception e) {
            System.out.println("[" + LocalDateTime.now() + "] API ERROR /api/posts/write message=" + e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/comment")
    public Map<String, Object> writeComment(@RequestBody Map<String, String> payload,
                                            HttpServletRequest request,
                                            @SessionAttribute(name = "uid", required = false) String uid,
                                            @SessionAttribute(name = "nick", required = false) String nick) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        String clientIp = extractClientIp(request);
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/comment gid=" + payload.get("gid") + " postNo=" + payload.get("postNo") + " actor=" + actor + " ip=" + clientIp + " contentLength=" + lengthOf(payload.get("content")));

        if (uid == null || uid.isBlank()) {
            Map<String, Object> settings = boardService.getBoardSettings(payload.get("gid"));
            if (!flagEnabled(settings.get("allow_guest_comment"))) {
                return Map.of("success", false, "message", "이 보드는 비회원 댓글쓰기가 비활성화되어 있습니다.");
            }
        }

        try {
            Map<String, Object> result = postService.insertComment(payload, uid, nick, clientIp);
            System.out.println("[" + LocalDateTime.now() + "] API RESULT /api/posts/comment success=" + result.get("success"));
            return result;
        } catch (Exception e) {
            System.out.println("[" + LocalDateTime.now() + "] API ERROR /api/posts/comment message=" + e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/vote")
    public Map<String, Object> votePost(@RequestBody Map<String, String> payload,
                                        HttpServletRequest request,
                                        @SessionAttribute(name = "uid", required = false) String uid) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        String clientIp = extractClientIp(request);
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/vote gid=" + payload.get("gid") + ", postNo=" + payload.get("postNo") + " voteType=" + payload.get("voteType") + " actor=" + actor + " ip=" + clientIp);
        try {
            Map<String, Object> result = postService.votePost(payload, uid, clientIp);
            System.out.println("[" + LocalDateTime.now() + "] API RESULT /api/posts/vote success=" + result.get("success") + " message=" + result.get("message"));
            return result;
        } catch (Exception e) {
            System.out.println("[" + LocalDateTime.now() + "] API ERROR /api/posts/vote message=" + e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/delete")
    public Map<String, Object> deletePost(@RequestBody Map<String, String> payload,
                                          @SessionAttribute(name = "uid", required = false) String uid,
                                          @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/delete gid=" + payload.get("gid") + ", postNo=" + payload.get("postNo") + " actor=" + actor + " memberDivision=" + memberDivision + " passwordProvided=" + (payload.get("password") != null && !payload.get("password").isBlank()));
        try {
            Map<String, Object> result = postService.deletePost(payload, uid, memberDivision);
            System.out.println("[" + LocalDateTime.now() + "] API RESULT /api/posts/delete success=" + result.get("success") + " message=" + result.get("message"));
            return result;
        } catch (Exception e) {
            System.out.println("[" + LocalDateTime.now() + "] API ERROR /api/posts/delete message=" + e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/comment/delete")
    public Map<String, Object> deleteComment(@RequestBody Map<String, String> payload,
                                             @SessionAttribute(name = "uid", required = false) String uid,
                                             @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/comment/delete commentId=" + payload.get("commentId") + " actor=" + actor + " memberDivision=" + memberDivision + " passwordProvided=" + (payload.get("password") != null && !payload.get("password").isBlank()));
        try {
            Map<String, Object> result = postService.deleteComment(payload, uid, memberDivision);
            System.out.println("[" + LocalDateTime.now() + "] API RESULT /api/posts/comment/delete success=" + result.get("success") + " message=" + result.get("message"));
            return result;
        } catch (Exception e) {
            System.out.println("[" + LocalDateTime.now() + "] API ERROR /api/posts/comment/delete message=" + e.getMessage());
            return Map.of("success", false, "message", e.getMessage());
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

    private int lengthOf(String value) {
        return value == null ? 0 : value.length();
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
