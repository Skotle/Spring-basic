package org.java.spring_04.common;

import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Random;

@Component
public class BulkGuestContentSeedRunner implements CommandLineRunner {
    private static final String SEED_KEY = "bulk_guest_content_v1";
    private static final List<String> TARGET_GALLERIES = List.of("alpha", "beta", "marine", "stockus", "uspolitics");
    private static final int POSTS_PER_GALLERY = 240;
    private static final int EXTRA_COMMENT_POSTS = 300;
    private static final String GUEST_PASSWORD_RAW = "guest1234";

    private final JdbcTemplate jdbcTemplate;
    private final TransactionTemplate transactionTemplate;

    public BulkGuestContentSeedRunner(JdbcTemplate jdbcTemplate, TransactionTemplate transactionTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.transactionTemplate = transactionTemplate;
    }

    @Override
    public void run(String... args) {
        ensureSeedHistoryTable();
        if (isAlreadySeeded()) {
            System.out.println("[SEED] Bulk guest content seed already completed. Skipping.");
            return;
        }

        transactionTemplate.executeWithoutResult(status -> {
            validateTargetGalleries();
            ensureGalleryCounters();

            String guestPasswordHash = BCrypt.hashpw(GUEST_PASSWORD_RAW, BCrypt.gensalt(10));
            Random random = new Random(20260426L);

            List<PostSeedRow> postRows = new ArrayList<>();
            List<CommentSeedRow> commentRows = new ArrayList<>();
            int postIndex = 0;

            for (String gallId : TARGET_GALLERIES) {
                long nextPostNo = nextPostNo(gallId);
                for (int i = 0; i < POSTS_PER_GALLERY; i++) {
                    long postNo = nextPostNo + i;
                    int localIndex = i + 1;
                    String writerName = guestName(postIndex + 1);
                    String ip = guestIp(random, postIndex);
                    LocalDateTime wroteAt = LocalDateTime.now().minusDays(random.nextInt(90)).minusMinutes(random.nextInt(1440));

                    postRows.add(new PostSeedRow(
                            gallId,
                            postNo,
                            postTitle(gallId, localIndex),
                            postContent(gallId, localIndex),
                            writerName,
                            ip,
                            guestPasswordHash,
                            random.nextInt(480),
                            random.nextInt(60),
                            random.nextInt(12),
                            wroteAt
                    ));

                    commentRows.add(new CommentSeedRow(
                            gallId,
                            postNo,
                            guestName(postIndex + 10001),
                            guestIp(random, postIndex + 10001),
                            guestPasswordHash,
                            commentContent(gallId, localIndex, 1),
                            wroteAt.plusMinutes(5L + random.nextInt(120))
                    ));

                    if (postIndex < EXTRA_COMMENT_POSTS) {
                        commentRows.add(new CommentSeedRow(
                                gallId,
                                postNo,
                                guestName(postIndex + 20001),
                                guestIp(random, postIndex + 20001),
                                guestPasswordHash,
                                commentContent(gallId, localIndex, 2),
                                wroteAt.plusMinutes(30L + random.nextInt(240))
                        ));
                    }

                    postIndex++;
                }

                long lastPostNo = nextPostNo + POSTS_PER_GALLERY - 1;
                jdbcTemplate.update("UPDATE gallery_counter SET last_post_no = ? WHERE gall_id = ?", lastPostNo, gallId);
            }

            batchInsertPosts(postRows);
            batchInsertComments(commentRows);
            normalizeInsertedCommentSortKeys();
            refreshCommentCounts();
            refreshGalleryPostCounts();
            markSeedCompleted(postRows.size(), commentRows.size());

            System.out.println("[SEED] Bulk guest content inserted successfully. posts=" + postRows.size() + " comments=" + commentRows.size());
        });
    }

    private void ensureSeedHistoryTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS app_seed_history (
                    seed_key VARCHAR(120) NOT NULL,
                    post_count INT NOT NULL DEFAULT 0,
                    comment_count INT NOT NULL DEFAULT 0,
                    note VARCHAR(255) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (seed_key)
                )
                """);
    }

    private boolean isAlreadySeeded() {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM app_seed_history WHERE seed_key = ?",
                Integer.class,
                SEED_KEY
        );
        return count != null && count > 0;
    }

    private void validateTargetGalleries() {
        List<String> missing = new ArrayList<>();
        for (String gallId : TARGET_GALLERIES) {
            Integer count = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM gallery WHERE gall_id = ?",
                    Integer.class,
                    gallId
            );
            if (count == null || count == 0) {
                missing.add(gallId);
            }
        }
        if (!missing.isEmpty()) {
            throw new IllegalStateException("Missing galleries for bulk seed: " + String.join(", ", missing));
        }
    }

    private void ensureGalleryCounters() {
        for (String gallId : TARGET_GALLERIES) {
            jdbcTemplate.update("""
                    INSERT INTO gallery_counter (gall_id, last_post_no)
                    VALUES (?, COALESCE((SELECT MAX(post_no) FROM post WHERE gall_id = ?), 0))
                    ON DUPLICATE KEY UPDATE
                        last_post_no = GREATEST(last_post_no, VALUES(last_post_no))
                    """, gallId, gallId);
        }
    }

    private long nextPostNo(String gallId) {
        Long current = jdbcTemplate.queryForObject(
                "SELECT COALESCE(last_post_no, 0) FROM gallery_counter WHERE gall_id = ?",
                Long.class,
                gallId
        );
        return (current == null ? 0L : current) + 1L;
    }

    private void batchInsertPosts(List<PostSeedRow> rows) {
        jdbcTemplate.batchUpdate("""
                INSERT INTO post (
                    gall_id, post_no, title, content, writer_uid, name, ip, password,
                    view_count, recommend_count, unrecommend_count, comment_count, writed_at
                )
                VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, ?)
                """, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                PostSeedRow row = rows.get(i);
                ps.setString(1, row.gallId());
                ps.setLong(2, row.postNo());
                ps.setString(3, row.title());
                ps.setString(4, row.content());
                ps.setString(5, row.name());
                ps.setString(6, row.ip());
                ps.setString(7, row.passwordHash());
                ps.setInt(8, row.viewCount());
                ps.setInt(9, row.recommendCount());
                ps.setInt(10, row.unrecommendCount());
                ps.setTimestamp(11, Timestamp.valueOf(row.writedAt()));
            }

            @Override
            public int getBatchSize() {
                return rows.size();
            }
        });
    }

    private void batchInsertComments(List<CommentSeedRow> rows) {
        jdbcTemplate.batchUpdate("""
                INSERT INTO comment (
                    gall_id, post_no, writer_uid, name, ip, password,
                    content, parent_id, reply_depth, sort_key, writed_at
                )
                VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, 0, '', ?)
                """, new BatchPreparedStatementSetter() {
            @Override
            public void setValues(PreparedStatement ps, int i) throws SQLException {
                CommentSeedRow row = rows.get(i);
                ps.setString(1, row.gallId());
                ps.setLong(2, row.postNo());
                ps.setString(3, row.name());
                ps.setString(4, row.ip());
                ps.setString(5, row.passwordHash());
                ps.setString(6, row.content());
                ps.setTimestamp(7, Timestamp.valueOf(row.writedAt()));
            }

            @Override
            public int getBatchSize() {
                return rows.size();
            }
        });
    }

    private void normalizeInsertedCommentSortKeys() {
        String placeholders = String.join(", ", TARGET_GALLERIES.stream().map(g -> "?").toList());
        List<Object> params = new ArrayList<>(TARGET_GALLERIES);
        jdbcTemplate.update(
                "UPDATE comment SET sort_key = LPAD(id, 10, '0') WHERE gall_id IN (" + placeholders + ") AND (sort_key IS NULL OR sort_key = '')",
                params.toArray()
        );
    }

    private void refreshCommentCounts() {
        String placeholders = String.join(", ", TARGET_GALLERIES.stream().map(g -> "?").toList());
        List<Object> params = new ArrayList<>(TARGET_GALLERIES);
        jdbcTemplate.update("""
                UPDATE post p
                SET comment_count = (
                    SELECT COUNT(*)
                    FROM comment c
                    WHERE c.gall_id = p.gall_id
                      AND c.post_no = p.post_no
                      AND c.is_deleted = 0
                )
                WHERE p.gall_id IN (""" + placeholders + ")",
                params.toArray()
        );
    }

    private void refreshGalleryPostCounts() {
        String placeholders = String.join(", ", TARGET_GALLERIES.stream().map(g -> "?").toList());
        List<Object> params = new ArrayList<>(TARGET_GALLERIES);
        jdbcTemplate.update("""
                UPDATE gallery g
                SET post_count = (
                    SELECT COUNT(*)
                    FROM post p
                    WHERE p.gall_id = g.gall_id
                      AND p.is_deleted = 0
                )
                WHERE g.gall_id IN (""" + placeholders + ")",
                params.toArray()
        );
    }

    private void markSeedCompleted(int postCount, int commentCount) {
        jdbcTemplate.update("""
                INSERT INTO app_seed_history (seed_key, post_count, comment_count, note)
                VALUES (?, ?, ?, ?)
                """, SEED_KEY, postCount, commentCount, "Bulk guest seed for alpha,beta,marine,stockus,uspolitics");
    }

    private String guestName(int index) {
        return String.format(Locale.ROOT, "guest%04d", index);
    }

    private String guestIp(Random random, int salt) {
        int a = 11 + (salt % 200);
        int b = 20 + random.nextInt(180);
        int c = 30 + random.nextInt(180);
        int d = 40 + random.nextInt(180);
        return a + "." + b + "." + c + "." + d;
    }

    private String postTitle(String gallId, int localIndex) {
        return switch (gallId) {
            case "alpha" -> "[알파] 테스트 게시글 " + localIndex;
            case "beta" -> "[베타] 샘플 토론 글 " + localIndex;
            case "marine" -> "[해병] 훈련 기록 " + localIndex;
            case "stockus" -> "[미국주식] 시황 메모 " + localIndex;
            case "uspolitics" -> "[미국정치] 브리핑 " + localIndex;
            default -> "[테스트] 더미 글 " + localIndex;
        };
    }

    private String postContent(String gallId, int localIndex) {
        return """
                <p>자동 생성된 비회원 더미 게시글입니다.</p>
                <p><strong>보드:</strong> %s</p>
                <p><strong>순번:</strong> %d</p>
                <p>이 글은 목록, 상세, 댓글, 추천, 검색 같은 흐름을 확인하기 위한 테스트 데이터입니다.</p>
                <p>본문은 HTML 형식으로 저장되며, 렌더링 확인용으로 문단과 강조 태그를 포함합니다.</p>
                """.formatted(gallId, localIndex);
    }

    private String commentContent(String gallId, int localIndex, int serial) {
        return "[%s] %d번 글의 비회원 댓글 %d".formatted(gallId, localIndex, serial);
    }

    private record PostSeedRow(
            String gallId,
            long postNo,
            String title,
            String content,
            String name,
            String ip,
            String passwordHash,
            int viewCount,
            int recommendCount,
            int unrecommendCount,
            LocalDateTime writedAt
    ) {
    }

    private record CommentSeedRow(
            String gallId,
            long postNo,
            String name,
            String ip,
            String passwordHash,
            String content,
            LocalDateTime writedAt
    ) {
    }
}
