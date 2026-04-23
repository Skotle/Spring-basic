package org.java.spring_04.board;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class BoardService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public List<Map<String, Object>> getBoardList() {
        String sql = "SELECT gall_id, gall_name, post_count FROM gallery ORDER BY gall_id ASC";
        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getPostsByGallery(String gallId, int page) {
        int size = 20;
        int offset = Math.max(page - 1, 0) * size;

        String sql = "SELECT * FROM post WHERE gall_id = ? ORDER BY id DESC LIMIT ? OFFSET ?";
        return jdbcTemplate.queryForList(sql, gallId, size, offset);
    }

    public Map<String, Object> getPostDetail(String gallId, Long postNo) {
        String sql = "SELECT * FROM post WHERE gall_id = ? AND post_no = ?";

        try {
            return jdbcTemplate.queryForMap(sql, gallId, postNo);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    @Transactional
    public void insertPost(Map<String, String> payload, String uid, String nick, String clientIp) {
        String gallId = required(payload.get("gid"), "갤러리 ID가 필요합니다.");
        String title = required(payload.get("title"), "제목을 입력해주세요.");
        String content = requiredHtml(payload.get("content"), "본문을 입력해주세요.");
        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);

        String updateCounterSql =
                "UPDATE gallery_counter " +
                        "SET last_post_no = LAST_INSERT_ID(last_post_no + 1), " +
                        "    post_count = LAST_INSERT_ID() " +
                        "WHERE gall_id = ?";

        int rows = jdbcTemplate.update(updateCounterSql, gallId);

        if (rows == 0) {
            throw new RuntimeException("해당 갤러리를 찾을 수 없습니다: " + gallId);
        }

        String updateGallerySql =
                "UPDATE gallery g " +
                        "JOIN gallery_counter gc ON g.gall_id = gc.gall_id " +
                        "SET g.post_count = gc.last_post_no " +
                        "WHERE g.gall_id = ?";

        jdbcTemplate.update(updateGallerySql, gallId);

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
    }

    @Transactional
    public void syncGalleryPostCount() {
        String sql = "UPDATE gallery g " +
                "JOIN gallery_counter gc ON g.gall_id = gc.gall_id " +
                "SET g.post_count = gc.last_post_no";

        int updatedRows = jdbcTemplate.update(sql);
        System.out.println("[Scheduler] " + updatedRows + "개의 갤러리 카운트를 동기화했습니다.");
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

    private record WriterInfo(String uid, String name, String ip, String passwordHash) {
    }
}
