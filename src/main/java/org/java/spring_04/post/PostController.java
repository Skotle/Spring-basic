package org.java.spring_04.post;

import jakarta.servlet.http.HttpServletRequest;
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
            @PathVariable("postNo") Long postNo) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/get/" + gid + "/" + postNo);
        Map<String, Object> post = postService.getPostDetail(gid, postNo);

        if (post == null) {
            return Map.of("success", false, "message", "게시글을 찾을 수 없습니다.");
        }

        return Map.of(
                "success", true,
                "post", post,
                "comments", postService.getComments(gid, postNo)
        );
    }

    @PostMapping("/write")
    public Map<String, Object> writePost(@RequestBody Map<String, String> payload,
                                         HttpServletRequest request,
                                         @SessionAttribute(name = "uid", required = false) String uid,
                                         @SessionAttribute(name = "nick", required = false) String nick) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/write gid=" + payload.get("gid"));

        try {
            return postService.insertPost(payload, uid, nick, extractClientIp(request));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/comment")
    public Map<String, Object> writeComment(@RequestBody Map<String, String> payload,
                                            HttpServletRequest request,
                                            @SessionAttribute(name = "uid", required = false) String uid,
                                            @SessionAttribute(name = "nick", required = false) String nick) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/comment gid=" + payload.get("gid"));

        try {
            return postService.insertComment(payload, uid, nick, extractClientIp(request));
        } catch (Exception e) {
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
}
