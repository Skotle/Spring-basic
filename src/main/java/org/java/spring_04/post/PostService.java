package org.java.spring_04.post;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
public class PostService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 1. 특정 갤러리의 게시글 목록 조회
     */
    public List<Map<String, Object>> getPostsByGallery(String gallId) {
        String sql = "SELECT * FROM post WHERE gall_id = ? ORDER BY id DESC LIMIT 20";
        return jdbcTemplate.queryForList(sql, gallId);
    }

    /**
     * 2. 실시간 인기 게시글 조회 (메인 페이지용)
     */
    public List<Map<String, Object>> getTopRecommendedPosts() {
        // 실제 운영 시에는 추천수(recommend)나 조회수 기준 필터링이 들어감
        String sql = "SELECT * FROM post ORDER BY id DESC LIMIT 5";
        return jdbcTemplate.queryForList(sql);
    }

    /**
     * 3. 게시글 상세 조회
     */
    public Map<String, Object> getPostDetail(Long postId) {
        String sql = "SELECT * FROM post WHERE id = ?";
        return jdbcTemplate.queryForMap(sql, postId);
    }

    /**
     * 4. 게시글 작성 (트랜잭션 보장)
     * gallery_counter 업데이트와 post 삽입이 동시에 이루어짐
     */
    @Transactional
    public void insertPost(Map<String, String> payload, String uid, String nick) {
        String gallId = payload.get("gid");
        String title = payload.get("title");
        String content = payload.get("content");

        // 로직 1: 카운터 테이블의 last_post_no를 1 증가시키고 그 값을 LAST_INSERT_ID에 저장
        String updateCounterSql =
                "UPDATE gallery_counter " +
                        "SET last_post_no = LAST_INSERT_ID(last_post_no + 1) " +
                        "WHERE gall_id = ?";

        int updatedRows = jdbcTemplate.update(updateCounterSql, gallId);

        // 해당 갤러리 카운터 데이터가 없을 경우 예외 처리
        if (updatedRows == 0) {
            throw new RuntimeException("해당 갤러리(gid: " + gallId + ")를 찾을 수 없습니다.");
        }

        // 로직 2: LAST_INSERT_ID()를 사용하여 post_no에 삽입
        String insertPostSql =
                "INSERT INTO post (gall_id, post_no, title, content, writer_uid, name) " +
                        "VALUES (?, LAST_INSERT_ID(), ?, ?, ?, ?)";

        jdbcTemplate.update(insertPostSql, gallId, title, content, uid, nick);
    }
}