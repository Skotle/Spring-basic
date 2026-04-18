package org.java.spring_04.post;

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

        return Map.of("success", true, "post", post);
    }

    @PostMapping("/write")
    public Map<String, Object> writePost(@RequestBody Map<String, String> payload,
                                         @SessionAttribute(name = "uid", required = false) String uid,
                                         @SessionAttribute(name = "nick", required = false) String nick) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/posts/write gid=" + payload.get("gid"));

        if (uid == null) {
            return Map.of("success", false, "message", "로그인이 필요합니다.");
        }

        try {
            postService.insertPost(payload, uid, nick);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }
}
