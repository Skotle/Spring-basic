package org.java.spring_04.board;

import jakarta.annotation.PostConstruct;
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
    private static final String ALARM_TYPE_MANAGER_REQUEST = "board_manager_request";
    private static final String ALARM_TYPE_SUBMANAGER_REQUEST = "board_submanager_request";
    private static final String ALARM_TYPE_MANAGER_ACCEPTED = "board_manager_request_accepted";
    private static final String ALARM_TYPE_SUBMANAGER_ACCEPTED = "board_submanager_request_accepted";
    private static final String ALARM_TYPE_MANAGER_REJECTED = "board_manager_request_rejected";
    private static final String ALARM_TYPE_SUBMANAGER_REJECTED = "board_submanager_request_rejected";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void initializeBoardManagementSchema() {
        if (!columnExists("gallery", "manager_uid")) {
            jdbcTemplate.execute("ALTER TABLE gallery ADD COLUMN manager_uid VARCHAR(50) NULL");
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
                       g.post_count,
                       g.manager_uid,
                       manager.nick AS manager_nick,
                       (
                           SELECT COUNT(*)
                           FROM board_submanager bs
                           WHERE bs.gall_id = g.gall_id
                       ) AS submanager_count
                FROM gallery g
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
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN gallery g ON g.gall_id = p.gall_id
                WHERE p.gall_id = ?
                  AND p.is_deleted = 0
                ORDER BY p.post_no DESC
                LIMIT ? OFFSET ?
                """;
        return jdbcTemplate.queryForList(sql, gallId, size, offset);
    }

    public Map<String, Object> getPostDetail(String gallId, Long postNo) {
        String sql = """
                SELECT p.*, g.gall_name, g.manager_uid,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN gallery g ON g.gall_id = p.gall_id
                WHERE p.gall_id = ?
                  AND p.post_no = ?
                  AND p.is_deleted = 0
                """;

        try {
            return jdbcTemplate.queryForMap(sql, gallId, postNo);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    public Map<String, Object> getBoardManageInfo(String gallId, String viewerUid, String viewerDivision) {
        Map<String, Object> board = getBoardRow(gallId);
        if (board == null) {
            throw new RuntimeException("?대떦 蹂대뱶瑜?李얠쓣 ???놁뒿?덈떎.");
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
        result.put("permissions", Map.of(
                "isManager", isBoardManager(gallId, viewerUid),
                "isSubmanager", isBoardSubmanager(gallId, viewerUid),
                "canManage", canManageBoard(gallId, viewerUid, viewerDivision),
                "canAppoint", canAssignBoardStaff(gallId, viewerUid, viewerDivision)
        ));
        return result;
    }

    @Transactional
    public void assignManager(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "蹂대뱶 ID媛 ?꾩슂?⑸땲??");
        String actor = required(actorUid, "濡쒓렇?몄씠 ?꾩슂?⑸땲??");
        String resolvedTarget = required(targetUid == null || targetUid.isBlank() ? actorUid : targetUid, "留ㅻ땲? UID媛 ?꾩슂?⑸땲??");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        String currentManager = nullableText(board.get("manager_uid"));
        boolean globalAdmin = isGlobalAdmin(actorDivision);

        if (currentManager == null || currentManager.isBlank()) {
            if (!globalAdmin && !actor.equals(resolvedTarget)) {
                throw new RuntimeException("泥?留ㅻ땲? 吏?뺤? 蹂몄씤 怨꾩젙?쇰줈留??????덉뒿?덈떎.");
            }
        } else if (!globalAdmin && !currentManager.equals(actor)) {
            throw new RuntimeException("?꾩옱 留ㅻ땲?留???留ㅻ땲?瑜?吏?뺥븷 ???덉뒿?덈떎.");
        }

        createBoardStaffRequest(board, resolvedTarget, actor, "manager");
    }

    @Transactional
    public void appointSubmanager(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "蹂대뱶 ID媛 ?꾩슂?⑸땲??");
        String actor = required(actorUid, "濡쒓렇?몄씠 ?꾩슂?⑸땲??");
        String resolvedTarget = required(targetUid, "遺留ㅻ땲? UID媛 ?꾩슂?⑸땲??");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("留ㅻ땲?留?遺留ㅻ땲?瑜??꾨챸?????덉뒿?덈떎.");
        }

        String managerUid = getManagerUid(boardId);
        if (managerUid != null && managerUid.equals(resolvedTarget)) {
            throw new RuntimeException("?꾩옱 留ㅻ땲???遺留ㅻ땲?濡?以묐났 吏?뺥븷 ???놁뒿?덈떎.");
        }

        createBoardStaffRequest(board, resolvedTarget, actor, "submanager");
    }

    @Transactional
    public void revokeSubmanager(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "蹂대뱶 ID媛 ?꾩슂?⑸땲??");
        String actor = required(actorUid, "濡쒓렇?몄씠 ?꾩슂?⑸땲??");
        String resolvedTarget = required(targetUid, "遺留ㅻ땲? UID媛 ?꾩슂?⑸땲??");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("留ㅻ땲?留?遺留ㅻ땲?瑜??댁젣?????덉뒿?덈떎.");
        }

        jdbcTemplate.update("DELETE FROM board_submanager WHERE gall_id = ? AND uid = ?", boardId, resolvedTarget);
    }

    public List<Map<String, Object>> getMyAlarms(String uid) {
        String resolvedUid = required(uid, "濡쒓렇?몄씠 ?꾩슂?⑸땲??");
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
        Map<String, String> payload = parseAlarmPayload(alarm.get("content"));
        String role = required(payload.get("role"), "?뚮┝ ?뺣낫媛 ?щ컮瑜댁? ?딆뒿?덈떎.");
        String gallId = required(payload.get("gallId"), "蹂대뱶 ?뺣낫媛 ?놁뒿?덈떎.");
        String targetUid = required(payload.get("targetUid"), "????ъ슜???뺣낫媛 ?놁뒿?덈떎.");
        String requesterUid = required(payload.get("requesterUid"), "?붿껌???뺣낫媛 ?놁뒿?덈떎.");

        if (!uid.equals(targetUid)) {
            throw new RuntimeException("蹂몄씤?먭쾶 ?꾩갑???붿껌留??섎씫?????덉뒿?덈떎.");
        }

        String requesterDivision = getUserMemberDivision(requesterUid);
        if ("manager".equalsIgnoreCase(role)) {
            applyManagerAssignment(gallId, targetUid, requesterUid, requesterDivision);
            markAlarmProcessed(alarmId, ALARM_TYPE_MANAGER_ACCEPTED);
            return;
        }

        if ("submanager".equalsIgnoreCase(role)) {
            applySubmanagerAppointment(gallId, targetUid, requesterUid, requesterDivision);
            markAlarmProcessed(alarmId, ALARM_TYPE_SUBMANAGER_ACCEPTED);
            return;
        }

        throw new RuntimeException("吏?먰븯吏 ?딅뒗 ?꾨챸 ?붿껌?낅땲??");
    }

    @Transactional
    public void rejectAlarm(Long alarmId, String uid) {
        Map<String, Object> alarm = requireAlarm(alarmId, uid);
        ensurePendingBoardStaffAlarm(alarm);
        String alarmType = nullableText(alarm.get("alarm_type"));
        if (ALARM_TYPE_MANAGER_REQUEST.equals(alarmType)) {
            markAlarmProcessed(alarmId, ALARM_TYPE_MANAGER_REJECTED);
            return;
        }
        if (ALARM_TYPE_SUBMANAGER_REQUEST.equals(alarmType)) {
            markAlarmProcessed(alarmId, ALARM_TYPE_SUBMANAGER_REJECTED);
            return;
        }
        throw new RuntimeException("吏?먰븯吏 ?딅뒗 ?꾨챸 ?붿껌?낅땲??");
    }

    @Transactional
    public void insertPost(Map<String, String> payload, String uid, String nick, String clientIp) {
        String gallId = required(payload.get("gid"), "媛ㅻ윭由?ID媛 ?꾩슂?⑸땲??");
        String title = required(payload.get("title"), "?쒕ぉ???낅젰??二쇱꽭??");
        String content = requiredHtml(payload.get("content"), "蹂몃Ц???낅젰??二쇱꽭??");
        WriterInfo writer = resolveWriter(payload, uid, nick, clientIp);

        String updateCounterSql = """
                UPDATE gallery_counter
                SET last_post_no = last_post_no + 1
                WHERE gall_id = ?
                """;

        int rows = jdbcTemplate.update(updateCounterSql, gallId);
        if (rows == 0) {
            throw new RuntimeException("?대떦 媛ㅻ윭由щ? 李얠쓣 ???놁뒿?덈떎: " + gallId);
        }

        Integer createdPostNo = jdbcTemplate.queryForObject(
                "SELECT last_post_no FROM gallery_counter WHERE gall_id = ?",
                Integer.class,
                gallId
        );
        if (createdPostNo == null) {
            throw new RuntimeException("寃뚯떆湲 踰덊샇瑜??앹꽦?섏? 紐삵뻽?듬땲??");
        }

        String updateGallerySql = """
                UPDATE gallery
                SET post_count = (
                    SELECT COUNT(*)
                    FROM post
                    WHERE post.gall_id = gallery.gall_id
                      AND post.is_deleted = 0
                )
                WHERE gall_id = ?
                """;
        jdbcTemplate.update(updateGallerySql, gallId);

        String insertPostSql = """
                INSERT INTO post (gall_id, post_no, title, content, writer_uid, name, ip, password)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """;

        jdbcTemplate.update(
                insertPostSql,
                gallId,
                createdPostNo,
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
                UPDATE gallery
                SET post_count = (
                    SELECT COUNT(*)
                    FROM post
                    WHERE post.gall_id = gallery.gall_id
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
                "SELECT COUNT(*) FROM gallery WHERE gall_id = ? AND manager_uid = ?",
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
        String boardId = required(gallId, "蹂대뱶 ID媛 ?꾩슂?⑸땲??");
        String actor = required(actorUid, "?붿껌???뺣낫媛 ?꾩슂?⑸땲??");
        String resolvedTarget = required(targetUid, "留ㅻ땲? UID媛 ?꾩슂?⑸땲??");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        String currentManager = nullableText(board.get("manager_uid"));
        boolean globalAdmin = isGlobalAdmin(actorDivision);

        if (currentManager == null || currentManager.isBlank()) {
            if (!globalAdmin && !actor.equals(resolvedTarget)) {
                throw new RuntimeException("泥?留ㅻ땲? 吏?뺤? 蹂몄씤 怨꾩젙?쇰줈留??붿껌?????덉뒿?덈떎.");
            }
        } else if (!globalAdmin && !currentManager.equals(actor)) {
            throw new RuntimeException("?꾩옱 留ㅻ땲?留???留ㅻ땲?瑜?吏紐낇븷 ???덉뒿?덈떎.");
        }

        jdbcTemplate.update("UPDATE gallery SET manager_uid = ? WHERE gall_id = ?", resolvedTarget, boardId);
        jdbcTemplate.update("DELETE FROM board_submanager WHERE gall_id = ? AND uid = ?", boardId, resolvedTarget);
    }

    private void applySubmanagerAppointment(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "蹂대뱶 ID媛 ?꾩슂?⑸땲??");
        String actor = required(actorUid, "?붿껌???뺣낫媛 ?꾩슂?⑸땲??");
        String resolvedTarget = required(targetUid, "遺留ㅻ땲? UID媛 ?꾩슂?⑸땲??");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("留ㅻ땲?留?遺留ㅻ땲?瑜??꾨챸?????덉뒿?덈떎.");
        }

        String managerUid = getManagerUid(boardId);
        if (managerUid != null && managerUid.equals(resolvedTarget)) {
            throw new RuntimeException("?꾩옱 留ㅻ땲???遺留ㅻ땲?濡?以묐났 吏?뺥븷 ???놁뒿?덈떎.");
        }

        jdbcTemplate.update("""
                INSERT INTO board_submanager (gall_id, uid, appointed_by)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE appointed_by = VALUES(appointed_by)
                """, boardId, resolvedTarget, actor);
    }

    private void createBoardStaffRequest(Map<String, Object> board, String targetUid, String actorUid, String role) {
        String boardId = required(nullableText(board.get("gall_id")), "蹂대뱶 ?뺣낫媛 ?놁뒿?덈떎.");
        String boardName = firstNonBlank(nullableText(board.get("gall_name")), boardId);
        String resolvedTarget = required(targetUid, "????ъ슜???뺣낫媛 ?놁뒿?덈떎.");
        String requesterUid = required(actorUid, "?붿껌???뺣낫媛 ?놁뒿?덈떎.");
        String requesterNick = firstNonBlank(getUserNick(requesterUid), requesterUid);
        ensureNoPendingBoardStaffRequest(resolvedTarget, boardId, role);

        String alarmType = "manager".equalsIgnoreCase(role) ? ALARM_TYPE_MANAGER_REQUEST : ALARM_TYPE_SUBMANAGER_REQUEST;
        String roleLabel = "manager".equalsIgnoreCase(role) ? "留ㅻ땲?" : "遺留ㅻ땲?";
        String title = "[" + boardName + "] " + roleLabel + " ?꾨챸 ?붿껌";

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("role", role);
        payload.put("gallId", boardId);
        payload.put("gallName", boardName);
        payload.put("targetUid", resolvedTarget);
        payload.put("requesterUid", requesterUid);
        payload.put("requesterNick", requesterNick);
        payload.put("requestedAt", LocalDateTime.now().toString());

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
            throw new RuntimeException("?대? ?湲?以묒씤 ?꾨챸 ?붿껌???덉뒿?덈떎.");
        }
    }

    private Map<String, Object> enrichAlarm(Map<String, Object> row) {
        Map<String, Object> result = new LinkedHashMap<>(row);
        String alarmType = nullableText(row.get("alarm_type"));
        boolean actionable = isPendingBoardStaffAlarmType(alarmType) && !isReadAlarm(row.get("is_read"));
        result.put("actionable", actionable);
        if (ALARM_REF_TYPE_BOARD_STAFF.equals(nullableText(row.get("ref_type")))) {
            result.put("payload", parseAlarmPayload(row.get("content")));
        }
        return result;
    }

    private Map<String, Object> requireAlarm(Long alarmId, String uid) {
        if (alarmId == null) {
            throw new RuntimeException("?뚮┝ ID媛 ?꾩슂?⑸땲??");
        }
        String resolvedUid = required(uid, "濡쒓렇?몄씠 ?꾩슂?⑸땲??");
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
            throw new RuntimeException("?대떦 ?뚮┝??李얠쓣 ???놁뒿?덈떎.");
        }
    }

    private void ensurePendingBoardStaffAlarm(Map<String, Object> alarm) {
        String alarmType = nullableText(alarm.get("alarm_type"));
        if (!isPendingBoardStaffAlarmType(alarmType) || isReadAlarm(alarm.get("is_read"))) {
            throw new RuntimeException("?대? 泥섎━?섏뿀嫄곕굹 ?섎씫?????녿뒗 ?뚮┝?낅땲??");
        }
    }

    private boolean isPendingBoardStaffAlarmType(String alarmType) {
        return ALARM_TYPE_MANAGER_REQUEST.equals(alarmType) || ALARM_TYPE_SUBMANAGER_REQUEST.equals(alarmType);
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

    private Map<String, String> parseAlarmPayload(Object rawContent) {
        String content = required(nullableText(rawContent), "알림 정보가 비어 있습니다.");
        Map<String, String> payload = new LinkedHashMap<>();
        for (String line : content.split("\\R")) {
            if (line == null || line.isBlank()) {
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
            if (builder.length() > 0) {
                builder.append('\n');
            }
            String key = URLEncoder.encode(entry.getKey(), StandardCharsets.UTF_8);
            String value = URLEncoder.encode(String.valueOf(entry.getValue() == null ? "" : entry.getValue()), StandardCharsets.UTF_8);
            builder.append(key).append('=').append(value);
        }
        return builder.toString();
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
                    FROM gallery g
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
            throw new RuntimeException("?대떦 蹂대뱶瑜?李얠쓣 ???놁뒿?덈떎.");
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
            throw new RuntimeException("gall_type ??main ??蹂대뱶??留ㅻ땲?媛 愿由ы븯吏 ?딆뒿?덈떎.");
        }
    }

    private void ensureUserExists(String uid) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user WHERE uid = ?",
                Integer.class,
                uid
        );
        if (count == null || count == 0) {
            throw new RuntimeException("????좎?瑜?李얠쓣 ???놁뒿?덈떎: " + uid);
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
                    "SELECT manager_uid FROM gallery WHERE gall_id = ?",
                    String.class,
                    gallId
            );
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private boolean isGlobalAdmin(String memberDivision) {
        if (memberDivision == null) {
            return false;
        }
        String normalized = memberDivision.trim();
        return normalized.equalsIgnoreCase("admin") || normalized.equals("1");
    }

    private WriterInfo resolveWriter(Map<String, String> payload, String uid, String nick, String clientIp) {
        if (uid != null && !uid.isBlank()) {
            String resolvedNick = (nick == null || nick.isBlank()) ? uid : nick;
            return new WriterInfo(uid, resolvedNick, normalizedIp(clientIp), null);
        }

        String guestName = required(firstNonBlank(payload.get("name"), payload.get("guestName")), "鍮꾪쉶?먯? ?대쫫???낅젰?댁빞 ?⑸땲??");
        String guestPassword = required(firstNonBlank(payload.get("password"), payload.get("guestPassword")), "鍮꾪쉶?먯? 鍮꾨?踰덊샇瑜??낅젰?댁빞 ?⑸땲??");
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

        String normalized = value.trim();
        String plainText = normalized
                .replaceAll("(?i)<br\\s*/?>", " ")
                .replaceAll("<[^>]+>", " ")
                .replace("&nbsp;", " ")
                .trim();

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

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }

    private String nullableText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private record WriterInfo(String uid, String name, String ip, String passwordHash) {
    }
}

