package org.java.spring_04;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;

@Service
public class PostService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Transactional
    public Map<String, Object> getPostDetail(String gallId, int postNo) {
        try {
            // 1. 조회수 1 증가 (Atomic Update)
            String updateViewSql = "UPDATE post SET view_count = view_count + 1 WHERE gall_id = ? AND post_no = ?";
            jdbcTemplate.update(updateViewSql, gallId, postNo);

            // 2. 게시글 상세 정보 조회 (작성자 정보 포함)
            String selectSql =
                    "SELECT p.*, u.nick as writer_nick, u.nick_icon_type " +
                            "FROM post p " +
                            "LEFT JOIN user u ON p.writer_uid = u.uid " +
                            "WHERE p.gall_id = ? AND p.post_no = ? AND p.is_deleted = 0";

            var rows = jdbcTemplate.queryForList(selectSql, gallId, postNo);

            if (rows.isEmpty()) {
                return Map.of("success", false, "message", "존재하지 않거나 삭제된 게시글입니다.");
            }

            return Map.of("success", true, "data", rows.get(0));
        } catch (Exception e) {
            return Map.of("success", false, "message", "조회 중 오류 발생: " + e.getMessage());
        }
    }
}