package org.java.spring_04.common;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
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
    public Map<String, Object> uploadImage(@RequestParam("file") MultipartFile file) {
        System.out.println("[" + LocalDateTime.now() + "] API /api/upload/image");
        try {
            String url = gcsImageService.uploadImage(file);
            return Map.of("success", true, "url", url);
        } catch (Exception e) {
            return Map.of("success", false, "message", e.getMessage());
        }
    }
}
