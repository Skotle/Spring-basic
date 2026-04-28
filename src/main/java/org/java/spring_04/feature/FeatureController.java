package org.java.spring_04.feature;

import jakarta.servlet.http.HttpServletRequest;
import org.java.spring_04.common.RequestIpResolver;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/features")
public class FeatureController {
    private final FeatureService featureService;
    private final RequestIpResolver requestIpResolver;

    public FeatureController(FeatureService featureService, RequestIpResolver requestIpResolver) {
        this.featureService = featureService;
        this.requestIpResolver = requestIpResolver;
    }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam Map<String, String> params,
                                      @SessionAttribute(name = "uid", required = false) String uid,
                                      @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        try {
            List<Map<String, Object>> rows = featureService.searchPosts(params, uid, memberDivision);
            return Map.of("success", true, "posts", rows);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage(), "posts", List.of());
        }
    }

    @PostMapping("/boards/{gid}/join")
    public Map<String, Object> requestJoin(@PathVariable("gid") String gid,
                                           @RequestBody(required = false) Map<String, String> payload,
                                           @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.requestJoinBoard(gid, uid, payload == null ? null : payload.get("reason"));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/boards/{gid}/join/approve")
    public Map<String, Object> approveJoin(@PathVariable("gid") String gid,
                                           @RequestBody Map<String, String> payload,
                                           @SessionAttribute(name = "uid", required = false) String uid,
                                           @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        try {
            return featureService.approveJoinBoard(gid, payload.get("targetUid"), uid, memberDivision);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/posts/{gid}/{postNo}/scrap")
    public Map<String, Object> scrapPost(@PathVariable("gid") String gid,
                                         @PathVariable("postNo") Long postNo,
                                         @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.toggleScrap(gid, postNo, uid);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/posts/{gid}/{postNo}/report")
    public Map<String, Object> reportPost(@PathVariable("gid") String gid,
                                          @PathVariable("postNo") Long postNo,
                                          @RequestBody(required = false) Map<String, String> payload,
                                          HttpServletRequest request,
                                          @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.reportPost(gid, postNo, uid, extractClientIp(request), payload == null ? null : payload.get("reason"));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/posts/{gid}/{postNo}/concept/cancel")
    public Map<String, Object> cancelConcept(@PathVariable("gid") String gid,
                                             @PathVariable("postNo") Long postNo,
                                             @SessionAttribute(name = "uid", required = false) String uid,
                                             @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        try {
            return featureService.cancelConcept(gid, postNo, uid, memberDivision);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/comments/{commentId}/like")
    public Map<String, Object> likeComment(@PathVariable("commentId") Long commentId,
                                           HttpServletRequest request,
                                           @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.likeComment(commentId, uid, extractClientIp(request));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/comments/{commentId}/report")
    public Map<String, Object> reportComment(@PathVariable("commentId") Long commentId,
                                             @RequestBody(required = false) Map<String, String> payload,
                                             HttpServletRequest request,
                                             @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.reportComment(commentId, uid, extractClientIp(request), payload == null ? null : payload.get("reason"));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/blocks/{targetUid}")
    public Map<String, Object> blockUser(@PathVariable("targetUid") String targetUid,
                                         @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.blockUser(uid, targetUid);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @DeleteMapping("/blocks/{targetUid}")
    public Map<String, Object> unblockUser(@PathVariable("targetUid") String targetUid,
                                           @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.unblockUser(uid, targetUid);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @GetMapping("/notifications/settings")
    public Map<String, Object> getNotificationSettings(@SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return Map.of("success", true, "data", featureService.getNotificationSettings(uid));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/notifications/settings")
    public Map<String, Object> saveNotificationSettings(@RequestBody Map<String, String> payload,
                                                        @SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.saveNotificationSettings(uid, payload);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/notifications/read-all")
    public Map<String, Object> markAllRead(@SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.markAllAlarmsRead(uid);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/moderation/forbidden-words")
    public Map<String, Object> addForbiddenWord(@RequestBody Map<String, String> payload,
                                                @SessionAttribute(name = "uid", required = false) String uid,
                                                @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        try {
            return featureService.addForbiddenWord(payload.get("gallId"), payload.get("word"), payload.get("action"), uid, memberDivision);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/moderation/board-ban")
    public Map<String, Object> banFromBoard(@RequestBody Map<String, String> payload,
                                            @SessionAttribute(name = "uid", required = false) String uid,
                                            @SessionAttribute(name = "memberDivision", required = false) String memberDivision) {
        try {
            return featureService.banFromBoard(
                    payload.get("gallId"),
                    payload.get("targetUid"),
                    payload.get("targetIp"),
                    payload.get("reason"),
                    payload.get("expiresAt"),
                    uid,
                    memberDivision
            );
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/me/withdraw")
    public Map<String, Object> withdraw(@SessionAttribute(name = "uid", required = false) String uid) {
        try {
            return featureService.withdrawUser(uid);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    private String extractClientIp(HttpServletRequest request) {
        return requestIpResolver.resolve(request);
    }
}
