package org.java.spring_04.common;

import com.google.cloud.storage.BlobInfo;
import com.google.cloud.storage.Storage;
import com.google.cloud.storage.StorageOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Service
public class GcsImageService {
    private static final long MAX_IMAGE_BYTES = 50L * 1024L * 1024L;

    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
    );

    private final Storage storage;
    private final String bucketName;
    private final String publicBaseUrl;

    public GcsImageService(
            @Value("${app.gcs.bucket-name:}") String bucketName,
            @Value("${app.gcs.public-base-url:https://storage.googleapis.com}") String publicBaseUrl
    ) {
        this.storage = StorageOptions.getDefaultInstance().getService();
        this.bucketName = bucketName == null ? "" : bucketName.trim();
        this.publicBaseUrl = publicBaseUrl == null ? "https://storage.googleapis.com" : publicBaseUrl.replaceAll("/+$", "");
    }

    public String uploadImage(MultipartFile file) throws IOException {
        if (bucketName.isBlank()) {
            throw new IllegalStateException("GCS bucket name is not configured.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Image file is required.");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new IllegalArgumentException("Image file exceeds the 50MB limit.");
        }

        byte[] bytes = file.getBytes();
        String contentType = detectContentType(bytes);
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Only JPG, PNG, GIF, and WEBP image uploads are allowed.");
        }

        String originalFilename = file.getOriginalFilename() == null ? "image" : file.getOriginalFilename().replaceAll("[^A-Za-z0-9._-]", "_");
        String objectName = "uploads/" + LocalDate.now() + "/" + UUID.randomUUID() + "-" + originalFilename;

        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName)
                .setContentType(contentType)
                .build();

        storage.create(blobInfo, bytes);

        return buildPublicUrl(objectName);
    }

    private String detectContentType(byte[] bytes) {
        if (bytes == null || bytes.length < 12) {
            return "";
        }
        if ((bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8) {
            return "image/jpeg";
        }
        if ((bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47) {
            return "image/png";
        }
        if (bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F') {
            return "image/gif";
        }
        if (bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P') {
            return "image/webp";
        }
        return "";
    }

    private String buildPublicUrl(String objectName) {
        String encodedObjectName = URLEncoder.encode(objectName, StandardCharsets.UTF_8).replace("+", "%20");
        if (publicBaseUrl.contains("storage.googleapis.com")) {
            return publicBaseUrl + "/" + bucketName + "/" + encodedObjectName;
        }
        return publicBaseUrl + "/" + encodedObjectName;
    }
}
