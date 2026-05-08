package org.java.spring_04.profile;

import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    private final ProfileService profileService;

    public ProfileController(ProfileService profileService) {
        this.profileService = profileService;
    }

    @GetMapping("/me")
    public Map<String, Object> getMyProfile(@SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/me");
        try {
            return success(profileService.getProfile(uid, uid));
        } catch (Exception e) {
            return failure(e);
        }
    }

    @GetMapping("/{uid}")
    public Map<String, Object> getProfile(@PathVariable("uid") String targetUid,
                                          @SessionAttribute(name = "uid", required = false) String viewerUid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/" + targetUid);
        try {
            return success(profileService.getProfile(targetUid, viewerUid));
        } catch (Exception e) {
            return failure(e);
        }
    }

    @PostMapping("/me/settings")
    public Map<String, Object> saveMyProfileSettings(@RequestBody Map<String, String> payload,
                                                     @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/me/settings uid=" + uid);
        try {
            return success(profileService.saveProfileSettings(uid, payload));
        } catch (Exception e) {
            return failure(e);
        }
    }

    @PostMapping("/me/history/delete")
    public Map<String, Object> deleteMyHistory(@RequestBody(required = false) Map<String, String> payload,
                                               @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/me/history/delete uid=" + uid);
        try {
            return success(profileService.deleteMyHistory(uid, payload == null ? null : payload.get("scope")));
        } catch (Exception e) {
            return failure(e);
        }
    }

    @PostMapping("/{uid}/follow")
    public Map<String, Object> follow(@PathVariable("uid") String targetUid,
                                      @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/" + targetUid + "/follow actor=" + uid);
        try {
            return success(profileService.follow(uid, targetUid));
        } catch (Exception e) {
            return failure(e);
        }
    }

    @PostMapping("/{uid}/unfollow")
    public Map<String, Object> unfollow(@PathVariable("uid") String targetUid,
                                        @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/" + targetUid + "/unfollow actor=" + uid);
        try {
            return success(profileService.unfollow(uid, targetUid));
        } catch (Exception e) {
            return failure(e);
        }
    }

    private Map<String, Object> success(Object data) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("data", data);
        return response;
    }

    private Map<String, Object> failure(Exception e) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("message", e.getMessage() == null ? "프로필 처리 중 오류가 발생했습니다." : e.getMessage());
        return response;
    }
}
