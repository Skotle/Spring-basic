package org.java.spring_04.post;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class PostService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> getPostsByGallery(String gallId) {
        String sql = "SELECT * FROM post WHERE gall_id = ? ORDER BY id DESC LIMIT 20";
        return jdbcTemplate.queryForList(sql, gallId);
    }

    public List<Map<String, Object>> getTopRecommendedPosts() {
        String sql = "SELECT * FROM post ORDER BY id DESC LIMIT 5";
        return jdbcTemplate.queryForList(sql);
    }

    public Map<String, Object> getPostDetail(Long postId) {
        String sql = "SELECT * FROM post WHERE id = ?";
        return jdbcTemplate.queryForMap(sql, postId);
    }

    public Map<String, Object> getPostDetail(String gallId, Long postNo) {
        String sql = "SELECT * FROM post WHERE gall_id = ? AND post_no = ?";

        try {
            return jdbcTemplate.queryForMap(sql, gallId, postNo);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public List<Map<String, Object>> getComments(String gallId, Long postNo) {
        String sql = """
                SELECT id, writer_uid, name, ip, content, writed_at
                FROM comment
                WHERE gall_id = ?
                  AND post_no = ?
                  AND is_deleted = 0
                ORDER BY id ASC
                """;
        return jdbcTemplate.queryForList(sql, gallId, postNo);
    }

    @Transactional
    public Map<String, Object> insertPost(Map<String, String> payload, String uid, String nick, String clientIp) {
        String gallId = required(payload.get("gid"), "게시판 ID가 필요합니다.");
        String title = required(payload.get("title"), "제목을 입력해주세요.");
        String content = requiredHtml(payload.get("content"), "본문을 입력해주세요.");

        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);

        String updateCounterSql =
                "UPDATE gallery_counter " +
                        "SET last_post_no = LAST_INSERT_ID(last_post_no + 1) " +
                        "WHERE gall_id = ?";

        int updatedRows = jdbcTemplate.update(updateCounterSql, gallId);

        if (updatedRows == 0) {
            throw new RuntimeException("해당 갤러리 gid를 찾을 수 없습니다: " + gallId);
        }

        String insertPostSql =
                "INSERT INTO post (gall_id, post_no, title, content, writer_uid, name, ip, password) " +
                        "VALUES (?, LAST_INSERT_ID(), ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(
                insertPostSql,
                gallId,
                title,
                content,
                writer.uid(),
                writer.name(),
                writer.ip(),
                writer.passwordHash()
        );

        Integer createdPostNo = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Integer.class);
        return Map.of("success", true, "postNo", createdPostNo == null ? 0 : createdPostNo);
    }

    @Transactional
    public Map<String, Object> insertComment(Map<String, String> payload, String uid, String nick, String clientIp) {
        String gallId = required(payload.get("gid"), "게시판 ID가 필요합니다.");
        String content = required(payload.get("content"), "댓글 내용을 입력해주세요.");
        Long postNo = parseLong(payload.get("postNo"), "게시글 번호가 필요합니다.");

        if (findPostId(gallId, postNo) == null) {
            throw new RuntimeException("댓글을 달 게시글을 찾을 수 없습니다.");
        }

        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);

        String insertCommentSql =
                "INSERT INTO comment (gall_id, post_no, writer_uid, name, ip, password, content) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(
                insertCommentSql,
                gallId,
                postNo,
                writer.uid(),
                writer.name(),
                writer.ip(),
                writer.passwordHash(),
                content
        );

        jdbcTemplate.update(
                "UPDATE post SET comment_count = comment_count + 1 WHERE gall_id = ? AND post_no = ?",
                gallId,
                postNo
        );

        return Map.of("success", true);
    }

    private Long findPostId(String gallId, Long postNo) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT id FROM post WHERE gall_id = ? AND post_no = ?",
                    Long.class,
                    gallId,
                    postNo
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private WriterInfo resolveWriter(Map<String, String> payload, String uid, String nick, String clientIp) {
        if (uid != null && !uid.isBlank()) {
            String resolvedNick = (nick == null || nick.isBlank()) ? uid : nick;
            return new WriterInfo(uid, resolvedNick, normalizedIp(clientIp), null);
        }

        String guestName = required(payload.get("name"), "비회원은 이름을 입력해야 합니다.");
        String guestPassword = required(payload.get("password"), "비회원은 비밀번호를 입력해야 합니다.");
        return new WriterInfo(null, guestName, normalizedIp(clientIp), BCrypt.hashpw(guestPassword, BCrypt.gensalt()));
    }

    private String required(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new RuntimeException(message);
        }
        return value.trim();
    }

    private String requiredHtml(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new RuntimeException(message);
        }

        String normalized = value.trim();
        String plainText = normalized
                .replaceAll("(?i)<br\\s*/?>", " ")
                .replaceAll("<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .trim();

        if (plainText.isEmpty()) {
            throw new RuntimeException(message);
        }

        return normalized;
    }

    private String normalizedIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return "unknown";
        }
        return clientIp.trim();
    }

    private Long parseLong(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new RuntimeException(message);
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            throw new RuntimeException(message);
        }
    }

    private record WriterInfo(String uid, String name, String ip, String passwordHash) {
    }
}
