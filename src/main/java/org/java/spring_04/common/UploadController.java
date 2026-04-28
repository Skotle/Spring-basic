package org.java.spring_04.common;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.SessionAttribute;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequestMapping("/api/upload")
public class UploadController {

    private final GcsImageService gcsImageService;

    public UploadController(GcsImageService gcsImageService) {
        this.gcsImageService = gcsImageService;
    }

    @PostMapping(value = "/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> uploadImage(@RequestParam("file") MultipartFile file,
                                                           @SessionAttribute(name = "uid", required = false) String uid) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/upload/image actor=" + (uid == null || uid.isBlank() ? "guest" : uid));
        if (uid == null || uid.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "로그인 후 이미지를 업로드할 수 있습니다."));
        }
        try {
            String url = gcsImageService.uploadImage(file);
            return ResponseEntity.ok(Map.of("success", true, "url", url));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
