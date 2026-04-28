package org.java.spring_04.post;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.SessionAttribute;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Controller
public class PostPageController {

    private final PostService postService;

    public PostPageController(PostService postService) {
        this.postService = postService;
    }

    @PostMapping("/board/{gid}/{postNo}/vote")
    public String vote(@PathVariable("gid") String gid,
                       @PathVariable("postNo") Long postNo,
                       @RequestParam("voteType") String voteType,
                       @RequestParam(value = "page", defaultValue = "1") int page,
                       @SessionAttribute(name = "uid", required = false) String uid,
                       HttpServletRequest request,
                       RedirectAttributes redirectAttributes) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        String clientIp = extractClientIp(request);
        System.out.println("[" + LocalDateTime.now() + "] PAGE POST /board/" + gid + "/" + postNo + "/vote voteType=" + voteType + " actor=" + actor + " ip=" + clientIp);
        Map<String, Object> result = postService.votePost(
                Map.of("gid", gid, "postNo", String.valueOf(postNo), "voteType", voteType),
                uid,
                clientIp
        );
        System.out.println("[" + LocalDateTime.now() + "] PAGE POST RESULT /board/" + gid + "/" + postNo + "/vote success=" + result.get("success") + " message=" + result.get("message"));
        putFlash(redirectAttributes, result, "Vote recorded.");
        return "redirect:/board/" + gid + "/" + postNo + "?page=" + normalizePage(page);
    }

    @PostMapping("/board/{gid}/{postNo}/comment")
    public String writeComment(@PathVariable("gid") String gid,
                               @PathVariable("postNo") Long postNo,
                               @RequestParam("content") String content,
                               @RequestParam(value = "page", defaultValue = "1") int page,
                               @RequestParam(value = "parentId", required = false) String parentId,
                               @RequestParam(value = "name", required = false) String name,
                                @RequestParam(value = "password", required = false) String password,
                                @SessionAttribute(name = "uid", required = false) String uid,
                                @SessionAttribute(name = "nick", required = false) String nick,
                                @SessionAttribute(name = "memberDivision", required = false) String memberDivision,
                                HttpServletRequest request,
                               RedirectAttributes redirectAttributes) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        String clientIp = extractClientIp(request);
        System.out.println("[" + LocalDateTime.now() + "] PAGE POST /board/" + gid + "/" + postNo + "/comment actor=" + actor + " ip=" + clientIp + " contentLength=" + (content == null ? 0 : content.length()));
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("gid", gid);
        payload.put("postNo", String.valueOf(postNo));
        payload.put("content", content == null ? "" : content);
        payload.put("parentId", parentId == null ? "" : parentId);
        payload.put("name", name == null ? "" : name);
        payload.put("password", password == null ? "" : password);

        try {
            Map<String, Object> result = postService.insertComment(payload, uid, nick, clientIp, memberDivision);
            System.out.println("[" + LocalDateTime.now() + "] PAGE POST RESULT /board/" + gid + "/" + postNo + "/comment success=" + result.get("success"));
            putFlash(redirectAttributes, result, "Comment added.");
        } catch (Exception e) {
            System.out.println("[" + LocalDateTime.now() + "] PAGE POST ERROR /board/" + gid + "/" + postNo + "/comment message=" + e.getMessage());
            redirectAttributes.addFlashAttribute("flashType", "error");
            redirectAttributes.addFlashAttribute("flashMessage", e.getMessage());
        }

        return "redirect:/board/" + gid + "/" + postNo + "?page=" + normalizePage(page);
    }

    @PostMapping("/board/{gid}/{postNo}/delete")
    public String deletePost(@PathVariable("gid") String gid,
                             @PathVariable("postNo") Long postNo,
                             @RequestParam(value = "page", defaultValue = "1") int page,
                             @RequestParam(value = "password", required = false) String password,
                             @SessionAttribute(name = "uid", required = false) String uid,
                             @SessionAttribute(name = "memberDivision", required = false) String memberDivision,
                             RedirectAttributes redirectAttributes) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        System.out.println("[" + LocalDateTime.now() + "] PAGE POST /board/" + gid + "/" + postNo + "/delete actor=" + actor + " memberDivision=" + memberDivision + " passwordProvided=" + (password != null && !password.isBlank()));
        Map<String, Object> result = postService.deletePost(
                Map.of(
                        "gid", gid,
                        "postNo", String.valueOf(postNo),
                        "password", password == null ? "" : password
                ),
                uid,
                memberDivision
        );
        System.out.println("[" + LocalDateTime.now() + "] PAGE POST RESULT /board/" + gid + "/" + postNo + "/delete success=" + result.get("success") + " message=" + result.get("message"));
        putFlash(redirectAttributes, result, "Post deleted.");
        return "redirect:/board/" + gid + "?page=" + normalizePage(page);
    }

    @PostMapping("/board/{gid}/{postNo}/comment/{commentId}/delete")
    public String deleteComment(@PathVariable("gid") String gid,
                                @PathVariable("postNo") Long postNo,
                                @PathVariable("commentId") Long commentId,
                                @RequestParam(value = "page", defaultValue = "1") int page,
                                @RequestParam(value = "password", required = false) String password,
                                @SessionAttribute(name = "uid", required = false) String uid,
                                @SessionAttribute(name = "memberDivision", required = false) String memberDivision,
                                RedirectAttributes redirectAttributes) {
        String actor = uid == null || uid.isBlank() ? "guest" : uid;
        System.out.println("[" + LocalDateTime.now() + "] PAGE POST /board/" + gid + "/" + postNo + "/comment/" + commentId + "/delete actor=" + actor + " memberDivision=" + memberDivision + " passwordProvided=" + (password != null && !password.isBlank()));
        Map<String, Object> result = postService.deleteComment(
                Map.of(
                        "commentId", String.valueOf(commentId),
                        "password", password == null ? "" : password
                ),
                uid,
                memberDivision
        );
        System.out.println("[" + LocalDateTime.now() + "] PAGE POST RESULT /board/" + gid + "/" + postNo + "/comment/" + commentId + "/delete success=" + result.get("success") + " message=" + result.get("message"));
        putFlash(redirectAttributes, result, "Comment deleted.");
        return "redirect:/board/" + gid + "/" + postNo + "?page=" + normalizePage(page);
    }

    private void putFlash(RedirectAttributes redirectAttributes, Map<String, Object> result, String successMessage) {
        boolean success = Boolean.TRUE.equals(result.get("success"));
        redirectAttributes.addFlashAttribute("flashType", success ? "success" : "error");
        redirectAttributes.addFlashAttribute("flashMessage", String.valueOf(result.getOrDefault("message", successMessage)));
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

    private int normalizePage(int page) {
        return page < 1 ? 1 : page;
    }
}
