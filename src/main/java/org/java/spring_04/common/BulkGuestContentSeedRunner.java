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
    private static final String SEED_KEY = "bulk_guest_content_v2_ordered";
    private static final List<String> TARGET_GALLERIES = List.of("alpha", "beta", "marine", "stockus", "uspolitics");
    private static final int POSTS_PER_GALLERY = 240;
    private static final int EXTRA_COMMENT_POSTS = 300;
    private static final String GUEST_PASSWORD_RAW = "guest1234";
    private static final LocalDateTime BASE_WRITED_AT = LocalDateTime.of(2026, 1, 1, 0, 0);

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
            System.out.println("[SEED] Ordered bulk guest content seed already completed. Skipping.");
            return;
        }

        transactionTemplate.executeWithoutResult(status -> {
            validateTargetGalleries();
            ensureGalleryCounters();
            purgeExistingContent();

            String guestPasswordHash = BCrypt.hashpw(GUEST_PASSWORD_RAW, BCrypt.gensalt(10));
            Random random = new Random(20260427L);

            List<PostSeedRow> postRows = new ArrayList<>();
            List<CommentSeedRow> commentRows = new ArrayList<>();
            int globalPostIndex = 0;

            for (String gallId : TARGET_GALLERIES) {
                for (int i = 0; i < POSTS_PER_GALLERY; i++) {
                    long postNo = i + 1L;
                    int localIndex = i + 1;
                    String writerName = guestName(globalPostIndex + 1);
                    String ip = guestIp(random, globalPostIndex);
                    LocalDateTime wroteAt = BASE_WRITED_AT.plusMinutes(globalPostIndex);

                    postRows.add(new PostSeedRow(
                            gallId,
                            postNo,
                            postTitle(gallId, localIndex),
                            postContent(gallId, localIndex),
                            writerName,
                            ip,
                            guestPasswordHash,
                            10 + (globalPostIndex % 200),
                            globalPostIndex % 25,
                            globalPostIndex % 7,
                            wroteAt
                    ));

                    commentRows.add(new CommentSeedRow(
                            gallId,
                            postNo,
                            guestName(globalPostIndex + 10001),
                            guestIp(random, globalPostIndex + 10001),
                            guestPasswordHash,
                            commentContent(gallId, localIndex, 1),
                            wroteAt.plusMinutes(5)
                    ));

                    if (globalPostIndex < EXTRA_COMMENT_POSTS) {
                        commentRows.add(new CommentSeedRow(
                                gallId,
                                postNo,
                                guestName(globalPostIndex + 20001),
                                guestIp(random, globalPostIndex + 20001),
                                guestPasswordHash,
                                commentContent(gallId, localIndex, 2),
                                wroteAt.plusMinutes(15)
                        ));
                    }

                    globalPostIndex++;
                }

                jdbcTemplate.update(
                        "UPDATE gallery_counter SET last_post_no = ? WHERE gall_id = ?",
                        POSTS_PER_GALLERY,
                        gallId
                );
            }

            batchInsertPosts(postRows);
            batchInsertComments(commentRows);
            normalizeInsertedCommentSortKeys();
            refreshCommentCounts();
            refreshGalleryPostCounts();
            markSeedCompleted(postRows.size(), commentRows.size());

            System.out.println("[SEED] Ordered bulk guest content inserted successfully. posts="
                    + postRows.size() + " comments=" + commentRows.size());
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
                        last_post_no = VALUES(last_post_no)
                    """, gallId, gallId);
        }
    }

    private void purgeExistingContent() {
        jdbcTemplate.update("DELETE FROM comment");
        jdbcTemplate.update("DELETE FROM post");
        jdbcTemplate.update("UPDATE gallery_counter SET last_post_no = 0");
        jdbcTemplate.update("UPDATE gallery SET post_count = 0");
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
                """, SEED_KEY, postCount, commentCount, "Ordered bulk guest seed for alpha,beta,marine,stockus,uspolitics");
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
            case "alpha" -> "[알파] 순번 글 " + localIndex;
            case "beta" -> "[베타] 순번 글 " + localIndex;
            case "marine" -> "[마린] 순번 글 " + localIndex;
            case "stockus" -> "[미국주식] 순번 글 " + localIndex;
            case "uspolitics" -> "[미국정치] 순번 글 " + localIndex;
            default -> "[테스트] 순번 글 " + localIndex;
        };
    }

    private String postContent(String gallId, int localIndex) {
        return """
                <p>자동 생성된 비회원 테스트 게시글입니다.</p>
                <p><strong>보드:</strong> %s</p>
                <p><strong>포스트 번호:</strong> %d</p>
                <p><strong>표시 순서:</strong> 날짜와 포스트 번호가 함께 오름차순으로 맞춰져 있습니다.</p>
                <p>목록에서 오래된 글부터 최신 글까지 시간과 번호가 같은 흐름으로 보이도록 재생성한 데이터입니다.</p>
                <p>본문은 HTML 형식으로 저장됩니다.</p>
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
