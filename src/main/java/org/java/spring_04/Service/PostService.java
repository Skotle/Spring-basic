package org.java.spring_04.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PostService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Transactional // 번호 생성과 글 작성이 하나의 묶음으로 실행되어야 함
    public int createPost(String gallId, String title, String content, String uid, String name, String ip, String password) {

        // 1. 해당 갤러리의 카운터를 증가시키고 새 번호 획득
        String counterSql = "INSERT INTO gallery_counter (gall_id, last_post_no) VALUES (?, 1) " +
                "ON CONFLICT(gall_id) DO UPDATE SET last_post_no = last_post_no + 1";
        jdbcTemplate.update(counterSql, gallId);

        Integer postNo = jdbcTemplate.queryForObject(
                "SELECT last_post_no FROM gallery_counter WHERE gall_id = ?", Integer.class, gallId);

        // 2. 게시글 삽입 (회원/비회원 구분 반영)
        String insertSql = "INSERT INTO post (gall_id, post_no, title, content, writer_uid, name, ip, password) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        jdbcTemplate.update(insertSql, gallId, postNo, title, content,
                (uid != null && !uid.isEmpty()) ? uid : null, // 회원 ID
                name,
                (uid == null) ? ip : null, // 비회원일 때만 IP 저장
                password);

        return postNo;
    }
}