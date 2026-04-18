package org.java.spring_04.board;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
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
    public void insertPost(Map<String, String> payload, String uid, String nick) {
        String gallId = payload.get("gid");
        String title = payload.get("title");
        String content = payload.get("content");

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
                "INSERT INTO post (gall_id, post_no, title, content, writer_uid, name) " +
                        "VALUES (?, LAST_INSERT_ID(), ?, ?, ?, ?)";

        jdbcTemplate.update(insertPostSql, gallId, title, content, uid, nick);
    }

    @Transactional
    public void syncGalleryPostCount() {
        String sql = "UPDATE gallery g " +
                "JOIN gallery_counter gc ON g.gall_id = gc.gall_id " +
                "SET g.post_count = gc.last_post_no";

        int updatedRows = jdbcTemplate.update(sql);
        System.out.println("[Scheduler] " + updatedRows + "개의 갤러리 카운트를 동기화했습니다.");
    }
}
