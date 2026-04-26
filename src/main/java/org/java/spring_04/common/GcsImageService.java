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

    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/svg+xml"
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

        String contentType = normalizeContentType(file.getContentType());
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Only image uploads are allowed.");
        }

        String originalFilename = file.getOriginalFilename() == null ? "image" : file.getOriginalFilename().replaceAll("[^A-Za-z0-9._-]", "_");
        String objectName = "uploads/" + LocalDate.now() + "/" + UUID.randomUUID() + "-" + originalFilename;

        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName)
                .setContentType(contentType)
                .build();

        storage.create(blobInfo, file.getBytes());

        return buildPublicUrl(objectName);
    }

    private String normalizeContentType(String contentType) {
        return contentType == null ? "" : contentType.trim().toLowerCase();
    }

    private String buildPublicUrl(String objectName) {
        String encodedObjectName = URLEncoder.encode(objectName, StandardCharsets.UTF_8).replace("+", "%20");
        if (publicBaseUrl.contains("storage.googleapis.com")) {
            return publicBaseUrl + "/" + bucketName + "/" + encodedObjectName;
        }
        return publicBaseUrl + "/" + encodedObjectName;
    }
}
