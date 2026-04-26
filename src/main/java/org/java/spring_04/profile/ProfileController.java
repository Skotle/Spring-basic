package org.java.spring_04.profile;

import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
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
            return Map.of("success", true, "data", profileService.getProfile(uid, uid));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @GetMapping("/{uid}")
    public Map<String, Object> getProfile(@PathVariable("uid") String targetUid,
                                          @SessionAttribute(name = "uid", required = false) String viewerUid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/" + targetUid);
        try {
            return Map.of("success", true, "data", profileService.getProfile(targetUid, viewerUid));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/me/settings")
    public Map<String, Object> saveMyProfileSettings(@RequestBody Map<String, String> payload,
                                                     @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/me/settings uid=" + uid);
        try {
            return Map.of("success", true, "data", profileService.saveProfileSettings(uid, payload));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/{uid}/follow")
    public Map<String, Object> follow(@PathVariable("uid") String targetUid,
                                      @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/" + targetUid + "/follow actor=" + uid);
        try {
            return Map.of("success", true, "data", profileService.follow(uid, targetUid));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }

    @PostMapping("/{uid}/unfollow")
    public Map<String, Object> unfollow(@PathVariable("uid") String targetUid,
                                        @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/profile/" + targetUid + "/unfollow actor=" + uid);
        try {
            return Map.of("success", true, "data", profileService.unfollow(uid, targetUid));
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }
}
