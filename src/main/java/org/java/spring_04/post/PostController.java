package org.java.spring_04.post;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    @Autowired
    private PostService postService;

    /**
     * 1. 특정 갤러리의 게시글 목록 조회
     * GET /api/posts/list?gid=stockus
     */
    @GetMapping("/list")
    public List<Map<String, Object>> getPostList(@RequestParam("gid") String gallId) {
        // PostService에서 해당 갤러리의 최신 글 목록을 가져옵니다.
        return postService.getPostsByGallery(gallId);
    }

    /**
     * 2. 실시간 인기 게시글 조회 (메인 페이지용)
     * GET /api/posts/recommend
     */
    @GetMapping("/recommend")
    public List<Map<String, Object>> getRecommendPosts() {
        // 전체 갤러리에서 조회수나 추천수가 높은 글을 가져오는 로직
        return postService.getTopRecommendedPosts();
    }

    /**
     * 3. 게시글 상세 조회
     * GET /api/posts/detail/1
     */
    @GetMapping("/detail/{postId}")
    public Map<String, Object> getPostDetail(@PathVariable("postId") Long postId) {
        return postService.getPostDetail(postId);
    }

    /**
     * 4. 게시글 작성 (로그인 필수)
     * 앞서 논의한 gallery_counter 참조 로직이 Service 계층에서 실행됨
     */
    @PostMapping("/write")
    public Map<String, Object> writePost(@RequestBody Map<String, String> payload,
                                         @SessionAttribute(name = "uid", required = false) String uid,
                                         @SessionAttribute(name = "nick", required = false) String nick) {

        // 세션 체크 (로그인 안 된 경우)
        if (uid == null) {
            return Map.of("success", false, "message", "로그인이 필요합니다.");
        }

        try {
            // 전달받은 데이터와 세션의 유저 정보를 조합하여 저장
            postService.insertPost(payload, uid, nick);
            return Map.of("success", true);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }
}