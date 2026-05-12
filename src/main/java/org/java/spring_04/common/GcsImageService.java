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
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class GcsImageService {
    private static final List<String> ALLOWED_CONTENT_TYPES = List.of(
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp",
            "image/avif",
            "image/heic",
            "image/heif"
    );
    private static final Map<String, String> EXTENSION_BY_CONTENT_TYPE = Map.ofEntries(
            Map.entry("image/jpeg", "jpg"),
            Map.entry("image/png", "png"),
            Map.entry("image/gif", "gif"),
            Map.entry("image/webp", "webp"),
            Map.entry("image/avif", "avif"),
            Map.entry("image/heic", "heic"),
            Map.entry("image/heif", "heif")
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
            throw new IllegalStateException("GCS 버킷 이름이 설정되지 않았습니다.");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("이미지 파일이 필요합니다.");
        }
        byte[] bytes = file.getBytes();
        String contentType = detectContentType(bytes);
        if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("JPG, PNG, GIF, WEBP, AVIF, HEIC, HEIF 이미지만 업로드할 수 있습니다.");
        }

        String extension = EXTENSION_BY_CONTENT_TYPE.get(contentType);
        String objectName = "uploads/images/" + LocalDate.now() + "/" + UUID.randomUUID() + "." + extension;

        BlobInfo blobInfo = BlobInfo.newBuilder(bucketName, objectName)
                .setContentType(contentType)
                .setCacheControl("public, max-age=31536000, immutable")
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
        String brand = isoBaseMediaBrand(bytes);
        if ("avif".equals(brand) || "avis".equals(brand)) {
            return "image/avif";
        }
        if (List.of("heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs").contains(brand)) {
            return "image/heic";
        }
        if (List.of("mif1", "msf1").contains(brand)) {
            return "image/heif";
        }
        return "";
    }

    private String isoBaseMediaBrand(byte[] bytes) {
        if (bytes == null || bytes.length < 12) {
            return null;
        }
        if (bytes[4] == 'f' && bytes[5] == 't' && bytes[6] == 'y' && bytes[7] == 'p') {
            return new String(bytes, 8, 4, StandardCharsets.US_ASCII).toLowerCase(Locale.ROOT);
        }
        return null;
    }

    private String buildPublicUrl(String objectName) {
        String encodedObjectName = URLEncoder.encode(objectName, StandardCharsets.UTF_8).replace("+", "%20");
        if (publicBaseUrl.contains("storage.googleapis.com")) {
            return publicBaseUrl + "/" + bucketName + "/" + encodedObjectName;
        }
        return publicBaseUrl + "/" + encodedObjectName;
    }
}
