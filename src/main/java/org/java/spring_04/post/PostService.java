package org.java.spring_04.post;

import jakarta.annotation.PostConstruct;
import org.java.spring_04.board.BoardService;
import org.java.spring_04.common.HtmlSanitizerService;
import org.java.spring_04.feature.FeatureService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

@Service
public class PostService {
    private static final ZoneId SEOUL_ZONE = ZoneId.of("Asia/Seoul");

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private BoardService boardService;

    @Autowired
    private FeatureService featureService;

    @Autowired
    private HtmlSanitizerService htmlSanitizerService;

    @PostConstruct
    public void initializePostSchema() {
        if (!columnExists("post", "recommend_count")) {
            jdbcTemplate.execute("ALTER TABLE post ADD COLUMN recommend_count INT NOT NULL DEFAULT 0");
        }
        if (!columnExists("post", "unrecommend_count")) {
            jdbcTemplate.execute("ALTER TABLE post ADD COLUMN unrecommend_count INT NOT NULL DEFAULT 0");
        }
        if (!columnExists("post", "view_count")) {
            jdbcTemplate.execute("ALTER TABLE post ADD COLUMN view_count INT NOT NULL DEFAULT 0");
        }
        if (!columnExists("post", "category")) {
            jdbcTemplate.execute("ALTER TABLE post ADD COLUMN category VARCHAR(50) NULL");
        }
        if (!columnExists("comment", "parent_id")) {
            jdbcTemplate.execute("ALTER TABLE comment ADD COLUMN parent_id INT NULL");
        }
        if (!columnExists("comment", "reply_depth")) {
            jdbcTemplate.execute("ALTER TABLE comment ADD COLUMN reply_depth INT NOT NULL DEFAULT 0");
        }
        if (!columnExists("comment", "sort_key")) {
            jdbcTemplate.execute("ALTER TABLE comment ADD COLUMN sort_key VARCHAR(255) NULL");
        }
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS post_vote (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    gall_id VARCHAR(50) NOT NULL,
                    post_no BIGINT NOT NULL,
                    actor_key VARCHAR(150) NOT NULL,
                    vote_type VARCHAR(20) NOT NULL,
                    vote_date DATE NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_post_vote_daily_type (gall_id, post_no, actor_key, vote_type, vote_date),
                    INDEX idx_post_vote_post_date (gall_id, post_no, vote_date)
                )
                """);
        if (indexExists("post_vote", "uq_post_vote_daily")) {
            jdbcTemplate.execute("ALTER TABLE post_vote DROP INDEX uq_post_vote_daily");
        }
        if (!indexExists("post_vote", "uq_post_vote_daily_type")) {
            jdbcTemplate.execute("""
                    ALTER TABLE post_vote
                    ADD UNIQUE INDEX uq_post_vote_daily_type (gall_id, post_no, actor_key, vote_type, vote_date)
                    """);
        }
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS gallery_counter (
                    gall_id VARCHAR(50) NOT NULL,
                    last_post_no INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (gall_id)
                )
                """);
    }

    public List<Map<String, Object>> getPostsByGallery(String gallId) {
        String sql = """
                SELECT p.*, g.gall_name,
                       author.nick_icon_type,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN board g ON g.gall_id = p.gall_id
                LEFT JOIN user author ON author.uid = p.writer_uid
                WHERE p.gall_id = ?
                  AND p.is_deleted = 0
                  AND COALESCE(p.is_draft, 0) = 0
                  AND COALESCE(p.is_secret, 0) = 0
                  AND COALESCE(p.review_status, 'normal') <> 'review'
                ORDER BY p.writed_at DESC, p.id DESC, p.post_no DESC
                LIMIT 20
                """;
        return decorateListRows(sanitizeRowsContent(jdbcTemplate.queryForList(sql, gallId)));
    }

    public List<Map<String, Object>> getTopRecommendedPosts() {
        String sql = """
                SELECT p.*, g.gall_name,
                       author.nick_icon_type,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN board g ON g.gall_id = p.gall_id
                LEFT JOIN user author ON author.uid = p.writer_uid
                WHERE p.is_deleted = 0
                  AND COALESCE(p.is_draft, 0) = 0
                  AND COALESCE(p.is_secret, 0) = 0
                  AND COALESCE(p.review_status, 'normal') <> 'review'
                ORDER BY p.recommend_count DESC, p.view_count DESC, p.id DESC
                LIMIT 5
                """;
        return decorateListRows(sanitizeRowsContent(jdbcTemplate.queryForList(sql)));
    }

    public Map<String, Object> getPostDetail(Long postId) {
        String updateSql = """
            UPDATE post
            SET view_count = view_count + 1
            WHERE id = ?
              AND is_deleted = 0
            """;

        String selectSql = """
            SELECT p.*, g.gall_name,
                   author.nick_icon_type,
                   (
                       SELECT COUNT(*)
                       FROM comment c
                       WHERE c.gall_id = p.gall_id
                         AND c.post_no = p.post_no
                         AND c.is_deleted = 0
                   ) AS comment_count
            FROM post p
            JOIN board g ON g.gall_id = p.gall_id
            LEFT JOIN user author ON author.uid = p.writer_uid
            WHERE p.id = ?
              AND p.is_deleted = 0
            """;

        try {
            int updated = jdbcTemplate.update(updateSql, postId);
            if (updated == 0) return null;
            return sanitizeRowContent(jdbcTemplate.queryForMap(selectSql, postId));
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public Map<String, Object> getPostDetail(String gallId, Long postNo) {
        String updateSql = """
            UPDATE post
            SET view_count = view_count + 1
            WHERE gall_id = ?
              AND post_no = ?
              AND is_deleted = 0
            """;

        String selectSql = """
            SELECT p.*, g.gall_name,
                   author.nick_icon_type,
                   (
                       SELECT COUNT(*)
                       FROM comment c
                       WHERE c.gall_id = p.gall_id
                         AND c.post_no = p.post_no
                         AND c.is_deleted = 0
                   ) AS comment_count
            FROM post p
            JOIN board g ON g.gall_id = p.gall_id
            LEFT JOIN user author ON author.uid = p.writer_uid
            WHERE p.gall_id = ?
              AND p.post_no = ?
              AND p.is_deleted = 0
            """;

        try {
            int updated = jdbcTemplate.update(updateSql, gallId, postNo);
            if (updated == 0) return null;
            return sanitizeRowContent(jdbcTemplate.queryForMap(selectSql, gallId, postNo));
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public List<Map<String, Object>> getComments(String gallId, Long postNo) {
        String sql = """
                SELECT c.id, c.writer_uid, c.name, c.ip, c.content, c.created_at AS writed_at,
                       c.parent_id, c.reply_depth, c.sort_key, c.like_count, c.report_count, c.review_status,
                       author.nick_icon_type
                FROM comment c
                JOIN post p ON p.gall_id = c.gall_id AND p.post_no = c.post_no
                LEFT JOIN user author ON author.uid = c.writer_uid
                WHERE c.gall_id = ?
                  AND c.post_no = ?
                  AND c.is_deleted = 0
                  AND COALESCE(c.review_status, 'normal') <> 'review'
                  AND p.is_deleted = 0
                ORDER BY COALESCE(c.sort_key, LPAD(c.id, 10, '0')) ASC, c.id ASC
        """;
        return sanitizeRowsContent(jdbcTemplate.queryForList(sql, gallId, postNo));
    }

    @Transactional
    public Map<String, Object> votePost(Map<String, String> payload, String uid, String clientIp) {
        String gallId = required(payload.get("gid"), "Board ID is required.");
        Long postNo = parseLong(payload.get("postNo"), "Post number is required.");
        String voteType = normalizeVoteType(payload.get("voteType"));

        Map<String, Object> post = findPostRow(gallId, postNo);
        if (post == null) {
            return Map.of("success", false, "message", "Post not found.");
        }

        String actorKey = resolveVoteActorKey(uid, clientIp);
        LocalDate today = LocalDate.now(SEOUL_ZONE);
        Integer alreadyVoted = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM post_vote
                WHERE gall_id = ?
                  AND post_no = ?
                  AND actor_key = ?
                  AND vote_type = ?
                  AND vote_date = ?
                """, Integer.class, gallId, postNo, actorKey, voteType, today);

        if (alreadyVoted != null && alreadyVoted > 0) {
            return Map.of(
                    "success", false,
                    "message", "You can only cast the same vote once per post each day.",
                    "post", getPostVoteMetrics(gallId, postNo),
                    "voteState", getVoteState(gallId, postNo, uid, clientIp)
            );
        }

        jdbcTemplate.update("""
                INSERT INTO post_vote (gall_id, post_no, actor_key, vote_type, vote_date)
                VALUES (?, ?, ?, ?, ?)
                """, gallId, postNo, actorKey, voteType, today);

        String counterColumn = "up".equals(voteType) ? "recommend_count" : "unrecommend_count";
        jdbcTemplate.update(
                "UPDATE post SET " + counterColumn + " = COALESCE(" + counterColumn + ", 0) + 1 WHERE gall_id = ? AND post_no = ? AND is_deleted = 0",
                gallId,
                postNo
        );

        featureService.refreshConceptState(gallId, postNo);
        return Map.of(
                "success", true,
                "message", "Vote recorded.",
                "post", getPostVoteMetrics(gallId, postNo),
                "voteState", getVoteState(gallId, postNo, uid, clientIp)
        );
    }

    public Map<String, Object> getVoteState(String gallId, Long postNo, String uid, String clientIp) {
        String actorKey = resolveVoteActorKey(uid, clientIp);
        LocalDate today = LocalDate.now(SEOUL_ZONE);
        List<String> voteTypes = jdbcTemplate.query("""
                SELECT vote_type
                FROM post_vote
                WHERE gall_id = ?
                  AND post_no = ?
                  AND actor_key = ?
                  AND vote_date = ?
                """, (rs, rowNum) -> rs.getString("vote_type"), gallId, postNo, actorKey, today);
        boolean upVoted = voteTypes.stream().anyMatch("up"::equals);
        boolean downVoted = voteTypes.stream().anyMatch("down"::equals);
        return Map.of(
                "canVote", !(upVoted && downVoted),
                "canUpvote", !upVoted,
                "canDownvote", !downVoted,
                "upVoted", upVoted,
                "downVoted", downVoted,
                "voteType", upVoted && downVoted ? "both" : upVoted ? "up" : downVoted ? "down" : "",
                "voteDate", today.toString()
        );
    }

    @Transactional
    public Map<String, Object> insertPost(Map<String, String> payload, String uid, String nick, String clientIp, String memberDivision) {
        String gallId = required(payload.get("gid"), "갤러리 ID가 필요합니다.");
        String title = required(payload.get("title"), "제목을 입력해주세요.");
        String content = requiredHtml(payload.get("content"), "본문을 입력해주세요.");
        String category = normalizePostCategory(gallId, payload.get("category"));

        featureService.assertBoardWritable(gallId, uid, memberDivision, clientIp);
        featureService.validateTextPolicy(gallId, title + "\n" + content);
        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);

        String updateCounterSql = """
                UPDATE gallery_counter
                SET last_post_no = last_post_no + 1
                WHERE gall_id = ?
                """;

        int updatedRows = jdbcTemplate.update(updateCounterSql, gallId);

        if (updatedRows == 0) {
            jdbcTemplate.update(
                    "INSERT INTO gallery_counter (gall_id, last_post_no) VALUES (?, 0) ON DUPLICATE KEY UPDATE last_post_no = last_post_no",
                    gallId
            );
            updatedRows = jdbcTemplate.update(updateCounterSql, gallId);
        }

        if (updatedRows == 0) {
            throw new RuntimeException("대상 보드를 찾을 수 없습니다: " + gallId);
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
                INSERT INTO post (gall_id, post_no, category, title, content, writer_uid, name, ip, password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """;

        jdbcTemplate.update(
                insertPostSql,
                gallId,
                createdPostNo,
                category,
                title,
                content,
                writer.uid(),
                writer.name(),
                writer.ip(),
                writer.passwordHash()
        );

        featureService.afterPostCreated(gallId, createdPostNo, uid, payload);
        return Map.of("success", true, "postNo", createdPostNo);
    }

    @Transactional
    public Map<String, Object> insertComment(Map<String, String> payload, String uid, String nick, String clientIp, String memberDivision) {
        String gallId = required(payload.get("gid"), "갤러리 ID가 필요합니다.");
        String content = requiredHtml(payload.get("content"), "댓글 내용을 입력해주세요.");
        Long postNo = parseLong(payload.get("postNo"), "게시글 번호가 필요합니다.");
        Long parentId = parseOptionalLong(payload.get("parentId"));

        if (findPostRef(gallId, postNo) == null) {
            throw new RuntimeException("댓글을 작성할 게시글을 찾을 수 없습니다.");
        }

        featureService.assertBoardWritable(gallId, uid, memberDivision, clientIp);
        featureService.validateTextPolicy(gallId, content);
        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);
        CommentParent parent = resolveCommentParent(gallId, postNo, parentId);

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement("""
                    INSERT INTO comment (gall_id, post_no, writer_uid, name, ip, password, content, parent_id, reply_depth, sort_key)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, Statement.RETURN_GENERATED_KEYS);
            ps.setString(1, gallId);
            ps.setLong(2, postNo);
            ps.setString(3, writer.uid());
            ps.setString(4, writer.name());
            ps.setString(5, writer.ip());
            ps.setString(6, writer.passwordHash());
            ps.setString(7, content);
            if (parent.parentId() == null) {
                ps.setObject(8, null);
            } else {
                ps.setLong(8, parent.parentId());
            }
            ps.setInt(9, parent.replyDepth());
            ps.setString(10, "");
            return ps;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new RuntimeException("댓글 ID를 생성하지 못했습니다.");
        }
        long commentId = key.longValue();
        String sortKey = parent.sortKeyPrefix() == null
                ? padCommentId(commentId)
                : parent.sortKeyPrefix() + "." + padCommentId(commentId);
        jdbcTemplate.update("UPDATE comment SET sort_key = ? WHERE id = ?", sortKey, commentId);

        featureService.afterCommentCreated(gallId, postNo, commentId, parentId, uid);
        return Map.of("success", true, "commentId", commentId);
    }

    @Transactional
    public Map<String, Object> deletePost(Map<String, String> payload, String uid, String memberDivision) {
        String gallId = required(payload.get("gid"), "갤러리 ID가 필요합니다.");
        Long postNo = parseLong(payload.get("postNo"), "게시글 번호가 필요합니다.");
        String password = nullableTrim(payload.get("password"));

        Map<String, Object> post = findPostRow(gallId, postNo);
        if (post == null) {
            return Map.of("success", false, "message", "게시글을 찾을 수 없습니다.");
        }

        if (!canDelete(post.get("writer_uid"), post.get("password"), uid, password, gallId, memberDivision)) {
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
    public Map<String, Object> deleteComment(Map<String, String> payload, String uid, String memberDivision) {
        Long commentId = parseLong(payload.get("commentId"), "댓글 ID가 필요합니다.");
        String password = nullableTrim(payload.get("password"));

        Map<String, Object> comment = findCommentRow(commentId);
        if (comment == null) {
            return Map.of("success", false, "message", "댓글을 찾을 수 없습니다.");
        }

        String gallId = String.valueOf(comment.get("gall_id"));

        if (!canDelete(comment.get("writer_uid"), comment.get("password"), uid, password, gallId, memberDivision)) {
            return Map.of("success", false, "message", "삭제 권한이 없습니다.");
        }
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
                    SELECT id, gall_id, post_no, writer_uid, ip, password, recommend_count, unrecommend_count, view_count
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

    private Map<String, Object> getPostVoteMetrics(String gallId, Long postNo) {
        return jdbcTemplate.queryForMap("""
                SELECT recommend_count, unrecommend_count, view_count
                FROM post
                WHERE gall_id = ?
                  AND post_no = ?
                  AND is_deleted = 0
                """, gallId, postNo);
    }

    private Map<String, Object> findCommentRow(Long commentId) {
        try {
            return jdbcTemplate.queryForMap(
                    """
                    SELECT id, gall_id, post_no, writer_uid, password, parent_id, reply_depth, sort_key
                    FROM comment
                    WHERE id = ?
                    """,
                    commentId
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private CommentParent resolveCommentParent(String gallId, Long postNo, Long parentId) {
        if (parentId == null) {
            return new CommentParent(null, 0, null);
        }
        Map<String, Object> parent = findCommentRow(parentId);
        if (parent == null) {
            throw new RuntimeException("상위 댓글을 찾을 수 없습니다.");
        }
        if (!gallId.equals(String.valueOf(parent.get("gall_id"))) || !postNo.equals(toLong(parent.get("post_no")))) {
            throw new RuntimeException("같은 게시글의 댓글에만 답글을 달 수 있습니다.");
        }
        int parentDepth = toInt(parent.get("reply_depth"));
        if (parentDepth >= 2) {
            throw new RuntimeException("답글은 최대 3계층까지만 작성할 수 있습니다.");
        }
        String parentSortKey = nullableText(parent.get("sort_key"));
        return new CommentParent(parentId, parentDepth + 1, parentSortKey);
    }

    private boolean canDelete(Object writerUid, Object passwordHash, String sessionUid, String rawPassword, String gallId, String memberDivision) {
        if (boardService.canManageBoard(gallId, sessionUid, memberDivision)) {
            return true;
        }

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

        String guestName = required(firstNonBlank(payload.get("name"), payload.get("guestName")), "비회원 이름을 입력해야 합니다.");
        String guestPassword = required(firstNonBlank(payload.get("password"), payload.get("guestPassword")), "비회원 비밀번호를 입력해야 합니다.");
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

        String normalized = htmlSanitizerService.sanitize(value);
        String plainText = htmlSanitizerService.extractPlainText(normalized);

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

    private String resolveVoteActorKey(String uid, String clientIp) {
        if (uid != null && !uid.isBlank()) {
            return "uid:" + uid.trim();
        }
        return "ip:" + normalizedIp(clientIp);
    }

    private String normalizeVoteType(String voteType) {
        String normalized = voteType == null ? "" : voteType.trim().toLowerCase();
        if (normalized.equals("up") || normalized.equals("recommend") || normalized.equals("like")) {
            return "up";
        }
        if (normalized.equals("down") || normalized.equals("unrecommend") || normalized.equals("dislike")) {
            return "down";
        }
        throw new RuntimeException("Vote type is invalid.");
    }

    private String normalizePostCategory(String gallId, String value) {
        String category = nullableTrim(value);
        Map<String, Object> settings = boardService.getBoardSettings(gallId);
        List<String> options = parseCategoryOptions(settings.get("category_options"));
        if (category == null) {
            return options.isEmpty() ? null : options.get(0);
        }
        if (!options.isEmpty() && !options.contains(category)) {
            throw new RuntimeException("이 보드에서 사용할 수 없는 말머리입니다.");
        }
        if (category.length() > 20) {
            throw new RuntimeException("말머리는 20자 이하로 입력해주세요.");
        }
        return category;
    }

    private List<String> parseCategoryOptions(Object value) {
        String raw = nullableTrim(value == null ? null : String.valueOf(value));
        if (raw == null) {
            return List.of();
        }
        return java.util.Arrays.stream(raw.split("[\\r\\n,]+"))
                .map(String::trim)
                .filter(text -> !text.isEmpty())
                .distinct()
                .toList();
    }

    private boolean columnExists(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, tableName, columnName);
        return count != null && count > 0;
    }

    private boolean indexExists(String tableName, String indexName) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND index_name = ?
                """, Integer.class, tableName, indexName);
        return count != null && count > 0;
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

    private Long parseOptionalLong(String value) {
        String normalized = nullableTrim(value);
        if (normalized == null) {
            return null;
        }
        try {
            return Long.parseLong(normalized);
        } catch (NumberFormatException e) {
            throw new RuntimeException("댓글 대상이 올바르지 않습니다.");
        }
    }

    private Long toLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private int toInt(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(String.valueOf(value));
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private String nullableTrim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String nullableText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String padCommentId(long commentId) {
        return String.format("%010d", commentId);
    }

    private List<Map<String, Object>> sanitizeRowsContent(List<Map<String, Object>> rows) {
        rows.forEach(this::sanitizeRowContent);
        return rows;
    }

    private Map<String, Object> sanitizeRowContent(Map<String, Object> row) {
        if (row == null) {
            return null;
        }
        Object rawContent = row.get("content");
        if (rawContent != null) {
            String sanitized = htmlSanitizerService.sanitize(String.valueOf(rawContent));
            row.put("content", sanitized);
            row.put("has_image", sanitized.toLowerCase().contains("<img"));
        }
        row.put("name", formatDisplayName(nullableText(row.get("name")), nullableText(row.get("writer_uid")), nullableText(row.get("ip"))));
        String gallId = nullableText(row.get("gall_id"));
        if (gallId != null) {
            String displayCategory = normalizeDisplayCategory(gallId, nullableText(row.get("category")));
            row.put("display_category", displayCategory);
            row.put("category", displayCategory);
        }
        return row;
    }

    private List<Map<String, Object>> decorateListRows(List<Map<String, Object>> rows) {
        rows.forEach((row) -> {
            if (Boolean.TRUE.equals(row.get("has_image")) || "1".equals(String.valueOf(row.get("has_image")))) {
                String title = nullableText(row.get("title"));
                if (title != null && !title.startsWith("[IMG] ")) {
                    row.put("title", "[IMG] " + title);
                }
            }
        });
        return rows;
    }

    private String formatDisplayName(String name, String writerUid, String ip) {
        String resolved = firstNonBlank(name, writerUid, "익명");
        if (writerUid != null && !writerUid.isBlank()) {
            return resolved;
        }
        return resolved + "(" + guestIpPrefix(ip) + ")";
    }

    private String guestIpPrefix(String ip) {
        String normalized = nullableText(ip);
        if (normalized == null || normalized.isBlank()) {
            return "ip";
        }
        String[] parts = normalized.split("\\.");
        if (parts.length >= 2) {
            return parts[0] + "." + parts[1];
        }
        return normalized.length() <= 7 ? normalized : normalized.substring(0, 7);
    }

    private String normalizeDisplayCategory(String gallId, String category) {
        List<String> options = parseCategoryOptions(boardService.getBoardSettings(gallId).get("category_options"));
        if (category != null && !category.isBlank() && (options.isEmpty() || options.contains(category))) {
            return category;
        }
        return options.isEmpty() ? "일반" : options.get(0);
    }

    private record WriterInfo(String uid, String name, String ip, String passwordHash) {
    }

    private record PostRef(Long id, Long postNo) {
    }

    private record CommentParent(Long parentId, int replyDepth, String sortKeyPrefix) {
    }
}
