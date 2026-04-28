package org.java.spring_04.feature;

import jakarta.annotation.PostConstruct;
import org.java.spring_04.common.HtmlSanitizerService;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class FeatureService {
    private final JdbcTemplate jdbcTemplate;
    private final HtmlSanitizerService htmlSanitizerService;

    public FeatureService(JdbcTemplate jdbcTemplate, HtmlSanitizerService htmlSanitizerService) {
        this.jdbcTemplate = jdbcTemplate;
        this.htmlSanitizerService = htmlSanitizerService;
    }

    @PostConstruct
    public void initializeFeatureSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS gallery_setting (
                    gall_id VARCHAR(50) NOT NULL,
                    board_notice TEXT NULL,
                    welcome_message TEXT NULL,
                    cover_image_url VARCHAR(500) NULL,
                    category_options TEXT NULL,
                    theme_color VARCHAR(20) NOT NULL DEFAULT '#ff8fab',
                    concept_recommend_threshold INT NOT NULL DEFAULT 10,
                    allow_guest_post TINYINT(1) NOT NULL DEFAULT 1,
                    allow_guest_comment TINYINT(1) NOT NULL DEFAULT 1,
                    updated_by VARCHAR(50) NULL,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (gall_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_ban (
                    ban_id BIGINT NOT NULL AUTO_INCREMENT,
                    gall_id VARCHAR(50) NOT NULL,
                    target_uid VARCHAR(50) NULL,
                    target_ip VARCHAR(45) NULL,
                    banned_by VARCHAR(50) NOT NULL,
                    reason VARCHAR(255) NULL,
                    banned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NULL,
                    PRIMARY KEY (ban_id)
                )
                """);
        addColumnIfMissing("gallery_setting", "join_policy", "VARCHAR(20) NOT NULL DEFAULT 'free'");
        addColumnIfMissing("gallery_setting", "visibility", "VARCHAR(20) NOT NULL DEFAULT 'public'");
        addColumnIfMissing("gallery_setting", "pinned_notice_count", "INT NOT NULL DEFAULT 3");
        addColumnIfMissing("gallery_setting", "allowed_attachment_types", "VARCHAR(255) NULL");
        addColumnIfMissing("gallery_setting", "attachment_max_bytes", "BIGINT NOT NULL DEFAULT 10485760");
        addColumnIfMissing("gallery_setting", "side_board_approval_policy", "VARCHAR(20) NOT NULL DEFAULT 'operator'");
        addColumnIfMissing("gallery_setting", "dormant_after_days", "INT NOT NULL DEFAULT 180");

        addColumnIfMissing("board", "last_activity_at", "DATETIME NULL");
        addColumnIfMissing("board", "dormant_notified_at", "DATETIME NULL");
        addColumnIfMissing("board", "dormant_at", "DATETIME NULL");

        addColumnIfMissing("post", "is_draft", "TINYINT(1) NOT NULL DEFAULT 0");
        addColumnIfMissing("post", "is_secret", "TINYINT(1) NOT NULL DEFAULT 0");
        addColumnIfMissing("post", "is_concept", "TINYINT(1) NOT NULL DEFAULT 0");
        addColumnIfMissing("post", "review_status", "VARCHAR(20) NOT NULL DEFAULT 'normal'");
        addColumnIfMissing("post", "report_count", "INT NOT NULL DEFAULT 0");
        addColumnIfMissing("post", "pinned_at", "DATETIME NULL");
        addColumnIfMissing("post", "pin_order", "INT NULL");
        addColumnIfMissing("post", "attachment_urls", "TEXT NULL");

        addColumnIfMissing("comment", "like_count", "INT NOT NULL DEFAULT 0");
        addColumnIfMissing("comment", "report_count", "INT NOT NULL DEFAULT 0");
        addColumnIfMissing("comment", "review_status", "VARCHAR(20) NOT NULL DEFAULT 'normal'");

        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_member (
                    gall_id VARCHAR(50) NOT NULL,
                    uid VARCHAR(50) NOT NULL,
                    member_role VARCHAR(30) NOT NULL DEFAULT 'member',
                    status VARCHAR(20) NOT NULL DEFAULT 'active',
                    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    approved_by VARCHAR(50) NULL,
                    PRIMARY KEY (gall_id, uid),
                    INDEX idx_board_member_uid (uid, status)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_join_request (
                    request_id BIGINT NOT NULL AUTO_INCREMENT,
                    gall_id VARCHAR(50) NOT NULL,
                    uid VARCHAR(50) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    reason TEXT NULL,
                    reviewed_by VARCHAR(50) NULL,
                    reviewed_at DATETIME NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (request_id),
                    UNIQUE KEY uq_board_join_pending (gall_id, uid, status)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS post_scrap (
                    uid VARCHAR(50) NOT NULL,
                    gall_id VARCHAR(50) NOT NULL,
                    post_no BIGINT NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (uid, gall_id, post_no),
                    INDEX idx_post_scrap_uid_created (uid, created_at)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS post_report (
                    report_id BIGINT NOT NULL AUTO_INCREMENT,
                    gall_id VARCHAR(50) NOT NULL,
                    post_no BIGINT NOT NULL,
                    reporter_key VARCHAR(150) NOT NULL,
                    reason VARCHAR(255) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (report_id),
                    UNIQUE KEY uq_post_report_actor (gall_id, post_no, reporter_key)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS comment_report (
                    report_id BIGINT NOT NULL AUTO_INCREMENT,
                    comment_id BIGINT NOT NULL,
                    reporter_key VARCHAR(150) NOT NULL,
                    reason VARCHAR(255) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (report_id),
                    UNIQUE KEY uq_comment_report_actor (comment_id, reporter_key)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS comment_reaction (
                    comment_id BIGINT NOT NULL,
                    actor_key VARCHAR(150) NOT NULL,
                    reaction_type VARCHAR(20) NOT NULL DEFAULT 'like',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (comment_id, actor_key)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_block (
                    blocker_uid VARCHAR(50) NOT NULL,
                    blocked_uid VARCHAR(50) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (blocker_uid, blocked_uid)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_notification_setting (
                    uid VARCHAR(50) NOT NULL,
                    in_app_enabled TINYINT(1) NOT NULL DEFAULT 1,
                    email_enabled TINYINT(1) NOT NULL DEFAULT 0,
                    follow_post_enabled TINYINT(1) NOT NULL DEFAULT 1,
                    comment_enabled TINYINT(1) NOT NULL DEFAULT 1,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (uid)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS forbidden_word (
                    word_id BIGINT NOT NULL AUTO_INCREMENT,
                    gall_id VARCHAR(50) NULL,
                    word VARCHAR(100) NOT NULL,
                    action VARCHAR(20) NOT NULL DEFAULT 'block',
                    created_by VARCHAR(50) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (word_id),
                    INDEX idx_forbidden_word_scope (gall_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS moderation_log (
                    log_id BIGINT NOT NULL AUTO_INCREMENT,
                    gall_id VARCHAR(50) NULL,
                    actor_uid VARCHAR(50) NULL,
                    target_uid VARCHAR(50) NULL,
                    target_ip VARCHAR(45) NULL,
                    action_type VARCHAR(50) NOT NULL,
                    reason VARCHAR(255) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (log_id),
                    INDEX idx_moderation_log_target (target_uid, target_ip)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_suspension (
                    uid VARCHAR(50) NOT NULL,
                    reason VARCHAR(255) NULL,
                    suspended_by VARCHAR(50) NULL,
                    suspended_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    expires_at DATETIME NULL,
                    PRIMARY KEY (uid)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS post_attachment (
                    attachment_id BIGINT NOT NULL AUTO_INCREMENT,
                    gall_id VARCHAR(50) NOT NULL,
                    post_no BIGINT NOT NULL,
                    url VARCHAR(1000) NOT NULL,
                    file_type VARCHAR(100) NULL,
                    file_size BIGINT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (attachment_id),
                    INDEX idx_post_attachment_post (gall_id, post_no)
                )
                """);
    }

    public void assertBoardReadable(String gallId, String uid, String memberDivision) {
        Map<String, Object> settings = getBoardSettings(gallId);
        String visibility = text(settings.get("visibility"), "public");
        if ("public".equalsIgnoreCase(visibility)) return;
        if (isAdmin(memberDivision) || isBoardStaff(gallId, uid) || isBoardMember(gallId, uid)) return;
        if ("members".equalsIgnoreCase(visibility)) {
            throw new RuntimeException("멤버 전용 보드입니다.");
        }
        throw new RuntimeException("비공개 보드입니다.");
    }

    public void assertBoardWritable(String gallId, String uid, String memberDivision, String clientIp) {
        assertBoardReadable(gallId, uid, memberDivision);
        assertNotBlocked(gallId, uid, clientIp);
        assertNotSuspended(uid);
    }

    public void validateTextPolicy(String gallId, String content) {
        String text = content == null ? "" : content.toLowerCase();
        List<Map<String, Object>> words = jdbcTemplate.queryForList("""
                SELECT word, action
                FROM forbidden_word
                WHERE gall_id IS NULL OR gall_id = ?
                """, gallId);
        for (Map<String, Object> row : words) {
            String word = text(row.get("word"), "").toLowerCase();
            if (!word.isBlank() && text.contains(word)) {
                String action = text(row.get("action"), "block");
                if ("warn".equalsIgnoreCase(action)) {
                    throw new RuntimeException("금칙어가 포함되어 있어 경고 처리되었습니다: " + word);
                }
                throw new RuntimeException("금칙어가 포함되어 게시할 수 없습니다: " + word);
            }
        }
    }

    @Transactional
    public void afterPostCreated(String gallId, long postNo, String writerUid, Map<String, String> payload) {
        int draft = flag(payload.get("isDraft")) ? 1 : 0;
        int secret = flag(payload.get("isSecret")) ? 1 : 0;
        String attachments = nullable(payload.get("attachments"));
        jdbcTemplate.update("""
                UPDATE post
                SET is_draft = ?,
                    is_secret = ?,
                    attachment_urls = ?,
                    review_status = CASE WHEN review_status IS NULL THEN 'normal' ELSE review_status END
                WHERE gall_id = ? AND post_no = ?
                """, draft, secret, attachments, gallId, postNo);
        touchBoard(gallId);
        if (attachments != null) {
            saveAttachments(gallId, postNo, attachments);
        }
        if (writerUid != null && !writerUid.isBlank() && draft == 0) {
            notifyFollowersForPost(writerUid, gallId, postNo);
        }
    }

    @Transactional
    public void afterCommentCreated(String gallId, long postNo, long commentId, Long parentId, String writerUid) {
        touchBoard(gallId);
        Map<String, Object> post = findPost(gallId, postNo);
        if (post != null) {
            String postWriter = nullable(post.get("writer_uid"));
            if (postWriter != null && !postWriter.equals(writerUid)) {
                createAlarm(postWriter, "post_comment", "내 글에 댓글이 등록되었습니다", gallId + "/" + postNo, "post_comment", gallId + ":" + postNo);
            }
        }
        if (parentId != null) {
            Map<String, Object> parent = findComment(parentId);
            String parentWriter = parent == null ? null : nullable(parent.get("writer_uid"));
            if (parentWriter != null && !parentWriter.equals(writerUid)) {
                createAlarm(parentWriter, "comment_reply", "내 댓글에 답글이 등록되었습니다", gallId + "/" + postNo, "comment_reply", String.valueOf(parentId));
            }
        }
    }

    public boolean canViewPost(Map<String, Object> post, String uid, String memberDivision) {
        if (post == null) return false;
        if (isAdmin(memberDivision)) return true;
        String gallId = text(post.get("gall_id"), "");
        if (isBoardStaff(gallId, uid)) return true;
        String writerUid = nullable(post.get("writer_uid"));
        boolean owner = writerUid != null && uid != null && writerUid.equals(uid);
        if (flagValue(post.get("is_draft")) && !owner) return false;
        if (flagValue(post.get("is_secret")) && !owner) return false;
        return !"review".equalsIgnoreCase(text(post.get("review_status"), "normal")) || owner;
    }

    @Transactional
    public Map<String, Object> toggleScrap(String gallId, long postNo, String uid) {
        String actor = required(uid, "로그인이 필요합니다.");
        Integer exists = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM post_scrap WHERE uid = ? AND gall_id = ? AND post_no = ?
                """, Integer.class, actor, gallId, postNo);
        if (exists != null && exists > 0) {
            jdbcTemplate.update("DELETE FROM post_scrap WHERE uid = ? AND gall_id = ? AND post_no = ?", actor, gallId, postNo);
            return Map.of("success", true, "scrapped", false);
        }
        jdbcTemplate.update("INSERT INTO post_scrap (uid, gall_id, post_no) VALUES (?, ?, ?)", actor, gallId, postNo);
        return Map.of("success", true, "scrapped", true);
    }

    @Transactional
    public Map<String, Object> reportPost(String gallId, long postNo, String uid, String clientIp, String reason) {
        String actorKey = actorKey(uid, clientIp);
        jdbcTemplate.update("""
                INSERT INTO post_report (gall_id, post_no, reporter_key, reason)
                VALUES (?, ?, ?, ?)
                """, gallId, postNo, actorKey, nullable(reason));
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM post_report WHERE gall_id = ? AND post_no = ?
                """, Integer.class, gallId, postNo);
        jdbcTemplate.update("""
                UPDATE post
                SET report_count = ?,
                    review_status = CASE WHEN ? >= 5 THEN 'review' ELSE review_status END
                WHERE gall_id = ? AND post_no = ?
                """, count == null ? 0 : count, count == null ? 0 : count, gallId, postNo);
        if (count != null && count >= 10) {
            suspendPostWriter(gallId, postNo, "누적 신고 기준 초과");
        }
        return Map.of("success", true, "reportCount", count == null ? 0 : count);
    }

    @Transactional
    public Map<String, Object> reportComment(long commentId, String uid, String clientIp, String reason) {
        String actorKey = actorKey(uid, clientIp);
        jdbcTemplate.update("""
                INSERT INTO comment_report (comment_id, reporter_key, reason)
                VALUES (?, ?, ?)
                """, commentId, actorKey, nullable(reason));
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM comment_report WHERE comment_id = ?", Integer.class, commentId);
        jdbcTemplate.update("""
                UPDATE comment
                SET report_count = ?,
                    review_status = CASE WHEN ? >= 5 THEN 'review' ELSE review_status END
                WHERE id = ?
                """, count == null ? 0 : count, count == null ? 0 : count, commentId);
        if (count != null && count >= 10) {
            suspendCommentWriter(commentId, "누적 신고 기준 초과");
        }
        return Map.of("success", true, "reportCount", count == null ? 0 : count);
    }

    @Transactional
    public Map<String, Object> likeComment(long commentId, String uid, String clientIp) {
        Map<String, Object> comment = requireComment(commentId);
        String writerUid = nullable(comment.get("writer_uid"));
        if (writerUid != null && uid != null && writerUid.equals(uid)) {
            return Map.of("success", false, "message", "본인 댓글에는 공감할 수 없습니다.");
        }
        String actorKey = actorKey(uid, clientIp);
        jdbcTemplate.update("""
                INSERT INTO comment_reaction (comment_id, actor_key, reaction_type)
                VALUES (?, ?, 'like')
                """, commentId, actorKey);
        jdbcTemplate.update("UPDATE comment SET like_count = like_count + 1 WHERE id = ?", commentId);
        return Map.of("success", true);
    }

    @Transactional
    public Map<String, Object> cancelConcept(String gallId, long postNo, String uid, String memberDivision) {
        if (!isAdmin(memberDivision) && !isBoardStaff(gallId, uid)) {
            return Map.of("success", false, "message", "개념글을 취소할 권한이 없습니다.");
        }
        jdbcTemplate.update("UPDATE post SET is_concept = 0 WHERE gall_id = ? AND post_no = ?", gallId, postNo);
        logModeration(gallId, uid, null, null, "concept_cancel", "manual");
        return Map.of("success", true);
    }

    @Transactional
    public void refreshConceptState(String gallId, long postNo) {
        Map<String, Object> settings = getBoardSettings(gallId);
        int threshold = number(settings.get("concept_recommend_threshold"), 10);
        jdbcTemplate.update("""
                UPDATE post
                SET is_concept = CASE WHEN recommend_count >= ? THEN 1 ELSE is_concept END
                WHERE gall_id = ? AND post_no = ? AND is_deleted = 0
                """, threshold, gallId, postNo);
    }

    public List<Map<String, Object>> searchPosts(Map<String, String> params, String viewerUid, String memberDivision) {
        String gallId = nullable(params.get("gallId"));
        String keyword = nullable(params.get("q"));
        String category = nullable(params.get("category"));
        String writer = nullable(params.get("writer"));
        String dateFrom = nullable(params.get("dateFrom"));
        String dateTo = nullable(params.get("dateTo"));

        StringBuilder sql = new StringBuilder("""
                SELECT p.*, b.gall_name
                FROM post p
                JOIN board b ON b.gall_id = p.gall_id
                LEFT JOIN gallery_setting gs ON gs.gall_id = p.gall_id
                WHERE p.is_deleted = 0
                  AND COALESCE(p.is_draft, 0) = 0
                  AND COALESCE(p.review_status, 'normal') <> 'review'
                  AND COALESCE(gs.visibility, 'public') = 'public'
                """);
        List<Object> args = new ArrayList<>();
        if (gallId != null) {
            sql.append(" AND p.gall_id = ?");
            args.add(gallId);
        }
        if (keyword != null) {
            sql.append(" AND (p.title LIKE CONCAT('%', ?, '%') OR p.content LIKE CONCAT('%', ?, '%'))");
            args.add(keyword);
            args.add(keyword);
        }
        if (category != null) {
            sql.append(" AND p.category = ?");
            args.add(category);
        }
        if (writer != null) {
            sql.append(" AND (p.writer_uid = ? OR p.name = ?)");
            args.add(writer);
            args.add(writer);
        }
        if (dateFrom != null) {
            sql.append(" AND p.writed_at >= ?");
            args.add(dateFrom);
        }
        if (dateTo != null) {
            sql.append(" AND p.writed_at < DATE_ADD(?, INTERVAL 1 DAY)");
            args.add(dateTo);
        }
        sql.append(" ORDER BY p.writed_at DESC, p.id DESC LIMIT 100");
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), args.toArray());
        rows.forEach(this::sanitizeRowContent);
        return rows;
    }

    @Transactional
    public Map<String, Object> requestJoinBoard(String gallId, String uid, String reason) {
        String actor = required(uid, "로그인이 필요합니다.");
        Map<String, Object> settings = getBoardSettings(gallId);
        String policy = text(settings.get("join_policy"), "free");
        if ("free".equalsIgnoreCase(policy)) {
            jdbcTemplate.update("""
                    INSERT INTO board_member (gall_id, uid, member_role, status)
                    VALUES (?, ?, 'member', 'active')
                    ON DUPLICATE KEY UPDATE status = 'active'
                    """, gallId, actor);
            return Map.of("success", true, "status", "active");
        }
        jdbcTemplate.update("""
                INSERT INTO board_join_request (gall_id, uid, reason, status)
                VALUES (?, ?, ?, 'pending')
                ON DUPLICATE KEY UPDATE reason = VALUES(reason)
                """, gallId, actor, nullable(reason));
        notifyBoardManagers(gallId, "board_join_request", "보드 가입 요청이 도착했습니다", actor + " joined request", "board_join", gallId);
        return Map.of("success", true, "status", "pending");
    }

    @Transactional
    public Map<String, Object> approveJoinBoard(String gallId, String targetUid, String actorUid, String memberDivision) {
        if (!isAdmin(memberDivision) && !isBoardStaff(gallId, actorUid)) {
            return Map.of("success", false, "message", "가입 요청을 승인할 권한이 없습니다.");
        }
        String target = required(targetUid, "대상 UID가 필요합니다.");
        jdbcTemplate.update("""
                INSERT INTO board_member (gall_id, uid, member_role, status, approved_by)
                VALUES (?, ?, 'member', 'active', ?)
                ON DUPLICATE KEY UPDATE status = 'active', approved_by = VALUES(approved_by)
                """, gallId, target, actorUid);
        jdbcTemplate.update("""
                UPDATE board_join_request
                SET status = 'approved', reviewed_by = ?, reviewed_at = NOW()
                WHERE gall_id = ? AND uid = ? AND status = 'pending'
                """, actorUid, gallId, target);
        createAlarm(target, "board_join_approved", "보드 가입이 승인되었습니다", gallId, "board_join", gallId);
        return Map.of("success", true);
    }

    @Transactional
    public Map<String, Object> blockUser(String blockerUid, String targetUid) {
        String blocker = required(blockerUid, "로그인이 필요합니다.");
        String target = required(targetUid, "차단할 사용자가 필요합니다.");
        if (blocker.equals(target)) return Map.of("success", false, "message", "본인은 차단할 수 없습니다.");
        jdbcTemplate.update("""
                INSERT INTO user_block (blocker_uid, blocked_uid)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE created_at = created_at
                """, blocker, target);
        return Map.of("success", true);
    }

    @Transactional
    public Map<String, Object> unblockUser(String blockerUid, String targetUid) {
        String blocker = required(blockerUid, "로그인이 필요합니다.");
        jdbcTemplate.update("DELETE FROM user_block WHERE blocker_uid = ? AND blocked_uid = ?", blocker, targetUid);
        return Map.of("success", true);
    }

    public Map<String, Object> getNotificationSettings(String uid) {
        String actor = required(uid, "로그인이 필요합니다.");
        try {
            return jdbcTemplate.queryForMap("SELECT * FROM user_notification_setting WHERE uid = ?", actor);
        } catch (EmptyResultDataAccessException e) {
            return Map.of("uid", actor, "in_app_enabled", true, "email_enabled", false, "follow_post_enabled", true, "comment_enabled", true);
        }
    }

    @Transactional
    public Map<String, Object> saveNotificationSettings(String uid, Map<String, String> payload) {
        String actor = required(uid, "로그인이 필요합니다.");
        int inApp = flag(payload.get("inAppEnabled")) ? 1 : 0;
        int email = flag(payload.get("emailEnabled")) ? 1 : 0;
        int followPost = flag(payload.get("followPostEnabled")) ? 1 : 0;
        int comment = flag(payload.get("commentEnabled")) ? 1 : 0;
        jdbcTemplate.update("""
                INSERT INTO user_notification_setting (uid, in_app_enabled, email_enabled, follow_post_enabled, comment_enabled, updated_at)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    in_app_enabled = VALUES(in_app_enabled),
                    email_enabled = VALUES(email_enabled),
                    follow_post_enabled = VALUES(follow_post_enabled),
                    comment_enabled = VALUES(comment_enabled),
                    updated_at = NOW()
                """, actor, inApp, email, followPost, comment);
        return Map.of("success", true, "data", getNotificationSettings(actor));
    }

    @Transactional
    public Map<String, Object> markAllAlarmsRead(String uid) {
        String actor = required(uid, "로그인이 필요합니다.");
        int updated = jdbcTemplate.update("UPDATE alarm SET is_read = 1, read_at = NOW() WHERE uid = ? AND is_read = 0", actor);
        return Map.of("success", true, "updated", updated);
    }

    @Transactional
    public Map<String, Object> addForbiddenWord(String gallId, String word, String action, String actorUid, String memberDivision) {
        if (!isAdmin(memberDivision) && !isBoardStaff(gallId, actorUid)) {
            return Map.of("success", false, "message", "금칙어를 설정할 권한이 없습니다.");
        }
        jdbcTemplate.update("""
                INSERT INTO forbidden_word (gall_id, word, action, created_by)
                VALUES (?, ?, ?, ?)
                """, nullable(gallId), required(word, "금칙어가 필요합니다."), text(action, "block"), actorUid);
        return Map.of("success", true);
    }

    @Transactional
    public Map<String, Object> banFromBoard(String gallId, String targetUid, String targetIp, String reason, String expiresAt, String actorUid, String memberDivision) {
        if (!isAdmin(memberDivision) && !isBoardStaff(gallId, actorUid)) {
            return Map.of("success", false, "message", "차단 권한이 없습니다.");
        }
        jdbcTemplate.update("""
                INSERT INTO board_ban (gall_id, target_uid, target_ip, banned_by, reason, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """, gallId, nullable(targetUid), nullable(targetIp), actorUid, nullable(reason), nullable(expiresAt));
        logModeration(gallId, actorUid, targetUid, targetIp, "board_ban", reason);
        return Map.of("success", true);
    }

    @Transactional
    public Map<String, Object> withdrawUser(String uid) {
        String actor = required(uid, "로그인이 필요합니다.");
        jdbcTemplate.update("UPDATE post SET writer_uid = NULL, name = '탈퇴한 사용자' WHERE writer_uid = ?", actor);
        jdbcTemplate.update("UPDATE comment SET writer_uid = NULL, name = '탈퇴한 사용자' WHERE writer_uid = ?", actor);
        jdbcTemplate.update("DELETE FROM user WHERE uid = ?", actor);
        return Map.of("success", true);
    }

    @Transactional
    public void runDormancyCheck() {
        List<Map<String, Object>> boards = jdbcTemplate.queryForList("""
                SELECT b.gall_id, b.manager_uid, COALESCE(b.last_activity_at, MAX(p.writed_at), NOW()) AS last_seen,
                       COALESCE(gs.dormant_after_days, 180) AS dormant_after_days
                FROM board b
                LEFT JOIN post p ON p.gall_id = b.gall_id
                LEFT JOIN gallery_setting gs ON gs.gall_id = b.gall_id
                WHERE b.gall_type = 'm'
                GROUP BY b.gall_id, b.manager_uid, b.last_activity_at, gs.dormant_after_days
                """);
        for (Map<String, Object> board : boards) {
            String gallId = text(board.get("gall_id"), "");
            String managerUid = nullable(board.get("manager_uid"));
            int days = number(board.get("dormant_after_days"), 180);
            Integer inactive = jdbcTemplate.queryForObject("""
                    SELECT DATEDIFF(NOW(), COALESCE(last_activity_at, NOW()))
                    FROM board
                    WHERE gall_id = ?
                    """, Integer.class, gallId);
            if (inactive != null && inactive >= Math.max(1, days - 7) && managerUid != null) {
                createAlarm(managerUid, "board_dormant_warning", "보드 휴면 전환 예정", gallId, "board", gallId);
                jdbcTemplate.update("UPDATE board SET dormant_notified_at = COALESCE(dormant_notified_at, NOW()) WHERE gall_id = ?", gallId);
            }
            if (inactive != null && inactive >= days) {
                jdbcTemplate.update("UPDATE board SET dormant_at = COALESCE(dormant_at, NOW()), status = 'dormant' WHERE gall_id = ?", gallId);
            }
        }
    }

    private void saveAttachments(String gallId, long postNo, String raw) {
        for (String url : raw.split("[\\r\\n,]+")) {
            String normalized = nullable(url);
            if (normalized != null) {
                jdbcTemplate.update("INSERT INTO post_attachment (gall_id, post_no, url) VALUES (?, ?, ?)", gallId, postNo, normalized);
            }
        }
    }

    private void notifyFollowersForPost(String writerUid, String gallId, long postNo) {
        List<String> followers = jdbcTemplate.query("""
                SELECT f.follower_uid
                FROM user_follow f
                LEFT JOIN user_notification_setting ns ON ns.uid = f.follower_uid
                WHERE f.following_uid = ?
                  AND COALESCE(ns.in_app_enabled, 1) = 1
                  AND COALESCE(ns.follow_post_enabled, 1) = 1
                """, (rs, rowNum) -> rs.getString("follower_uid"), writerUid);
        for (String follower : followers) {
            createAlarm(follower, "follow_post", "팔로우한 사용자가 글을 작성했습니다", gallId + "/" + postNo, "post", gallId + ":" + postNo);
        }
    }

    private void notifyBoardManagers(String gallId, String type, String title, String content, String refType, String refId) {
        List<String> targets = jdbcTemplate.query("""
                SELECT manager_uid AS uid FROM board WHERE gall_id = ? AND manager_uid IS NOT NULL
                UNION
                SELECT uid FROM board_submanager WHERE gall_id = ?
                """, (rs, rowNum) -> rs.getString("uid"), gallId, gallId);
        for (String target : targets) {
            createAlarm(target, type, title, content, refType, refId);
        }
    }

    private void createAlarm(String uid, String type, String title, String content, String refType, String refId) {
        if (uid == null || uid.isBlank()) return;
        Map<String, Object> settings = getNotificationSettings(uid);
        if (!flagValue(settings.get("in_app_enabled"))) return;
        jdbcTemplate.update("""
                INSERT INTO alarm (uid, alarm_type, title, content, ref_type, ref_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """, uid, type, title, content, refType, refId);
    }

    private void assertNotBlocked(String gallId, String uid, String ip) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM board_ban
                WHERE gall_id = ?
                  AND (expires_at IS NULL OR expires_at > NOW())
                  AND (
                      (target_uid IS NOT NULL AND target_uid = ?)
                      OR (target_ip IS NOT NULL AND target_ip = ?)
                  )
                """, Integer.class, gallId, uid, normalizedIp(ip));
        if (count != null && count > 0) throw new RuntimeException("해당 보드에서 차단된 사용자입니다.");
    }

    private void assertNotSuspended(String uid) {
        if (uid == null || uid.isBlank()) return;
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM user_suspension
                WHERE uid = ?
                  AND (expires_at IS NULL OR expires_at > NOW())
                """, Integer.class, uid);
        if (count != null && count > 0) throw new RuntimeException("서비스 이용이 일시 정지된 사용자입니다.");
    }

    private boolean isBoardMember(String gallId, String uid) {
        if (uid == null || uid.isBlank()) return false;
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM board_member WHERE gall_id = ? AND uid = ? AND status = 'active'
                """, Integer.class, gallId, uid);
        return count != null && count > 0;
    }

    private boolean isBoardStaff(String gallId, String uid) {
        if (uid == null || uid.isBlank()) return false;
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM (
                    SELECT manager_uid AS uid FROM board WHERE gall_id = ? AND manager_uid = ?
                    UNION ALL
                    SELECT uid FROM board_submanager WHERE gall_id = ? AND uid = ?
                ) staff
                """, Integer.class, gallId, uid, gallId, uid);
        return count != null && count > 0;
    }

    private boolean isAdmin(String memberDivision) {
        if (memberDivision == null) return false;
        String normalized = memberDivision.trim();
        return normalized.equals("1") || normalized.equalsIgnoreCase("admin") || normalized.equalsIgnoreCase("operator");
    }

    private Map<String, Object> getBoardSettings(String gallId) {
        try {
            return jdbcTemplate.queryForMap("SELECT * FROM gallery_setting WHERE gall_id = ?", gallId);
        } catch (EmptyResultDataAccessException e) {
            return Map.of(
                    "visibility", "public",
                    "join_policy", "free",
                    "concept_recommend_threshold", 10
            );
        }
    }

    private Map<String, Object> findPost(String gallId, long postNo) {
        try {
            return jdbcTemplate.queryForMap("SELECT * FROM post WHERE gall_id = ? AND post_no = ?", gallId, postNo);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private Map<String, Object> findComment(long commentId) {
        try {
            return jdbcTemplate.queryForMap("SELECT * FROM comment WHERE id = ?", commentId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private Map<String, Object> requireComment(long commentId) {
        Map<String, Object> comment = findComment(commentId);
        if (comment == null) throw new RuntimeException("댓글을 찾을 수 없습니다.");
        return comment;
    }

    private void touchBoard(String gallId) {
        jdbcTemplate.update("UPDATE board SET last_activity_at = NOW(), dormant_at = NULL WHERE gall_id = ?", gallId);
    }

    private void logModeration(String gallId, String actorUid, String targetUid, String targetIp, String actionType, String reason) {
        jdbcTemplate.update("""
                INSERT INTO moderation_log (gall_id, actor_uid, target_uid, target_ip, action_type, reason)
                VALUES (?, ?, ?, ?, ?, ?)
                """, gallId, actorUid, nullable(targetUid), nullable(targetIp), actionType, nullable(reason));
    }

    private void suspendPostWriter(String gallId, long postNo, String reason) {
        Map<String, Object> post = findPost(gallId, postNo);
        String writerUid = post == null ? null : nullable(post.get("writer_uid"));
        if (writerUid == null) return;
        jdbcTemplate.update("""
                INSERT INTO user_suspension (uid, reason, suspended_by, expires_at)
                VALUES (?, ?, 'system', DATE_ADD(NOW(), INTERVAL 7 DAY))
                ON DUPLICATE KEY UPDATE reason = VALUES(reason), suspended_at = NOW(), expires_at = VALUES(expires_at)
                """, writerUid, reason);
        logModeration(gallId, "system", writerUid, null, "auto_suspend", reason);
    }

    private void suspendCommentWriter(long commentId, String reason) {
        Map<String, Object> comment = findComment(commentId);
        String writerUid = comment == null ? null : nullable(comment.get("writer_uid"));
        if (writerUid == null) return;
        jdbcTemplate.update("""
                INSERT INTO user_suspension (uid, reason, suspended_by, expires_at)
                VALUES (?, ?, 'system', DATE_ADD(NOW(), INTERVAL 7 DAY))
                ON DUPLICATE KEY UPDATE reason = VALUES(reason), suspended_at = NOW(), expires_at = VALUES(expires_at)
                """, writerUid, reason);
        logModeration(nullable(comment.get("gall_id")), "system", writerUid, null, "auto_suspend", reason);
    }

    private void addColumnIfMissing(String table, String column, String definition) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_schema = DATABASE()
                  AND table_name = ?
                  AND column_name = ?
                """, Integer.class, table, column);
        if (count == null || count == 0) {
            jdbcTemplate.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
        }
    }

    private String actorKey(String uid, String ip) {
        if (uid != null && !uid.isBlank()) return "uid:" + uid.trim();
        return "ip:" + normalizedIp(ip);
    }

    private String normalizedIp(String ip) {
        if (ip == null || ip.isBlank()) return "unknown";
        String normalized = ip.trim();
        if (normalized.startsWith("::ffff:")) normalized = normalized.substring(7);
        if ("::1".equals(normalized) || "0:0:0:0:0:0:0:1".equals(normalized)) return "127.0.0.1";
        return normalized;
    }

    private String required(String value, String message) {
        String normalized = nullable(value);
        if (normalized == null) throw new RuntimeException(message);
        return normalized;
    }

    private String nullable(Object value) {
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String text(Object value, String fallback) {
        String normalized = nullable(value);
        return normalized == null ? fallback : normalized;
    }

    private void sanitizeRowContent(Map<String, Object> row) {
        if (row == null) {
            return;
        }
        Object rawContent = row.get("content");
        if (rawContent != null) {
            row.put("content", htmlSanitizerService.sanitize(String.valueOf(rawContent)));
        }
    }

    private int number(Object value, int fallback) {
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return fallback;
        }
    }

    private boolean flag(String value) {
        return flagValue(value);
    }

    private boolean flagValue(Object value) {
        if (value instanceof Boolean b) return b;
        if (value instanceof Number n) return n.intValue() != 0;
        if (value == null) return false;
        String text = String.valueOf(value).trim();
        return "1".equals(text) || "true".equalsIgnoreCase(text) || "yes".equalsIgnoreCase(text) || "on".equalsIgnoreCase(text);
    }
}
