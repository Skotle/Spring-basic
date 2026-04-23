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
        String sql = """
                SELECT p.*, g.gall_name,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN gallery g ON g.gall_id = p.gall_id
                WHERE p.gall_id = ?
                  AND p.is_deleted = 0
                ORDER BY p.post_no DESC
                LIMIT 20
                """;
        return jdbcTemplate.queryForList(sql, gallId);
    }

    public List<Map<String, Object>> getTopRecommendedPosts() {
        String sql = """
                SELECT p.*, g.gall_name,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN gallery g ON g.gall_id = p.gall_id
                WHERE p.is_deleted = 0
                ORDER BY p.id DESC
                LIMIT 5
                """;
        return jdbcTemplate.queryForList(sql);
    }

    public Map<String, Object> getPostDetail(Long postId) {
        String sql = """
                SELECT p.*, g.gall_name,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN gallery g ON g.gall_id = p.gall_id
                WHERE p.id = ?
                  AND p.is_deleted = 0
                """;
        try {
            return jdbcTemplate.queryForMap(sql, postId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public Map<String, Object> getPostDetail(String gallId, Long postNo) {
        String sql = """
                SELECT p.*, g.gall_name,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN gallery g ON g.gall_id = p.gall_id
                WHERE p.gall_id = ?
                  AND p.post_no = ?
                  AND p.is_deleted = 0
                """;

        try {
            return jdbcTemplate.queryForMap(sql, gallId, postNo);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public List<Map<String, Object>> getComments(String gallId, Long postNo) {
        String sql = """
                SELECT c.id, c.writer_uid, c.name, c.ip, c.content, c.writed_at
                FROM comment c
                JOIN post p ON p.gall_id = c.gall_id AND p.post_no = c.post_no
                WHERE c.gall_id = ?
                  AND c.post_no = ?
                  AND c.is_deleted = 0
                  AND p.is_deleted = 0
                ORDER BY c.id ASC
                """;
        return jdbcTemplate.queryForList(sql, gallId, postNo);
    }

    @Transactional
    public Map<String, Object> insertPost(Map<String, String> payload, String uid, String nick, String clientIp) {
        String gallId = required(payload.get("gid"), "갤러리 ID가 필요합니다.");
        String title = required(payload.get("title"), "제목을 입력해 주세요.");
        String content = requiredHtml(payload.get("content"), "본문을 입력해 주세요.");

        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);

        String updateCounterSql = """
                UPDATE gallery_counter
                SET last_post_no = last_post_no + 1
                WHERE gall_id = ?
                """;

        int updatedRows = jdbcTemplate.update(updateCounterSql, gallId);

        if (updatedRows == 0) {
            throw new RuntimeException("해당 갤러리를 찾을 수 없습니다: " + gallId);
        }

        Integer createdPostNo = jdbcTemplate.queryForObject(
                "SELECT last_post_no FROM gallery_counter WHERE gall_id = ?",
                Integer.class,
                gallId
        );
        if (createdPostNo == null) {
            throw new RuntimeException("게시글 번호를 생성하지 못했습니다.");
        }

        String insertPostSql = """
                INSERT INTO post (gall_id, post_no, title, content, writer_uid, name, ip, password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """;

        jdbcTemplate.update(
                insertPostSql,
                gallId,
                createdPostNo,
                title,
                content,
                writer.uid(),
                writer.name(),
                writer.ip(),
                writer.passwordHash()
        );

        return Map.of("success", true, "postNo", createdPostNo);
    }

    @Transactional
    public Map<String, Object> insertComment(Map<String, String> payload, String uid, String nick, String clientIp) {
        String gallId = required(payload.get("gid"), "갤러리 ID가 필요합니다.");
        String content = required(payload.get("content"), "댓글 내용을 입력해 주세요.");
        Long postNo = parseLong(payload.get("postNo"), "게시글 번호가 필요합니다.");

        if (findPostRef(gallId, postNo) == null) {
            throw new RuntimeException("댓글을 작성할 게시글을 찾을 수 없습니다.");
        }

        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);

        String insertCommentSql = """
                INSERT INTO comment (gall_id, post_no, writer_uid, name, ip, password, content)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """;

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

        return Map.of("success", true);
    }

    @Transactional
    public Map<String, Object> deletePost(Map<String, String> payload, String uid) {
        String gallId = required(payload.get("gid"), "갤러리 ID가 필요합니다.");
        Long postNo = parseLong(payload.get("postNo"), "게시글 번호가 필요합니다.");
        String password = nullableTrim(payload.get("password"));

        Map<String, Object> post = findPostRow(gallId, postNo);
        if (post == null) {
            return Map.of("success", false, "message", "게시글을 찾을 수 없습니다.");
        }

        if (!canDelete(post.get("writer_uid"), post.get("password"), uid, password)) {
            return Map.of("success", false, "message", "삭제 권한이 없습니다.");
        }

        Long postId = toLong(post.get("id"));
        jdbcTemplate.update(
                "UPDATE post SET is_deleted = 1, title = '삭제된 게시글', content = '' WHERE id = ?",
                postId
        );
        jdbcTemplate.update(
                "UPDATE comment SET is_deleted = 1, content = '' WHERE gall_id = ? AND post_no = ?",
                gallId,
                postNo
        );

        return Map.of("success", true);
    }

    @Transactional
    public Map<String, Object> deleteComment(Map<String, String> payload, String uid) {
        Long commentId = parseLong(payload.get("commentId"), "댓글 ID가 필요합니다.");
        String password = nullableTrim(payload.get("password"));

        Map<String, Object> comment = findCommentRow(commentId);
        if (comment == null) {
            return Map.of("success", false, "message", "댓글을 찾을 수 없습니다.");
        }

        if (!canDelete(comment.get("writer_uid"), comment.get("password"), uid, password)) {
            return Map.of("success", false, "message", "삭제 권한이 없습니다.");
        }

        String gallId = String.valueOf(comment.get("gall_id"));
        Long postNo = toLong(comment.get("post_no"));

        int updated = jdbcTemplate.update(
                "UPDATE comment SET is_deleted = 1, content = '' WHERE id = ? AND is_deleted = 0",
                commentId
        );

        if (updated == 0) {
            return Map.of("success", false, "message", "이미 삭제된 댓글입니다.");
        }

        return Map.of("success", true);
    }

    private PostRef findPostRef(String gallId, Long postNo) {
        try {
            return jdbcTemplate.queryForObject(
                    """
                    SELECT id, post_no
                    FROM post
                    WHERE gall_id = ?
                      AND post_no = ?
                      AND is_deleted = 0
                    """,
                    (rs, rowNum) -> new PostRef(rs.getLong("id"), rs.getLong("post_no")),
                    gallId,
                    postNo
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private Map<String, Object> findPostRow(String gallId, Long postNo) {
        try {
            return jdbcTemplate.queryForMap(
                    """
                    SELECT id, gall_id, post_no, writer_uid, password
                    FROM post
                    WHERE gall_id = ?
                      AND post_no = ?
                      AND is_deleted = 0
                    """,
                    gallId,
                    postNo
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private Map<String, Object> findCommentRow(Long commentId) {
        try {
            return jdbcTemplate.queryForMap(
                    """
                    SELECT id, gall_id, post_no, writer_uid, password
                    FROM comment
                    WHERE id = ?
                    """,
                    commentId
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private boolean canDelete(Object writerUid, Object passwordHash, String sessionUid, String rawPassword) {
        String writerUidText = writerUid == null ? "" : String.valueOf(writerUid).trim();
        if (!writerUidText.isBlank()) {
            return sessionUid != null && !sessionUid.isBlank() && writerUidText.equals(sessionUid.trim());
        }

        if (rawPassword == null || rawPassword.isBlank()) {
            return false;
        }

        String savedPassword = passwordHash == null ? "" : String.valueOf(passwordHash);
        return passwordMatches(rawPassword, savedPassword);
    }

    private boolean passwordMatches(String rawPassword, String savedPassword) {
        if (savedPassword == null || savedPassword.isBlank()) {
            return false;
        }

        try {
            return BCrypt.checkpw(rawPassword, savedPassword);
        } catch (IllegalArgumentException e) {
            return savedPassword.equals(rawPassword);
        }
    }

    private WriterInfo resolveWriter(Map<String, String> payload, String uid, String nick, String clientIp) {
        if (uid != null && !uid.isBlank()) {
            String resolvedNick = (nick == null || nick.isBlank()) ? uid : nick;
            return new WriterInfo(uid, resolvedNick, normalizedIp(clientIp), null);
        }

        String guestName = required(firstNonBlank(payload.get("name"), payload.get("guestName")), "비회원은 이름을 입력해야 합니다.");
        String guestPassword = required(firstNonBlank(payload.get("password"), payload.get("guestPassword")), "비회원은 비밀번호를 입력해야 합니다.");
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

        String normalized = clientIp.trim();
        if (normalized.startsWith("::ffff:")) {
            normalized = normalized.substring(7);
        }
        if ("::1".equals(normalized) || "0:0:0:0:0:0:0:1".equals(normalized)) {
            return "127.0.0.1";
        }
        return normalized;
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

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }

    private String nullableTrim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private record WriterInfo(String uid, String name, String ip, String passwordHash) {
    }

    private record PostRef(Long id, Long postNo) {
    }
}
