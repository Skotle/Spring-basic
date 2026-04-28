package org.java.spring_04.board;

import jakarta.annotation.PostConstruct;
import org.java.spring_04.common.HtmlSanitizerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class BoardService {
    private static final String ALARM_REF_TYPE_BOARD_STAFF = "board_staff_request";
    private static final String ALARM_REF_TYPE_BOARD_OPEN = "board_open_request";
    private static final String ALARM_TYPE_MANAGER_REQUEST = "board_manager_request";
    private static final String ALARM_TYPE_SUBMANAGER_REQUEST = "board_submanager_request";
    private static final String ALARM_TYPE_SIDE_BOARD_REQUEST = "side_board_request";
    private static final String ALARM_TYPE_MANAGER_ACCEPTED = "board_manager_request_accepted";
    private static final String ALARM_TYPE_SUBMANAGER_ACCEPTED = "board_submanager_request_accepted";
    private static final String ALARM_TYPE_SIDE_BOARD_ACCEPTED = "side_board_request_accepted";
    private static final String ALARM_TYPE_MANAGER_REJECTED = "board_manager_request_rejected";
    private static final String ALARM_TYPE_SUBMANAGER_REJECTED = "board_submanager_request_rejected";
    private static final String ALARM_TYPE_SIDE_BOARD_REJECTED = "side_board_request_rejected";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private HtmlSanitizerService htmlSanitizerService;

    @PostConstruct
    public void initializeBoardManagementSchema() {
        if (!columnExists("board", "manager_uid")) {
            jdbcTemplate.execute("ALTER TABLE board ADD COLUMN manager_uid VARCHAR(50) NULL");
        }
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_submanager (
                    gall_id VARCHAR(50) NOT NULL,
                    uid VARCHAR(50) NOT NULL,
                    appointed_by VARCHAR(50) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (gall_id, uid)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS alarm (
                    alarm_id BIGINT NOT NULL AUTO_INCREMENT,
                    uid VARCHAR(50) NOT NULL,
                    alarm_type VARCHAR(50) NOT NULL,
                    title VARCHAR(200) NOT NULL,
                    content TEXT NULL,
                    ref_type VARCHAR(50) NULL,
                    ref_id VARCHAR(100) NULL,
                    is_read TINYINT(1) NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    read_at DATETIME NULL,
                    PRIMARY KEY (alarm_id),
                    INDEX idx_alarm_uid_created_at (uid, created_at),
                    INDEX idx_alarm_uid_is_read (uid, is_read)
                )
                """);
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
                CREATE TABLE IF NOT EXISTS board_request (
                    request_id BIGINT NOT NULL AUTO_INCREMENT,
                    requester_uid VARCHAR(50) NOT NULL,
                    gall_id VARCHAR(50) NULL,
                    gall_name VARCHAR(100) NOT NULL,
                    gall_type VARCHAR(10) NOT NULL DEFAULT 'm',
                    reason TEXT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    reviewed_by VARCHAR(50) NULL,
                    reviewed_at DATETIME NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (request_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_counter (
                    gall_id VARCHAR(50) NOT NULL,
                    last_post_no INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (gall_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_transfer (
                    transfer_id BIGINT NOT NULL AUTO_INCREMENT,
                    gall_id VARCHAR(50) NOT NULL,
                    from_uid VARCHAR(50) NOT NULL,
                    to_uid VARCHAR(50) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    responded_at DATETIME NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (transfer_id)
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
        if (!columnExists("board_request", "gall_id")) {
            jdbcTemplate.execute("ALTER TABLE board_request ADD COLUMN gall_id VARCHAR(50) NULL AFTER requester_uid");
        }
        if (!columnExists("gallery_setting", "concept_recommend_threshold")) {
            jdbcTemplate.execute("ALTER TABLE gallery_setting ADD COLUMN concept_recommend_threshold INT NOT NULL DEFAULT 10");
        }
        if (!columnExists("gallery_setting", "cover_image_url")) {
            jdbcTemplate.execute("ALTER TABLE gallery_setting ADD COLUMN cover_image_url VARCHAR(500) NULL");
        }
        if (!columnExists("gallery_setting", "category_options")) {
            jdbcTemplate.execute("ALTER TABLE gallery_setting ADD COLUMN category_options TEXT NULL");
        }
        if (!columnExists("post", "category")) {
            jdbcTemplate.execute("ALTER TABLE post ADD COLUMN category VARCHAR(50) NULL");
        }
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

    public List<Map<String, Object>> getBoardList() {
        String sql = """
                SELECT g.gall_id,
                       g.gall_name,
                       g.gall_type,
                       g.category,
                       g.status,
                       g.post_count,
                       g.manager_uid,
                       manager.nick AS manager_nick,
                       (
                           SELECT COUNT(*)
                           FROM board_submanager bs
                           WHERE bs.gall_id = g.gall_id
                       ) AS submanager_count
                FROM board g
                LEFT JOIN user manager ON manager.uid = g.manager_uid
                ORDER BY g.gall_id ASC
                """;
        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> getPostsByGallery(String gallId, int page) {
        int size = 20;
        int offset = Math.max(page - 1, 0) * size;

        String sql = """
                SELECT p.*, g.gall_name, g.manager_uid,
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
                LIMIT ? OFFSET ?
                """;
        return decorateListRows(sanitizeRowsContent(jdbcTemplate.queryForList(sql, gallId, size, offset)));
    }

    public Map<String, Object> getPostDetail(String gallId, Long postNo) {
        String sql = """
                SELECT p.*, g.gall_name, g.manager_uid,
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
            return sanitizeRowContent(jdbcTemplate.queryForMap(sql, gallId, postNo));
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public Map<String, Object> getBoardManageInfo(String gallId, String viewerUid, String viewerDivision) {
        Map<String, Object> board = getBoardRow(gallId);
        if (board == null) {
            throw new RuntimeException("해당 게시판을 찾을 수 없습니다.");
        }

        boolean eligible = isManagedBoardEligible(board);
        String managerUid = nullableText(board.get("manager_uid"));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("board", board);
        result.put("managedBoardEligible", eligible);
        result.put("manager", managerUid == null ? null : Map.of(
                "uid", managerUid,
                "nick", nullableText(board.get("manager_nick")) == null ? managerUid : nullableText(board.get("manager_nick"))
        ));
        result.put("submanagers", getSubmanagers(gallId));
        result.put("settings", getBoardSettings(gallId));
        result.put("permissions", Map.of(
                "isManager", isBoardManager(gallId, viewerUid),
                "isSubmanager", isBoardSubmanager(gallId, viewerUid),
                "canManage", canManageBoard(gallId, viewerUid, viewerDivision),
                "canAppoint", canAssignBoardStaff(gallId, viewerUid, viewerDivision),
                "isAdmin", isGlobalAdmin(viewerDivision)
        ));
        result.put("roleLabels", resolveBoardRoleLabels(gallId, viewerUid, viewerDivision));
        return result;
    }

    public Map<String, Object> getBoardSettings(String gallId) {
        String boardId = required(gallId, "게시판 ID가 필요합니다.");
        Map<String, Object> defaults = defaultBoardSettings(boardId);
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap("""
                    SELECT gall_id,
                           board_notice,
                           welcome_message,
                           cover_image_url,
                           category_options,
                           theme_color,
                           concept_recommend_threshold,
                           allow_guest_post,
                           allow_guest_comment,
                           join_policy,
                           visibility,
                           pinned_notice_count,
                           allowed_attachment_types,
                           attachment_max_bytes,
                           side_board_approval_policy,
                           dormant_after_days,
                           updated_by,
                           updated_at
                    FROM gallery_setting
                    WHERE gall_id = ?
                    """, boardId);
            defaults.putAll(row);
            defaults.put("theme_color", firstNonBlank(nullableText(row.get("theme_color")), "#ff8fab"));
            String categoryOptions = normalizeCategoryOptions(nullableText(row.get("category_options")));
            defaults.put("category_options", categoryOptions);
            defaults.put("category_options_list", parseCategoryOptions(categoryOptions));
            defaults.put("concept_recommend_threshold", normalizeConceptThreshold(row.get("concept_recommend_threshold")));
            defaults.put("allow_guest_post", toBooleanFlag(row.get("allow_guest_post")));
            defaults.put("allow_guest_comment", toBooleanFlag(row.get("allow_guest_comment")));
            defaults.put("join_policy", firstNonBlank(nullableText(row.get("join_policy")), "free"));
            defaults.put("visibility", firstNonBlank(nullableText(row.get("visibility")), "public"));
            defaults.put("pinned_notice_count", normalizeConceptThreshold(row.get("pinned_notice_count")));
            defaults.put("allowed_attachment_types", nullableText(row.get("allowed_attachment_types")));
            defaults.put("attachment_max_bytes", row.get("attachment_max_bytes"));
            defaults.put("side_board_approval_policy", firstNonBlank(nullableText(row.get("side_board_approval_policy")), "operator"));
            defaults.put("dormant_after_days", normalizeConceptThreshold(row.get("dormant_after_days")));
            return defaults;
        } catch (EmptyResultDataAccessException e) {
            return defaults;
        }
    }

    @Transactional
    public Map<String, Object> saveBoardSettings(String gallId, Map<String, String> payload, String uid, String memberDivision) {
        String boardId = required(gallId, "갤러리 ID를 입력해주세요.");
        String actorUid = required(uid, "로그인 정보가 필요합니다.");

        requireBoard(boardId);
        if (!canManageBoard(boardId, actorUid, memberDivision)) {
            throw new RuntimeException("게시판 설정을 변경할 권한이 없습니다.");
        }

        String boardNotice = nullableTrim(payload.get("boardNotice"));
        String welcomeMessage = nullableTrim(payload.get("welcomeMessage"));
        String coverImageUrl = nullableTrim(payload.get("coverImageUrl"));
        String categoryOptions = normalizeCategoryOptions(payload.get("categoryOptions"));
        String themeColor = normalizeThemeColor(payload.get("themeColor"));
        int conceptRecommendThreshold = normalizeConceptThreshold(payload.get("conceptRecommendThreshold"));
        int allowGuestPost = parseBooleanFlag(payload.get("allowGuestPost"));
        int allowGuestComment = parseBooleanFlag(payload.get("allowGuestComment"));
        String joinPolicy = normalizeChoice(payload.get("joinPolicy"), List.of("free", "approval"), "free");
        String visibility = normalizeChoice(payload.get("visibility"), List.of("public", "private", "members"), "public");
        int pinnedNoticeCount = normalizeNonNegativeInt(payload.get("pinnedNoticeCount"), 3);
        String allowedAttachmentTypes = nullableTrim(payload.get("allowedAttachmentTypes"));
        long attachmentMaxBytes = normalizeLong(payload.get("attachmentMaxBytes"), 10_485_760L);
        String sideBoardApprovalPolicy = normalizeChoice(payload.get("sideBoardApprovalPolicy"), List.of("operator", "auto"), "operator");
        int dormantAfterDays = normalizeNonNegativeInt(payload.get("dormantAfterDays"), 180);

        jdbcTemplate.update("""
                INSERT INTO gallery_setting (
                    gall_id, board_notice, welcome_message, cover_image_url, theme_color, concept_recommend_threshold,
                    allow_guest_post, allow_guest_comment, category_options,
                    join_policy, visibility, pinned_notice_count, allowed_attachment_types,
                    attachment_max_bytes, side_board_approval_policy, dormant_after_days,
                    updated_by, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    board_notice = VALUES(board_notice),
                    welcome_message = VALUES(welcome_message),
                    cover_image_url = VALUES(cover_image_url),
                    theme_color = VALUES(theme_color),
                    concept_recommend_threshold = VALUES(concept_recommend_threshold),
                    allow_guest_post = VALUES(allow_guest_post),
                    allow_guest_comment = VALUES(allow_guest_comment),
                    category_options = VALUES(category_options),
                    join_policy = VALUES(join_policy),
                    visibility = VALUES(visibility),
                    pinned_notice_count = VALUES(pinned_notice_count),
                    allowed_attachment_types = VALUES(allowed_attachment_types),
                    attachment_max_bytes = VALUES(attachment_max_bytes),
                    side_board_approval_policy = VALUES(side_board_approval_policy),
                    dormant_after_days = VALUES(dormant_after_days),
                    updated_by = VALUES(updated_by),
                    updated_at = NOW()
                """,
                boardId,
                boardNotice,
                welcomeMessage,
                coverImageUrl,
                themeColor,
                conceptRecommendThreshold,
                allowGuestPost,
                allowGuestComment,
                categoryOptions,
                joinPolicy,
                visibility,
                pinnedNoticeCount,
                allowedAttachmentTypes,
                attachmentMaxBytes,
                sideBoardApprovalPolicy,
                dormantAfterDays,
                actorUid
        );

        return getBoardSettings(boardId);
    }

    @Transactional
    public void assignManager(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "갤러리 ID를 입력해주세요.");
        String actor = required(actorUid, "요청자 정보를 입력해주세요.");
        String resolvedTarget = required(targetUid == null || targetUid.isBlank() ? actorUid : targetUid, "대상자 UID를 입력해주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        String currentManager = nullableText(board.get("manager_uid"));
        boolean globalAdmin = isGlobalAdmin(actorDivision);

        if (currentManager == null || currentManager.isBlank()) {
            if (!globalAdmin && !actor.equals(resolvedTarget)) {
                throw new RuntimeException("매니저가 없는 갤러리는 본인만 매니저를 요청할 수 있습니다.");
            }
        } else if (!globalAdmin && !currentManager.equals(actor)) {
            throw new RuntimeException("현재 매니저만 다른 매니저에게 양도 요청할 수 있습니다.");
        }

        if (currentManager != null && !currentManager.isBlank() && !globalAdmin && !isBoardSubmanager(boardId, resolvedTarget)) {
            throw new RuntimeException("기존 매니저가 있는 갤러리는 부매니저 한 명에게만 양도할 수 있습니다.");
        }

        createBoardStaffRequest(board, resolvedTarget, actor, "manager");
    }

    @Transactional
    public void appointSubmanager(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "갤러리 ID를 입력해주세요.");
        String actor = required(actorUid, "요청자 정보를 입력해주세요.");
        String resolvedTarget = required(targetUid, "부매니저 대상자 UID를 입력해주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("매니저만 부매니저를 임명할 수 있습니다.");
        }

        String managerUid = getManagerUid(boardId);
        if (managerUid != null && managerUid.equals(resolvedTarget)) {
            throw new RuntimeException("현재 매니저는 부매니저로 임명할 수 없습니다.");
        }

        createBoardStaffRequest(board, resolvedTarget, actor, "submanager");
    }

    @Transactional
    public void revokeSubmanager(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "갤러리 ID를 입력해주세요.");
        String actor = required(actorUid, "요청자 정보를 입력해주세요.");
        String resolvedTarget = required(targetUid, "부매니저 대상자 UID를 입력해주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("매니저만 부매니저를 해임할 수 있습니다.");
        }

        jdbcTemplate.update("DELETE FROM board_submanager WHERE gall_id = ? AND uid = ?", boardId, resolvedTarget);
    }

    public List<Map<String, Object>> getMyAlarms(String uid) {
        String resolvedUid = required(uid, "요청자 정보를 입력해주세요.");
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT alarm_id,
                       uid,
                       alarm_type,
                       title,
                       content,
                       ref_type,
                       ref_id,
                       is_read,
                       created_at,
                       read_at
                FROM alarm
                WHERE uid = ?
                ORDER BY created_at DESC, alarm_id DESC
                LIMIT 50
                """, resolvedUid);

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(enrichAlarm(row));
        }
        return result;
    }

    @Transactional
    public void acceptAlarm(Long alarmId, String uid) {
        Map<String, Object> alarm = requireAlarm(alarmId, uid);
        ensurePendingBoardStaffAlarm(alarm);
        String alarmType = nullableText(alarm.get("alarm_type"));
        Map<String, String> payload = parseAlarmPayload(alarm.get("content"));
        if (ALARM_TYPE_SIDE_BOARD_REQUEST.equals(alarmType)) {
            acceptSideBoardRequest(alarmId, uid, payload);
            return;
        }
        String role = required(payload.get("role"), "알림 페이로드에 역할 정보가 없습니다.");
        String gallId = required(payload.get("gallId"), "알림 페이로드에 갤러리 정보가 없습니다.");
        String targetUid = required(payload.get("targetUid"), "알림 페이로드에 대상자 정보가 없습니다.");
        String requesterUid = required(payload.get("requesterUid"), "알림 페이로드에 요청자 정보가 없습니다.");

        if (!uid.equals(targetUid)) {
            throw new RuntimeException("본인에게 온 요청만 처리할 수 있습니다.");
        }

        String requesterDivision = getUserMemberDivision(requesterUid);
        if ("manager".equalsIgnoreCase(role)) {
            applyManagerAssignment(gallId, targetUid, requesterUid, requesterDivision);
            markBoardTransfer(payload.get("transferId"), "accepted");
            markAlarmProcessed(alarmId, ALARM_TYPE_MANAGER_ACCEPTED);
            return;
        }

        if ("submanager".equalsIgnoreCase(role)) {
            applySubmanagerAppointment(gallId, targetUid, requesterUid, requesterDivision);
            markAlarmProcessed(alarmId, ALARM_TYPE_SUBMANAGER_ACCEPTED);
            return;
        }

        throw new RuntimeException("처리할 수 없는 알림 유형입니다.");
    }

    @Transactional
    public void rejectAlarm(Long alarmId, String uid) {
        Map<String, Object> alarm = requireAlarm(alarmId, uid);
        ensurePendingBoardStaffAlarm(alarm);
        String alarmType = nullableText(alarm.get("alarm_type"));
        if (ALARM_TYPE_SIDE_BOARD_REQUEST.equals(alarmType)) {
            rejectSideBoardRequest(alarmId, uid, parseAlarmPayload(alarm.get("content")));
            return;
        }
        if (ALARM_TYPE_MANAGER_REQUEST.equals(alarmType)) {
            Map<String, String> payload = parseAlarmPayload(alarm.get("content"));
            markBoardTransfer(payload.get("transferId"), "rejected");
            markAlarmProcessed(alarmId, ALARM_TYPE_MANAGER_REJECTED);
            return;
        }
        if (ALARM_TYPE_SUBMANAGER_REQUEST.equals(alarmType)) {
            markAlarmProcessed(alarmId, ALARM_TYPE_SUBMANAGER_REJECTED);
            return;
        }
        throw new RuntimeException("처리할 수 없는 알림 유형입니다.");
    }

    @Transactional
    public void requestSideBoardCreation(Map<String, String> payload, String requesterUid) {
        String uid = required(requesterUid, "로그인 정보가 필요합니다.");
        String gallId = normalizeRequestedGallId(payload.get("gallId"));
        String gallName = required(payload.get("gallName"), "갤러리 이름을 입력해주세요.");
        String reason = required(payload.get("reason"), "요청 사유를 입력해주세요.");

        ensureSideBoardRequestAllowed(uid, gallId, gallName);

        if (isSideBoardAutoApprovalEnabled()) {
            jdbcTemplate.update("""
                    INSERT INTO board (gall_id, gall_name, gall_type, category, manager_uid, post_count, status)
                    VALUES (?, ?, 'm', 'user-requested', ?, 0, 'active')
                    """, gallId, gallName, uid);
            jdbcTemplate.update("""
                    INSERT INTO board_counter (gall_id, last_post_no)
                    VALUES (?, 0)
                    ON DUPLICATE KEY UPDATE last_post_no = last_post_no
                    """, gallId);
            jdbcTemplate.update("""
                    INSERT INTO board_request (
                        requester_uid, gall_id, gall_name, gall_type, reason, status, reviewed_by, reviewed_at, created_at
                    )
                    VALUES (?, ?, ?, 'm', ?, 'approved', 'system', NOW(), NOW())
                    """, uid, gallId, gallName, reason);
            notifyRequesterBoardRequestResult(uid, gallId, gallName, true, reason);
            return;
        }

        jdbcTemplate.update("""
                INSERT INTO board_request (
                    requester_uid, gall_id, gall_name, gall_type, reason, status, reviewed_by, reviewed_at, created_at
                )
                VALUES (?, ?, ?, 'm', ?, 'pending', NULL, NULL, NOW())
                """, uid, gallId, gallName, reason);

        notifyAdminsForSideBoardRequest(uid, gallId, gallName, reason);
    }

    public Map<String, Object> getAdminRequestDashboard(String adminUid) {
        String uid = required(adminUid, "로그인 정보가 필요합니다.");
        List<Map<String, Object>> inboxRows = jdbcTemplate.queryForList("""
                SELECT alarm_id,
                       uid,
                       alarm_type,
                       title,
                       content,
                       ref_type,
                       ref_id,
                       is_read,
                       created_at,
                       read_at
                FROM alarm
                WHERE uid = ?
                  AND (
                      ref_type IN (?, ?)
                      OR alarm_type IN (
                          ?, ?, ?, ?, ?, ?, ?, ?, ?
                      )
                  )
                ORDER BY created_at DESC, alarm_id DESC
                LIMIT 100
                """,
                uid,
                ALARM_REF_TYPE_BOARD_STAFF,
                ALARM_REF_TYPE_BOARD_OPEN,
                ALARM_TYPE_MANAGER_REQUEST,
                ALARM_TYPE_SUBMANAGER_REQUEST,
                ALARM_TYPE_SIDE_BOARD_REQUEST,
                ALARM_TYPE_MANAGER_ACCEPTED,
                ALARM_TYPE_SUBMANAGER_ACCEPTED,
                ALARM_TYPE_SIDE_BOARD_ACCEPTED,
                ALARM_TYPE_MANAGER_REJECTED,
                ALARM_TYPE_SUBMANAGER_REJECTED,
                ALARM_TYPE_SIDE_BOARD_REJECTED
        );

        List<Map<String, Object>> inbox = new ArrayList<>();
        for (Map<String, Object> row : inboxRows) {
            inbox.add(enrichRequestAlarm(row, "received"));
        }

        String requesterToken = "requesterUid=" + URLEncoder.encode(uid, StandardCharsets.UTF_8);
        List<Map<String, Object>> sentStaffRows = jdbcTemplate.queryForList("""
                SELECT alarm_id,
                       uid,
                       alarm_type,
                       title,
                       content,
                       ref_type,
                       ref_id,
                       is_read,
                       created_at,
                       read_at
                FROM alarm
                WHERE ref_type = ?
                  AND content LIKE ?
                ORDER BY created_at DESC, alarm_id DESC
                LIMIT 100
                """, ALARM_REF_TYPE_BOARD_STAFF, "%" + requesterToken + "%");

        List<Map<String, Object>> sent = new ArrayList<>();
        for (Map<String, Object> row : sentStaffRows) {
            sent.add(enrichRequestAlarm(row, "sent"));
        }

        List<Map<String, Object>> sideBoardRows = jdbcTemplate.queryForList("""
                SELECT br.request_id,
                       br.requester_uid,
                       requester.nick AS requester_nick,
                       br.gall_id,
                       br.gall_name,
                       br.gall_type,
                       br.reason,
                       br.status,
                       br.reviewed_by,
                       reviewer.nick AS reviewed_by_nick,
                       br.reviewed_at,
                       br.created_at
                FROM board_request br
                LEFT JOIN user requester ON requester.uid = br.requester_uid
                LEFT JOIN user reviewer ON reviewer.uid = br.reviewed_by
                WHERE br.requester_uid = ?
                ORDER BY br.created_at DESC, br.request_id DESC
                LIMIT 100
                """, uid);
        for (Map<String, Object> row : sideBoardRows) {
            Map<String, Object> item = new LinkedHashMap<>(row);
            item.put("direction", "sent");
            item.put("request_kind", "side_board");
            item.put("actionable", false);
            sent.add(item);
        }

        return Map.of(
                "inbox", inbox,
                "sent", sent
        );
    }

    @Transactional
    public void insertPost(Map<String, String> payload, String uid, String nick, String clientIp) {
        String gallId = required(payload.get("gid"), "갤러리 ID를 입력해주세요.");
        String title = required(payload.get("title"), "제목을 입력해주세요.");
        String content = requiredHtml(payload.get("content"), "내용을 입력해주세요.");
        String category = normalizePostCategory(gallId, payload.get("category"));
        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);

        String updateCounterSql = """
                UPDATE board_counter
                SET last_post_no = last_post_no + 1
                WHERE gall_id = ?
                """;

        int rows = jdbcTemplate.update(updateCounterSql, gallId);
        if (rows == 0) {
            jdbcTemplate.update(
                    "INSERT INTO board_counter (gall_id, last_post_no) VALUES (?, 0) ON DUPLICATE KEY UPDATE last_post_no = last_post_no",
                    gallId
            );
            rows = jdbcTemplate.update(updateCounterSql, gallId);
        }
        if (rows == 0) {
            throw new RuntimeException("존재하지 않는 갤러리입니다: " + gallId);
        }

        Integer createdPostNo = jdbcTemplate.queryForObject(
                "SELECT last_post_no FROM board_counter WHERE gall_id = ?",
                Integer.class,
                gallId
        );
        if (createdPostNo == null) {
            throw new RuntimeException("게시글 번호를 가져오지 못했습니다.");
        }

        String updateGallerySql = """
                UPDATE board
                SET post_count = (
                    SELECT COUNT(*)
                    FROM post
                    WHERE post.gall_id = board.gall_id
                      AND post.is_deleted = 0
                )
                WHERE gall_id = ?
                """;
        jdbcTemplate.update(updateGallerySql, gallId);

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
    }

    @Transactional
    public void syncGalleryPostCount() {
        String sql = """
                UPDATE board
                SET post_count = (
                    SELECT COUNT(*)
                    FROM post
                    WHERE post.gall_id = board.gall_id
                      AND post.is_deleted = 0
                )
                """;

        jdbcTemplate.update(sql);
    }

    public boolean canManageBoard(String gallId, String uid, String memberDivision) {
        if (uid == null || uid.isBlank()) {
            return false;
        }
        Map<String, Object> board = getBoardRow(gallId);
        if (!isManagedBoardEligible(board)) {
            return false;
        }
        return isGlobalAdmin(memberDivision) || isBoardManager(gallId, uid) || isBoardSubmanager(gallId, uid);
    }

    public boolean canAssignBoardStaff(String gallId, String uid, String memberDivision) {
        if (uid == null || uid.isBlank()) {
            return false;
        }
        Map<String, Object> board = getBoardRow(gallId);
        if (!isManagedBoardEligible(board)) {
            return false;
        }
        return isGlobalAdmin(memberDivision) || isBoardManager(gallId, uid);
    }

    public boolean isBoardManager(String gallId, String uid) {
        if (uid == null || uid.isBlank()) {
            return false;
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM board WHERE gall_id = ? AND manager_uid = ?",
                Integer.class,
                gallId,
                uid
        );
        return count != null && count > 0;
    }

    public boolean isBoardSubmanager(String gallId, String uid) {
        if (uid == null || uid.isBlank()) {
            return false;
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM board_submanager WHERE gall_id = ? AND uid = ?",
                Integer.class,
                gallId,
                uid
        );
        return count != null && count > 0;
    }

    private List<Map<String, Object>> getSubmanagers(String gallId) {
        return jdbcTemplate.queryForList("""
                SELECT bs.uid,
                       u.nick,
                       bs.appointed_by,
                       appointor.nick AS appointed_by_nick,
                       bs.created_at
                FROM board_submanager bs
                LEFT JOIN user u ON u.uid = bs.uid
                LEFT JOIN user appointor ON appointor.uid = bs.appointed_by
                WHERE bs.gall_id = ?
                ORDER BY bs.created_at ASC
                """, gallId);
    }

    private void applyManagerAssignment(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "갤러리 ID를 입력해주세요.");
        String actor = required(actorUid, "요청자 정보를 입력해주세요.");
        String resolvedTarget = required(targetUid, "대상자 UID를 입력해주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        String currentManager = nullableText(board.get("manager_uid"));
        boolean globalAdmin = isGlobalAdmin(actorDivision);

        if (currentManager == null || currentManager.isBlank()) {
            if (!globalAdmin && !actor.equals(resolvedTarget)) {
                throw new RuntimeException("매니저가 없는 갤러리는 본인만 매니저를 요청할 수 있습니다.");
            }
        } else if (!globalAdmin && !currentManager.equals(actor)) {
            throw new RuntimeException("현재 매니저만 다른 매니저에게 양도할 수 있습니다.");
        }

        jdbcTemplate.update("UPDATE board SET manager_uid = ? WHERE gall_id = ?", resolvedTarget, boardId);
        jdbcTemplate.update("DELETE FROM board_submanager WHERE gall_id = ? AND uid = ?", boardId, resolvedTarget);
    }

    private void applySubmanagerAppointment(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "갤러리 ID를 입력해주세요.");
        String actor = required(actorUid, "요청자 정보를 입력해주세요.");
        String resolvedTarget = required(targetUid, "부매니저 대상자 UID를 입력해주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("매니저만 부매니저를 임명할 수 있습니다.");
        }

        String managerUid = getManagerUid(boardId);
        if (managerUid != null && managerUid.equals(resolvedTarget)) {
            throw new RuntimeException("현재 매니저는 부매니저로 임명할 수 없습니다.");
        }

        jdbcTemplate.update("""
                INSERT INTO board_submanager (gall_id, uid, appointed_by)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE appointed_by = VALUES(appointed_by)
                """, boardId, resolvedTarget, actor);
    }

    private void acceptSideBoardRequest(Long alarmId, String adminUid, Map<String, String> payload) {
        if (!isGlobalAdmin(getUserMemberDivision(adminUid))) {
            throw new RuntimeException("사이드 갤러리 요청은 관리자 또는 운영자만 승인할 수 있습니다.");
        }

        String requesterUid = required(payload.get("requesterUid"), "요청자 사용자 정보가 없습니다.");
        String gallId = required(payload.get("gallId"), "갤러리 ID 정보가 없습니다.");
        String gallName = required(payload.get("gallName"), "갤러리 이름 정보가 없습니다.");
        String reason = nullableTrim(payload.get("reason"));

        ensureSideBoardRequestAllowed(requesterUid, gallId, gallName);
        ensureUserExists(requesterUid);

        jdbcTemplate.update("""
                INSERT INTO board (gall_id, gall_name, gall_type, category, manager_uid, post_count, status)
                VALUES (?, ?, 'm', 'user-requested', ?, 0, 'active')
                """, gallId, gallName, requesterUid);
        jdbcTemplate.update("""
                INSERT INTO board_counter (gall_id, last_post_no)
                VALUES (?, 0)
                ON DUPLICATE KEY UPDATE last_post_no = last_post_no
                """, gallId);
        jdbcTemplate.update("""
                INSERT INTO gallery_setting (
                    gall_id, board_notice, welcome_message, theme_color,
                    allow_guest_post, allow_guest_comment, concept_recommend_threshold, updated_by, updated_at
                )
                VALUES (?, NULL, ?, '#ff8fab', 1, 1, 10, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    updated_by = VALUES(updated_by),
                    updated_at = NOW()
                """, gallId, gallName + " 갤러리에 오신 것을 환영합니다.", adminUid);
        jdbcTemplate.update("""
                UPDATE board_request
                SET status = 'approved',
                    reviewed_by = ?,
                    reviewed_at = NOW()
                WHERE requester_uid = ?
                  AND gall_id = ?
                  AND status = 'pending'
                """, adminUid, requesterUid, gallId);
        markAlarmProcessed(alarmId, ALARM_TYPE_SIDE_BOARD_ACCEPTED);
        notifyRequesterBoardRequestResult(requesterUid, gallId, gallName, true, reason);
    }

    private void rejectSideBoardRequest(Long alarmId, String adminUid, Map<String, String> payload) {
        if (!isGlobalAdmin(getUserMemberDivision(adminUid))) {
            throw new RuntimeException("사이드 갤러리 요청은 관리자 또는 운영자만 거절할 수 있습니다.");
        }

        String requesterUid = required(payload.get("requesterUid"), "요청자 사용자 정보가 없습니다.");
        String gallId = required(payload.get("gallId"), "갤러리 ID 정보가 없습니다.");
        String gallName = required(payload.get("gallName"), "갤러리 이름 정보가 없습니다.");
        String reason = nullableTrim(payload.get("reason"));

        jdbcTemplate.update("""
                UPDATE board_request
                SET status = 'rejected',
                    reviewed_by = ?,
                    reviewed_at = NOW()
                WHERE requester_uid = ?
                  AND gall_id = ?
                  AND status = 'pending'
                """, adminUid, requesterUid, gallId);
        markAlarmProcessed(alarmId, ALARM_TYPE_SIDE_BOARD_REJECTED);
        notifyRequesterBoardRequestResult(requesterUid, gallId, gallName, false, reason);
    }

    // 매니저 요청은 수락 시 board_transfer 상태를 함께 갱신한다.
    private void createBoardStaffRequest(Map<String, Object> board, String targetUid, String actorUid, String role) {
        String boardId = required(nullableText(board.get("gall_id")), "갤러리 ID를 찾을 수 없습니다.");
        String boardName = firstNonBlank(nullableText(board.get("gall_name")), boardId);
        String resolvedTarget = required(targetUid, "대상자 정보를 찾을 수 없습니다.");
        String requesterUid = required(actorUid, "요청자 정보를 찾을 수 없습니다.");
        String requesterNick = firstNonBlank(getUserNick(requesterUid), requesterUid);
        ensureNoPendingBoardStaffRequest(resolvedTarget, boardId, role);

        Long transferId = null;
        if ("manager".equalsIgnoreCase(role)) {
            jdbcTemplate.update("""
                    INSERT INTO board_transfer (gall_id, from_uid, to_uid, status, responded_at, created_at)
                    VALUES (?, ?, ?, 'pending', NULL, NOW())
                    """, boardId, requesterUid, resolvedTarget);
            transferId = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        }

        String alarmType = "manager".equalsIgnoreCase(role) ? ALARM_TYPE_MANAGER_REQUEST : ALARM_TYPE_SUBMANAGER_REQUEST;
        String roleLabel = "manager".equalsIgnoreCase(role) ? "manager" : "submanager";
        String title = "[" + boardName + "] " + roleLabel + " request";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("role", role);
        payload.put("gallId", boardId);
        payload.put("gallName", boardName);
        payload.put("targetUid", resolvedTarget);
        payload.put("requesterUid", requesterUid);
        payload.put("requesterNick", requesterNick);
        payload.put("requestedAt", LocalDateTime.now().toString());
        if (transferId != null) {
            payload.put("transferId", transferId);
        }

        jdbcTemplate.update("""
                INSERT INTO alarm (uid, alarm_type, title, content, ref_type, ref_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """, resolvedTarget, alarmType, title, toJson(payload), ALARM_REF_TYPE_BOARD_STAFF, boardId);
    }

    private void ensureNoPendingBoardStaffRequest(String targetUid, String gallId, String role) {
        String alarmType = "manager".equalsIgnoreCase(role) ? ALARM_TYPE_MANAGER_REQUEST : ALARM_TYPE_SUBMANAGER_REQUEST;
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM alarm
                WHERE uid = ?
                  AND alarm_type = ?
                  AND ref_type = ?
                  AND ref_id = ?
                  AND is_read = 0
                """, Integer.class, targetUid, alarmType, ALARM_REF_TYPE_BOARD_STAFF, gallId);
        if (count != null && count > 0) {
            throw new RuntimeException("이미 처리 대기 중인 요청이 있습니다.");
        }
    }

    private Map<String, Object> enrichAlarm(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>(row);
        String alarmType = nullableText(row.get("alarm_type"));
        boolean actionable = isPendingBoardStaffAlarmType(alarmType) && !isReadAlarm(row.get("is_read"));
        result.put("actionable", actionable);
        String refType = nullableText(row.get("ref_type"));
        if (ALARM_REF_TYPE_BOARD_STAFF.equals(refType) || ALARM_REF_TYPE_BOARD_OPEN.equals(refType)) {
            result.put("payload", parseAlarmPayload(row.get("content")));
        }
        return result;
    }

    private Map<String, Object> enrichRequestAlarm(Map<String, Object> row, String direction) {
        Map<String, Object> result = enrichAlarm(row);
        String alarmType = nullableText(row.get("alarm_type"));
        Map<String, String> payload = parseAlarmPayload(row.get("content"));
        result.put("payload", payload);
        result.put("direction", direction);
        result.put("request_kind", requestKindFromAlarmType(alarmType));
        result.put("status", requestStatusFromAlarmType(alarmType, row.get("is_read")));
        result.put("role", payload.get("role"));
        result.put("gall_id", firstNonBlank(payload.get("gallId"), nullableText(row.get("ref_id"))));
        result.put("gall_name", payload.get("gallName"));
        result.put("requester_uid", payload.get("requesterUid"));
        result.put("requester_nick", payload.get("requesterNick"));
        result.put("target_uid", payload.get("targetUid"));
        result.put("reason", payload.get("reason"));
        return result;
    }

    private String requestKindFromAlarmType(String alarmType) {
        if (ALARM_TYPE_SIDE_BOARD_REQUEST.equals(alarmType)
                || ALARM_TYPE_SIDE_BOARD_ACCEPTED.equals(alarmType)
                || ALARM_TYPE_SIDE_BOARD_REJECTED.equals(alarmType)) {
            return "side_board";
        }
        if (ALARM_TYPE_MANAGER_REQUEST.equals(alarmType)
                || ALARM_TYPE_MANAGER_ACCEPTED.equals(alarmType)
                || ALARM_TYPE_MANAGER_REJECTED.equals(alarmType)) {
            return "manager";
        }
        if (ALARM_TYPE_SUBMANAGER_REQUEST.equals(alarmType)
                || ALARM_TYPE_SUBMANAGER_ACCEPTED.equals(alarmType)
                || ALARM_TYPE_SUBMANAGER_REJECTED.equals(alarmType)) {
            return "submanager";
        }
        return "request";
    }

    private String requestStatusFromAlarmType(String alarmType, Object isRead) {
        if (ALARM_TYPE_MANAGER_ACCEPTED.equals(alarmType)
                || ALARM_TYPE_SUBMANAGER_ACCEPTED.equals(alarmType)
                || ALARM_TYPE_SIDE_BOARD_ACCEPTED.equals(alarmType)) {
            return "accepted";
        }
        if (ALARM_TYPE_MANAGER_REJECTED.equals(alarmType)
                || ALARM_TYPE_SUBMANAGER_REJECTED.equals(alarmType)
                || ALARM_TYPE_SIDE_BOARD_REJECTED.equals(alarmType)) {
            return "rejected";
        }
        if (isPendingBoardStaffAlarmType(alarmType) && !isReadAlarm(isRead)) {
            return "pending";
        }
        return "processed";
    }

    private Map<String, Object> requireAlarm(Long alarmId, String uid) {
        if (alarmId == null) {
            throw new RuntimeException("알림 ID를 입력해주세요.");
        }
        String resolvedUid = required(uid, "요청자 정보를 입력해주세요.");
        try {
            return jdbcTemplate.queryForMap("""
                    SELECT alarm_id,
                           uid,
                           alarm_type,
                           title,
                           content,
                           ref_type,
                           ref_id,
                           is_read,
                           created_at,
                           read_at
                    FROM alarm
                    WHERE alarm_id = ?
                      AND uid = ?
                    """, alarmId, resolvedUid);
        } catch (EmptyResultDataAccessException e) {
            throw new RuntimeException("대상 알림을 찾을 수 없습니다.");
        }
    }

    private void ensurePendingBoardStaffAlarm(Map<String, Object> alarm) {
        String alarmType = nullableText(alarm.get("alarm_type"));
        if (!isPendingBoardStaffAlarmType(alarmType) || isReadAlarm(alarm.get("is_read"))) {
            throw new RuntimeException("처리 가능한 상태의 알림이 아닙니다.");
        }
    }

    private boolean isPendingBoardStaffAlarmType(String alarmType) {
        return ALARM_TYPE_MANAGER_REQUEST.equals(alarmType)
                || ALARM_TYPE_SUBMANAGER_REQUEST.equals(alarmType)
                || ALARM_TYPE_SIDE_BOARD_REQUEST.equals(alarmType);
    }

    private boolean isReadAlarm(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        String text = nullableText(value);
        return "1".equals(text) || "true".equalsIgnoreCase(text);
    }

    private void markAlarmProcessed(Long alarmId, String nextType) {
        jdbcTemplate.update("""
                UPDATE alarm
                SET alarm_type = ?,
                    is_read = 1,
                    read_at = NOW()
                WHERE alarm_id = ?
                """, nextType, alarmId);
    }

    private void markBoardTransfer(String transferIdText, String status) {
        String normalized = nullableTrim(transferIdText);
        if (normalized == null) {
            return;
        }
        try {
            Long transferId = Long.parseLong(normalized);
            jdbcTemplate.update("""
                    UPDATE board_transfer
                    SET status = ?,
                        responded_at = NOW()
                    WHERE transfer_id = ?
                    """, status, transferId);
        } catch (NumberFormatException ignored) {
        }
    }

    private Map<String, String> parseAlarmPayload(Object rawContent) {
        String content = required(nullableText(rawContent), "알림 내용이 비어 있습니다.");
        Map<String, String> payload = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            if (line.isBlank()) {
                continue;
            }
            int separator = line.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            String key = URLDecoder.decode(line.substring(0, separator), StandardCharsets.UTF_8);
            String value = URLDecoder.decode(line.substring(separator + 1), StandardCharsets.UTF_8);
            payload.put(key, value);
        }
        return payload;
    }

    private String toJson(Map<String, Object> payload) {
        StringBuilder builder = new StringBuilder();
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            if (!builder.isEmpty()) {
                builder.append('\n');
            }
            String key = URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8);
            String value = URLEncoder.encode(String.valueOf(entry.getValue() == null ? "" : entry.getValue()), StandardCharsets.UTF_8);
            builder.append(key).append('=').append(value);
        }
        return builder.toString();
    }

    private void ensureSideBoardRequestAllowed(String requesterUid, String gallId, String gallName) {
        if (gallId == null || gallId.isBlank()) {
            throw new RuntimeException("갤러리 ID를 입력해주세요.");
        }
        if (!gallId.matches("^[a-z0-9_\\-]{3,50}$")) {
            throw new RuntimeException("갤러리 ID는 3~50자의 영소문자, 숫자, _, - 만 사용할 수 있습니다.");
        }
        if (gallName.length() < 2 || gallName.length() > 100) {
            throw new RuntimeException("갤러리 이름은 2~100자여야 합니다.");
        }
        Integer existingGallery = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM board WHERE gall_id = ?",
                Integer.class,
                gallId
        );
        if (existingGallery != null && existingGallery > 0) {
            throw new RuntimeException("이미 사용 중인 갤러리 ID입니다.");
        }
        Integer existingPending = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM board_request
                WHERE requester_uid = ?
                  AND gall_id = ?
                  AND status = 'pending'
                """, Integer.class, requesterUid, gallId);
        if (existingPending != null && existingPending > 0) {
            throw new RuntimeException("해당 갤러리 ID로 이미 대기 중인 요청이 있습니다.");
        }
    }

    private boolean isSideBoardAutoApprovalEnabled() {
        try {
            String policy = jdbcTemplate.queryForObject(
                    "SELECT side_board_approval_policy FROM gallery_setting WHERE gall_id = '__service__'",
                    String.class
            );
            return "auto".equalsIgnoreCase(nullableText(policy));
        } catch (Exception e) {
            return false;
        }
    }

    // 관리자에게 사이드 보드 개설 요청 알림을 보낸다.
    private void notifyAdminsForSideBoardRequest(String requesterUid, String gallId, String gallName, String reason) {
        List<String> adminUids = jdbcTemplate.query(
                "SELECT uid FROM user WHERE member_division IN ('1', 'admin', 'operator') ORDER BY uid ASC",
                (rs, rowNum) -> rs.getString("uid")
        );
        if (adminUids.isEmpty()) {
            return;
        }
        String requesterNick = firstNonBlank(getUserNick(requesterUid), requesterUid);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("requesterUid", requesterUid);
        payload.put("requesterNick", requesterNick);
        payload.put("gallId", gallId);
        payload.put("gallName", gallName);
        payload.put("reason", reason);
        payload.put("requestedAt", LocalDateTime.now().toString());

        String title = "[사이드 보드 요청] " + gallName;
        String content = toJson(payload);
        for (String adminUid : adminUids) {
            jdbcTemplate.update("""
                    INSERT INTO alarm (uid, alarm_type, title, content, ref_type, ref_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """, adminUid, ALARM_TYPE_SIDE_BOARD_REQUEST, title, content, ALARM_REF_TYPE_BOARD_OPEN, gallId);
        }
    }

    private void notifyRequesterBoardRequestResult(String requesterUid, String gallId, String gallName, boolean approved, String reason) {
        String alarmType = approved ? ALARM_TYPE_SIDE_BOARD_ACCEPTED : ALARM_TYPE_SIDE_BOARD_REJECTED;
        String title = approved
                ? "[" + gallName + "] 사이드 갤러리 요청이 승인되었습니다."
                : "[" + gallName + "] 사이드 갤러리 요청이 거절되었습니다.";
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("gallId", gallId);
        payload.put("gallName", gallName);
        payload.put("approved", approved);
        payload.put("reason", reason);
        jdbcTemplate.update("""
                INSERT INTO alarm (uid, alarm_type, title, content, ref_type, ref_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """, requesterUid, alarmType, title, toJson(payload), ALARM_REF_TYPE_BOARD_OPEN, gallId);
    }

    private String normalizeRequestedGallId(String rawValue) {
        String normalized = nullableTrim(rawValue);
        if (normalized == null) {
            return null;
        }
        return normalized.toLowerCase();
    }

    private Map<String, Object> getBoardRow(String gallId) {
        try {
            return jdbcTemplate.queryForMap("""
                    SELECT g.gall_id,
                           g.gall_name,
                           g.gall_type,
                           g.category,
                           g.post_count,
                           g.manager_uid,
                           manager.nick AS manager_nick
                    FROM board g
                    LEFT JOIN user manager ON manager.uid = g.manager_uid
                    WHERE g.gall_id = ?
                    """, gallId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private Map<String, Object> requireBoard(String gallId) {
        Map<String, Object> board = getBoardRow(gallId);
        if (board == null) {
            throw new RuntimeException("대상 게시판을 찾을 수 없습니다.");
        }
        return board;
    }

    private boolean isManagedBoardEligible(Map<String, Object> board) {
        if (board == null) {
            return false;
        }
        String gallType = nullableText(board.get("gall_type"));
        return gallType == null || !gallType.equalsIgnoreCase("main");
    }

    private void ensureManagedBoardEligible(Map<String, Object> board) {
        if (!isManagedBoardEligible(board)) {
            throw new RuntimeException("gall_type이 main인 게시판은 매니저를 지정할 수 없습니다.");
        }
    }

    private void ensureUserExists(String uid) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user WHERE uid = ?",
                Integer.class,
                uid
        );
        if (count == null || count == 0) {
            throw new RuntimeException("존재하지 않는 사용자입니다: " + uid);
        }
    }

    private String getUserNick(String uid) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT nick FROM user WHERE uid = ?",
                    String.class,
                    uid
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private String getUserMemberDivision(String uid) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT member_division FROM user WHERE uid = ?",
                    String.class,
                    uid
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private String getManagerUid(String gallId) {
        try {
            return jdbcTemplate.queryForObject(
                    "SELECT manager_uid FROM board WHERE gall_id = ?",
                    String.class,
                    gallId
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private List<String> resolveBoardRoleLabels(String gallId, String uid, String memberDivision) {
        List<String> labels = new ArrayList<>();
        if (uid == null || uid.isBlank()) {
            labels.add("guest");
            return labels;
        }

        labels.add("member");
        String division = nullableText(memberDivision);
        if ("operator".equalsIgnoreCase(division)) {
            labels.add("operator");
        }
        if (isGlobalAdmin(memberDivision) || "operator".equalsIgnoreCase(division)) {
            labels.add("admin");
        }
        if (isBoardManager(gallId, uid)) {
            labels.add("board-manager");
        }
        if (isBoardSubmanager(gallId, uid)) {
            labels.add("board-submanager");
        }
        return labels;
    }

    private boolean isGlobalAdmin(String memberDivision) {
        if (memberDivision == null) {
            return false;
        }
        String normalized = memberDivision.trim();
        return normalized.equalsIgnoreCase("admin")
                || normalized.equalsIgnoreCase("operator")
                || normalized.equals("1");
    }

    private WriterInfo resolveWriter(Map<String, String> payload, String uid, String nick, String clientIp) {
        if (uid != null && !uid.isBlank()) {
            String resolvedNick = (nick == null || nick.isBlank()) ? uid : nick;
            return new WriterInfo(uid, resolvedNick, normalizedIp(clientIp), null);
        }

        String guestName = required(firstNonBlank(payload.get("name"), payload.get("guestName")), "비회원 이름을 입력해주세요.");
        String guestPassword = required(firstNonBlank(payload.get("password"), payload.get("guestPassword")), "비회원 비밀번호를 입력해주세요.");
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

    private String nullableText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
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
        String displayCategory = normalizeDisplayCategory(nullableText(row.get("gall_id")), nullableText(row.get("category")));
        row.put("display_category", displayCategory);
        row.put("category", displayCategory);
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
        List<String> options = parseCategoryOptions(getBoardSettings(gallId).get("category_options"));
        if (category != null && !category.isBlank() && (options.isEmpty() || options.contains(category))) {
            return category;
        }
        return options.isEmpty() ? "일반" : options.get(0);
    }

    private String nullableTrim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Map<String, Object> defaultBoardSettings(String gallId) {
        Map<String, Object> settings = new LinkedHashMap<>();
        settings.put("gall_id", gallId);
        settings.put("board_notice", null);
        settings.put("welcome_message", null);
        settings.put("cover_image_url", null);
        settings.put("category_options", "일반");
        settings.put("category_options_list", List.of("일반"));
        settings.put("theme_color", "#ff8fab");
        settings.put("concept_recommend_threshold", 10);
        settings.put("allow_guest_post", true);
        settings.put("allow_guest_comment", true);
        settings.put("join_policy", "free");
        settings.put("visibility", "public");
        settings.put("pinned_notice_count", 3);
        settings.put("allowed_attachment_types", null);
        settings.put("attachment_max_bytes", 10_485_760L);
        settings.put("side_board_approval_policy", "operator");
        settings.put("dormant_after_days", 180);
        settings.put("updated_by", null);
        settings.put("updated_at", null);
        return settings;
    }

    private boolean toBooleanFlag(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        if (value instanceof Number number) {
            return number.intValue() != 0;
        }
        String text = nullableText(value);
        return text == null || text.equals("1") || text.equalsIgnoreCase("true") || text.equalsIgnoreCase("yes") || text.equalsIgnoreCase("on");
    }

    private int parseBooleanFlag(String value) {
        String normalized = nullableTrim(value);
        if (normalized == null) {
            return 1;
        }
        return ("1".equals(normalized) || "true".equalsIgnoreCase(normalized) || "yes".equalsIgnoreCase(normalized) || "on".equalsIgnoreCase(normalized)) ? 1 : 0;
    }

    private int normalizeConceptThreshold(Object value) {
        String normalized = nullableTrim(value == null ? null : String.valueOf(value));
        if (normalized == null) {
            return 10;
        }
        try {
            int parsed = Integer.parseInt(normalized);
            return parsed < 1 ? 10 : parsed;
        } catch (NumberFormatException e) {
            return 10;
        }
    }

    private int normalizeNonNegativeInt(Object value, int fallback) {
        String normalized = nullableTrim(value == null ? null : String.valueOf(value));
        if (normalized == null) {
            return fallback;
        }
        try {
            return Math.max(0, Integer.parseInt(normalized));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private long normalizeLong(Object value, long fallback) {
        String normalized = nullableTrim(value == null ? null : String.valueOf(value));
        if (normalized == null) {
            return fallback;
        }
        try {
            return Math.max(0L, Long.parseLong(normalized));
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private String normalizeChoice(String value, List<String> allowed, String fallback) {
        String normalized = nullableTrim(value);
        if (normalized == null) {
            return fallback;
        }
        String lower = normalized.toLowerCase();
        return allowed.contains(lower) ? lower : fallback;
    }

    private String normalizeThemeColor(String value) {
        String normalized = nullableTrim(value);
        if (normalized == null) {
            return "#ff8fab";
        }
        if (!normalized.matches("^#[0-9a-fA-F]{6}$")) {
            throw new RuntimeException("유효하지 않은 테마 색상 형식입니다.");
        }
        return normalized.toLowerCase();
    }

    private String normalizeCategoryOptions(String value) {
        List<String> options = parseCategoryOptions(value);
        if (options.isEmpty()) {
            options = List.of("일반");
        }
        return String.join("\n", options);
    }

    private List<String> parseCategoryOptions(Object value) {
        String raw = nullableText(value);
        if (raw == null) {
            return new ArrayList<>();
        }
        List<String> options = new ArrayList<>();
        for (String token : raw.split("[\\r\\n,]+")) {
            String option = token.trim();
            if (option.isEmpty() || options.contains(option)) {
                continue;
            }
            if (option.length() > 20) {
                throw new RuntimeException("말머리는 20자 이하로 입력해주세요.");
            }
            options.add(option);
            if (options.size() >= 30) {
                break;
            }
        }
        return options;
    }

    private String normalizePostCategory(String gallId, String value) {
        String category = nullableTrim(value);
        List<String> options = parseCategoryOptions(getBoardSettings(gallId).get("category_options"));
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
    private record WriterInfo(String uid, String name, String ip, String passwordHash) {
    }
}
