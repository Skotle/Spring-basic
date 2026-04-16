package org.java.spring_04.board;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class BoardService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 전체 보드(갤러리) 목록 조회
     */
    public List<Map<String, Object>> getBoardList() {
        String sql = "SELECT gall_id,gall_name,post_count FROM gallery ORDER BY gall_id ASC";
        return jdbcTemplate.queryForList(sql);
    }

    /**
     * 특정 보드의 게시글 목록 (페이징 적용)
     */
    public List<Map<String, Object>> getPostsByGallery(String gallId, int page) {
        int size = 20; // 한 페이지당 20개
        int offset = (page - 1) * size;

        String sql = "SELECT * FROM post WHERE gall_id = ? ORDER BY id DESC LIMIT ? OFFSET ?";
        return jdbcTemplate.queryForList(sql, gallId, size, offset);
    }

    /**
     * 게시글 작성 (트랜잭션 적용)
     */
    @Transactional
    public void insertPost(Map<String, String> payload, String uid, String nick) {
        String gallId = payload.get("gid");
        String title = payload.get("title");
        String content = payload.get("content");

        // 1. gallery_counter 테이블 업데이트 (번호 생성 및 자체 count 동기화)
        String updateCounterSql =
                "UPDATE gallery_counter " +
                        "SET last_post_no = LAST_INSERT_ID(last_post_no + 1), " +
                        "    post_count = LAST_INSERT_ID() " +
                        "WHERE gall_id = ?";

        int rows = jdbcTemplate.update(updateCounterSql, gallId);

        if (rows == 0) {
            throw new RuntimeException("해당 갤러리(gid: " + gallId + ")가 존재하지 않습니다.");
        }

        // 2. [추가] gallery 테이블의 post_count를 gallery_counter의 최신 번호와 동기화
        // LAST_INSERT_ID()는 세션 내에서 유지되므로 바로 사용 가능합니다.
        String updateGallerySql =
                "UPDATE gallery g\n" +
                        "JOIN gallery_counter gc ON g.gall_id = gc.gall_id\n" +
                        "SET g.post_count = gc.last_post_no;";

        jdbcTemplate.update(updateGallerySql, gallId);

        // 3. 실제 게시글 삽입
        String insertPostSql =
                "INSERT INTO post (gall_id, post_no, title, content, writer_uid, name) " +
                        "VALUES (?, LAST_INSERT_ID(), ?, ?, ?, ?)";

        jdbcTemplate.update(insertPostSql, gallId, title, content, uid, nick);
    }

    /**
     * gallery 테이블의 post_count를 gallery_counter의 last_post_no로 일괄 동기화합니다.
     */
    @Transactional
    public void syncGalleryPostCount() {
        String sql = "UPDATE gallery g " +
                "JOIN gallery_counter gc ON g.gall_id = gc.gall_id " +
                "SET g.post_count = gc.last_post_no";

        int updatedRows = jdbcTemplate.update(sql);
        System.out.println("[Scheduler] " + updatedRows + "개의 갤러리 데이터 동기화 완료.");
    }
}