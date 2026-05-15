package org.java.spring_04.board;

import jakarta.annotation.PostConstruct;
import org.java.spring_04.common.HtmlSanitizerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCrypt;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class BoardService {
    private static final int BOARD_POSTS_PAGE_SIZE = 50;
    private static final int BOARD_RANKING_DAILY_LIMIT = 10;
    private static final long BOARD_RANKING_AUTO_REFRESH_MINUTES = 144L;
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
    public static final String PERMISSION_DELETE_POST = "can_delete_post";
    public static final String PERMISSION_DELETE_COMMENT = "can_delete_comment";
    public static final String PERMISSION_MANAGE_WRITE = "can_manage_write";
    public static final String PERMISSION_MANAGE_GUEST_PENALTY = "can_manage_guest_penalty";
    public static final String PERMISSION_MANAGE_TAGS = "can_manage_tags";
    public static final String PERMISSION_MANAGE_IMAGES = "can_manage_images";
    public static final String PERMISSION_MANAGE_NOTICE = "can_manage_notice";
    public static final String PERMISSION_MANAGE_CATEGORIES = "can_manage_categories";
    public static final String PERMISSION_MANAGE_COVER = "can_manage_cover";
    public static final String PERMISSION_BAN_USER = "can_ban_user";
    public static final String PERMISSION_MANAGE_FORBIDDEN_WORD = "can_manage_forbidden_word";
    public static final String PERMISSION_BUMP_POST = "can_bump_post";
    public static final String PERMISSION_MANAGE_CONCEPT = "can_manage_concept";
    public static final String PERMISSION_MANAGE_CONCEPT_CUT = "can_manage_concept_cut";
    public static final String PERMISSION_MANAGE_SUBMANAGER = "can_manage_submanager";
    private static final List<String> SUBMANAGER_PERMISSION_COLUMNS = List.of(
            PERMISSION_DELETE_POST,
            PERMISSION_DELETE_COMMENT,
            PERMISSION_MANAGE_WRITE,
            PERMISSION_MANAGE_GUEST_PENALTY,
            PERMISSION_MANAGE_TAGS,
            PERMISSION_MANAGE_IMAGES,
            PERMISSION_MANAGE_NOTICE,
            PERMISSION_MANAGE_CATEGORIES,
            PERMISSION_MANAGE_COVER,
            PERMISSION_BAN_USER,
            PERMISSION_MANAGE_FORBIDDEN_WORD,
            PERMISSION_BUMP_POST,
            PERMISSION_MANAGE_CONCEPT,
            PERMISSION_MANAGE_CONCEPT_CUT,
            PERMISSION_MANAGE_SUBMANAGER
    );

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private HtmlSanitizerService htmlSanitizerService;

    @PostConstruct
    public void initializeBoardManagementSchema() {
        if (!columnExists("board", "manager_uid")) {
            jdbcTemplate.execute("ALTER TABLE board ADD COLUMN manager_uid VARCHAR(50) NULL");
        }
        if (!columnExists("board", "topic_id")) {
            jdbcTemplate.execute("ALTER TABLE board ADD COLUMN topic_id VARCHAR(50) NULL");
        }
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_topic (
                    topic_id VARCHAR(50) NOT NULL,
                    topic_name VARCHAR(100) NOT NULL,
                    description VARCHAR(255) NULL,
                    sort_order INT NOT NULL DEFAULT 0,
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (topic_id),
                    UNIQUE KEY uk_board_topic_name (topic_name)
                )
                """);
        seedBoardTopics();
        jdbcTemplate.update("UPDATE board SET topic_id = 'other' WHERE topic_id IS NULL OR topic_id = ''");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_submanager (
                    gall_id VARCHAR(50) NOT NULL,
                    uid VARCHAR(50) NOT NULL,
                    appointed_by VARCHAR(50) NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    can_delete_post TINYINT(1) NOT NULL DEFAULT 1,
                    can_delete_comment TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_write TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_guest_penalty TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_tags TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_images TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_notice TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_categories TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_cover TINYINT(1) NOT NULL DEFAULT 1,
                    can_ban_user TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_forbidden_word TINYINT(1) NOT NULL DEFAULT 1,
                    can_bump_post TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_concept TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_concept_cut TINYINT(1) NOT NULL DEFAULT 1,
                    can_manage_submanager TINYINT(1) NOT NULL DEFAULT 0,
                    PRIMARY KEY (gall_id, uid)
                )
                """);
        ensureSubmanagerPermissionColumns();
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
                    board_tags TEXT NULL,
                    theme_color VARCHAR(20) NOT NULL DEFAULT '#ff8fab',
                    concept_recommend_threshold INT NOT NULL DEFAULT 10,
                    allow_guest_post TINYINT(1) NOT NULL DEFAULT 1,
                    allow_guest_comment TINYINT(1) NOT NULL DEFAULT 1,
                    allow_member_image TINYINT(1) NOT NULL DEFAULT 1,
                    allow_guest_image TINYINT(1) NOT NULL DEFAULT 0,
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
                    topic_id VARCHAR(50) NULL,
                    reason TEXT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    reviewed_by VARCHAR(50) NULL,
                    reviewed_at DATETIME NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (request_id)
                )
                """);
        if (!columnExists("board_request", "topic_id")) {
            jdbcTemplate.execute("ALTER TABLE board_request ADD COLUMN topic_id VARCHAR(50) NULL");
        }
        jdbcTemplate.update("UPDATE board_request SET topic_id = 'other' WHERE topic_id IS NULL OR topic_id = ''");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_counter (
                    gall_id VARCHAR(50) NOT NULL,
                    last_post_no INT NOT NULL DEFAULT 0,
                    PRIMARY KEY (gall_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS post_content (
                    id BIGINT NOT NULL AUTO_INCREMENT,
                    post_id BIGINT NOT NULL,
                    gall_id VARCHAR(50) NOT NULL,
                    post_no BIGINT NOT NULL,
                    content MEDIUMTEXT NULL,
                    content_format VARCHAR(30) NOT NULL DEFAULT 'html',
                    render_policy VARCHAR(30) NOT NULL DEFAULT 'trusted_html',
                    allow_images TINYINT(1) NOT NULL DEFAULT 1,
                    image_count INT NOT NULL DEFAULT 0,
                    word_count INT NOT NULL DEFAULT 0,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id),
                    UNIQUE KEY uq_post_content_post_id (post_id),
                    UNIQUE KEY uq_post_content_gall_post (gall_id, post_no),
                    INDEX idx_post_content_gall (gall_id, post_no)
                )
                """);
        ensurePostContentColumns();
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
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_ranking_snapshot (
                    ranking_date DATE NOT NULL,
                    rank_no INT NOT NULL,
                    gall_id VARCHAR(50) NOT NULL,
                    gall_name VARCHAR(100) NOT NULL,
                    gall_type VARCHAR(10) NULL,
                    score BIGINT NOT NULL DEFAULT 0,
                    post_count INT NOT NULL DEFAULT 0,
                    recent_post_count INT NOT NULL DEFAULT 0,
                    recent_recommend_sum INT NOT NULL DEFAULT 0,
                    refreshed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (ranking_date, rank_no),
                    UNIQUE KEY uk_board_ranking_snapshot_board (ranking_date, gall_id)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS board_ranking_refresh_state (
                    ranking_date DATE NOT NULL,
                    refresh_count INT NOT NULL DEFAULT 0,
                    last_refreshed_at DATETIME NULL,
                    PRIMARY KEY (ranking_date)
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
        if (!columnExists("gallery_setting", "board_tags")) {
            jdbcTemplate.execute("ALTER TABLE gallery_setting ADD COLUMN board_tags TEXT NULL");
        }
        migrateReservedBoardTagsToTopics();
        if (!columnExists("gallery_setting", "allow_member_image")) {
            jdbcTemplate.execute("ALTER TABLE gallery_setting ADD COLUMN allow_member_image TINYINT(1) NOT NULL DEFAULT 1");
        }
        if (!columnExists("gallery_setting", "allow_guest_image")) {
            jdbcTemplate.execute("ALTER TABLE gallery_setting ADD COLUMN allow_guest_image TINYINT(1) NOT NULL DEFAULT 0");
        }
        if (!columnExists("post", "category")) {
            jdbcTemplate.execute("ALTER TABLE post ADD COLUMN category VARCHAR(50) NULL");
        }
        ensurePostDisplayColumns();
    }

    private void ensurePostDisplayColumns() {
        addPostColumnIfMissing("recommend_count", "INT NOT NULL DEFAULT 0");
        addPostColumnIfMissing("unrecommend_count", "INT NOT NULL DEFAULT 0");
        addPostColumnIfMissing("view_count", "INT NOT NULL DEFAULT 0");
        addPostColumnIfMissing("is_draft", "TINYINT(1) NOT NULL DEFAULT 0");
        addPostColumnIfMissing("is_secret", "TINYINT(1) NOT NULL DEFAULT 0");
        addPostColumnIfMissing("is_concept", "TINYINT(1) NOT NULL DEFAULT 0");
        addPostColumnIfMissing("is_notice", "TINYINT(1) NOT NULL DEFAULT 0");
        addPostColumnIfMissing("concept_target_count", "INT NULL");
        addPostColumnIfMissing("concept_manual_state", "VARCHAR(20) NOT NULL DEFAULT 'auto'");
        addPostColumnIfMissing("review_status", "VARCHAR(20) NOT NULL DEFAULT 'normal'");
        addPostColumnIfMissing("report_count", "INT NOT NULL DEFAULT 0");
        addPostColumnIfMissing("pinned_at", "DATETIME NULL");
        addPostColumnIfMissing("bumped_at", "DATETIME NULL");
        addPostColumnIfMissing("pin_order", "INT NULL");
        addPostColumnIfMissing("attachment_urls", "TEXT NULL");
    }

    private void migrateReservedBoardTagsToTopics() {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT gs.gall_id, gs.board_tags
                FROM gallery_setting gs
                WHERE gs.board_tags IS NOT NULL
                  AND TRIM(gs.board_tags) <> ''
                """);
        for (Map<String, Object> row : rows) {
            String gallId = nullableText(row.get("gall_id"));
            String currentTags = nullableText(row.get("board_tags"));
            if (gallId == null || !containsReservedBoardTag(currentTags)) {
                continue;
            }
            String nextTags = normalizeBoardTagsForBoard(gallId, currentTags);
            if (!sameText(currentTags, nextTags)) {
                jdbcTemplate.update("""
                        UPDATE gallery_setting
                        SET board_tags = ?, updated_at = NOW()
                        WHERE gall_id = ?
                        """, nextTags, gallId);
            }
        }
    }

    private void addPostColumnIfMissing(String columnName, String definition) {
        if (!columnExists("post", columnName)) {
            jdbcTemplate.execute("ALTER TABLE post ADD COLUMN " + columnName + " " + definition);
        }
    }

    private void ensurePostContentColumns() {
        addPostContentColumnIfMissing("post_id", "BIGINT NULL");
        addPostContentColumnIfMissing("gall_id", "VARCHAR(50) NULL");
        addPostContentColumnIfMissing("post_no", "BIGINT NULL");
        addPostContentColumnIfMissing("content", "MEDIUMTEXT NULL");
        addPostContentColumnIfMissing("content_format", "VARCHAR(30) NOT NULL DEFAULT 'html'");
        addPostContentColumnIfMissing("render_policy", "VARCHAR(30) NOT NULL DEFAULT 'trusted_html'");
        addPostContentColumnIfMissing("allow_images", "TINYINT(1) NOT NULL DEFAULT 1");
        addPostContentColumnIfMissing("image_count", "INT NOT NULL DEFAULT 0");
        addPostContentColumnIfMissing("word_count", "INT NOT NULL DEFAULT 0");
        addPostContentColumnIfMissing("updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP");
        addPostContentColumnIfMissing("created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    }

    private void addPostContentColumnIfMissing(String columnName, String definition) {
        if (!columnExists("post_content", columnName)) {
            jdbcTemplate.execute("ALTER TABLE post_content ADD COLUMN " + columnName + " " + definition);
        }
    }

    private void ensureSubmanagerPermissionColumns() {
        for (String column : SUBMANAGER_PERMISSION_COLUMNS) {
            if (!columnExists("board_submanager", column)) {
                int defaultValue = PERMISSION_MANAGE_SUBMANAGER.equals(column) ? 0 : 1;
                jdbcTemplate.execute("ALTER TABLE board_submanager ADD COLUMN " + column + " TINYINT(1) NOT NULL DEFAULT " + defaultValue);
            }
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

    private void seedBoardTopics() {
        List<Object[]> topics = List.of(
                new Object[]{"game", "게임", "게임, e스포츠, 콘솔, PC/모바일 게임", 10},
                new Object[]{"politics", "정치", "국내외 정치, 정책, 선거", 20},
                new Object[]{"industry", "산업", "기업, 산업 동향, 제조, 기술", 30},
                new Object[]{"economy", "경제", "경제, 금융, 투자, 부동산", 40},
                new Object[]{"culture", "문화", "영화, 음악, 방송, 예술", 50},
                new Object[]{"sports", "스포츠", "스포츠, 리그, 선수, 경기", 60},
                new Object[]{"life", "생활", "일상, 취미, 생활 정보", 70},
                new Object[]{"technology", "기술", "IT, 개발, AI, 기기", 80},
                new Object[]{"society", "사회", "사건, 이슈, 지역, 커뮤니티", 90},
                new Object[]{"other", "기타", "위 분류에 속하지 않는 주제", 999}
        );
        jdbcTemplate.batchUpdate("""
                INSERT INTO board_topic (topic_id, topic_name, description, sort_order, is_active)
                VALUES (?, ?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    topic_name = VALUES(topic_name),
                    description = VALUES(description),
                    sort_order = VALUES(sort_order),
                    is_active = 1
                """, topics);
    }

    public List<Map<String, Object>> getBoardTopics() {
        return jdbcTemplate.queryForList("""
                SELECT topic_id, topic_name, description, sort_order
                FROM board_topic
                WHERE is_active = 1
                ORDER BY sort_order ASC, topic_name ASC
                """);
    }

    public List<Map<String, Object>> getBoardList() {
        String sql = """
                SELECT g.gall_id,
                       g.gall_name,
                       g.gall_type,
                       g.category,
                       g.topic_id,
                       bt.topic_name,
                       g.status,
                       g.post_count,
                       g.manager_uid,
                       gs.board_tags,
                       manager.nick AS manager_nick,
                       (
                           SELECT COUNT(*)
                           FROM board_submanager bs
                           WHERE bs.gall_id = g.gall_id
                       ) AS submanager_count
                FROM board g
                LEFT JOIN board_topic bt ON bt.topic_id = g.topic_id
                LEFT JOIN gallery_setting gs ON gs.gall_id = g.gall_id
                LEFT JOIN user manager ON manager.uid = g.manager_uid
                ORDER BY COALESCE(bt.sort_order, 9999) ASC,
                         COALESCE(bt.topic_name, '기타') ASC,
                         g.gall_name ASC,
                         g.gall_id ASC
                """;
        return resolveBoardTagRows(jdbcTemplate.queryForList(sql));
    }

    public Map<String, Object> getMyBoardDashboard(String uid) {
        String actor = required(uid, "로그인이 필요합니다.");
        List<Map<String, Object>> requestedBoards = jdbcTemplate.queryForList("""
                SELECT br.request_id,
                       br.gall_id,
                       br.gall_name,
                       br.gall_type,
                       br.topic_id,
                       bt.topic_name,
                       br.reason,
                       br.status,
                       br.reviewed_by,
                       reviewer.nick AS reviewed_by_nick,
                       br.reviewed_at,
                       br.created_at
                FROM board_request br
                LEFT JOIN board_topic bt ON bt.topic_id = br.topic_id
                LEFT JOIN user reviewer ON reviewer.uid = br.reviewed_by
                WHERE br.requester_uid = ?
                ORDER BY br.created_at DESC, br.request_id DESC
                LIMIT 50
                """, actor);
        List<Map<String, Object>> managedBoards = jdbcTemplate.queryForList("""
                SELECT b.gall_id,
                       b.gall_name,
                       b.gall_type,
                       b.topic_id,
                       bt.topic_name,
                       b.status,
                       b.post_count,
                       'manager' AS board_role,
                       NULL AS appointed_by,
                       NULL AS appointed_by_nick,
                       NULL AS appointed_at
                FROM board b
                LEFT JOIN board_topic bt ON bt.topic_id = b.topic_id
                WHERE b.manager_uid = ?
                  AND COALESCE(b.status, 'active') <> 'deleted'
                UNION ALL
                SELECT b.gall_id,
                       b.gall_name,
                       b.gall_type,
                       b.topic_id,
                       bt.topic_name,
                       b.status,
                       b.post_count,
                       'submanager' AS board_role,
                       bs.appointed_by,
                       appointor.nick AS appointed_by_nick,
                       bs.appointed_at
                FROM board_submanager bs
                JOIN board b ON b.gall_id = bs.gall_id
                LEFT JOIN board_topic bt ON bt.topic_id = b.topic_id
                LEFT JOIN user appointor ON appointor.uid = bs.appointed_by
                WHERE bs.uid = ?
                  AND COALESCE(b.status, 'active') <> 'deleted'
                ORDER BY gall_name ASC, gall_id ASC
                """, actor, actor);
        return Map.of(
                "requestedBoards", requestedBoards,
                "managedBoards", managedBoards
        );
    }

    public Map<String, Object> getBoardRankingData() {
        autoRefreshBoardRankingsIfNeeded();
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> items = jdbcTemplate.queryForList("""
                SELECT rank_no,
                       gall_id,
                       gall_name,
                       gall_type,
                       score,
                       post_count,
                       recent_post_count,
                       recent_recommend_sum,
                       refreshed_at
                FROM board_ranking_snapshot
                WHERE ranking_date = ?
                ORDER BY rank_no ASC
                """, today);
        Integer refreshCount = jdbcTemplate.queryForObject("""
                SELECT COALESCE(refresh_count, 0)
                FROM board_ranking_refresh_state
                WHERE ranking_date = ?
                """, Integer.class, today);
        LocalDateTime lastRefreshedAt = toLocalDateTime(jdbcTemplate.queryForObject("""
                SELECT last_refreshed_at
                FROM board_ranking_refresh_state
                WHERE ranking_date = ?
                """, Object.class, today));
        int used = refreshCount == null ? 0 : refreshCount;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("rankingDate", today.toString());
        result.put("refreshCount", used);
        result.put("remainingRefreshes", Math.max(0, BOARD_RANKING_DAILY_LIMIT - used));
        result.put("canRefresh", false);
        result.put("lastRefreshedAt", lastRefreshedAt == null ? null : lastRefreshedAt.toString());
        result.put("items", items);
        return result;
    }

    @Transactional
    public Map<String, Object> refreshBoardRankings() {
        LocalDate today = LocalDate.now();
        jdbcTemplate.update("""
                INSERT INTO board_ranking_refresh_state (ranking_date, refresh_count, last_refreshed_at)
                VALUES (?, 0, NULL)
                ON DUPLICATE KEY UPDATE ranking_date = ranking_date
                """, today);
        Integer refreshCount = jdbcTemplate.queryForObject("""
                SELECT COALESCE(refresh_count, 0)
                FROM board_ranking_refresh_state
                WHERE ranking_date = ?
                """, Integer.class, today);
        int used = refreshCount == null ? 0 : refreshCount;
        if (used >= BOARD_RANKING_DAILY_LIMIT) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        rebuildBoardRankings(today);
        jdbcTemplate.update("""
                UPDATE board_ranking_refresh_state
                SET refresh_count = refresh_count + 1,
                    last_refreshed_at = NOW()
                WHERE ranking_date = ?
                """, today);
        return getBoardRankingData();
    }

    @Scheduled(fixedRate = 300000)
    public void autoRefreshBoardRankingsOnSchedule() {
        try {
            autoRefreshBoardRankingsIfNeeded();
        } catch (Exception e) {
            System.err.println("[Board Ranking Scheduler Error] " + e.getMessage());
        }
    }

    public List<Map<String, Object>> getPostsByGallery(String gallId, int page) {
        return getPostsByGallery(gallId, page, "all", null);
    }

    public List<Map<String, Object>> getPostsByGallery(String gallId, int page, String mode, String category) {
        int size = BOARD_POSTS_PAGE_SIZE;
        int offset = Math.max(page - 1, 0) * size;
        String normalizedMode = normalizeBoardListMode(mode);
        String normalizedCategory = normalizeBoardListCategory(gallId, category);
        boolean hasCategory = columnExists("post", "category");
        boolean hasDraft = columnExists("post", "is_draft");
        boolean hasSecret = columnExists("post", "is_secret");
        boolean hasReviewStatus = columnExists("post", "review_status");
        boolean hasConcept = columnExists("post", "is_concept");
        boolean hasNotice = columnExists("post", "is_notice");
        boolean hasPinnedAt = columnExists("post", "pinned_at");
        boolean hasBumpedAt = columnExists("post", "bumped_at");

        if ("concept".equalsIgnoreCase(normalizedMode) && !hasConcept) {
            return new ArrayList<>();
        }
        if ("notice".equalsIgnoreCase(normalizedMode) && !hasNotice) {
            return new ArrayList<>();
        }
        if (normalizedCategory != null && !hasCategory) {
            return new ArrayList<>();
        }

        StringBuilder sql = new StringBuilder("""
                SELECT p.*, g.gall_name, g.manager_uid,
                       author.nick_type,
                       author.nick_icon_type,
                       CASE
                           WHEN LOWER(COALESCE(g.gall_type, '')) <> 'main' AND p.writer_uid IS NOT NULL AND p.writer_uid = g.manager_uid THEN 'manager'
                           WHEN LOWER(COALESCE(g.gall_type, '')) <> 'main' AND p.writer_uid IS NOT NULL AND EXISTS (
                               SELECT 1
                               FROM board_submanager bs
                               WHERE bs.gall_id = p.gall_id
                                 AND bs.uid = p.writer_uid
                           ) THEN 'submanager'
                           ELSE NULL
                       END AS author_board_role,
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
                """);
        List<Object> args = new ArrayList<>();
        args.add(gallId);
        if (hasDraft) {
            sql.append(" AND COALESCE(p.is_draft, 0) = 0");
        }
        if (hasSecret) {
            sql.append(" AND COALESCE(p.is_secret, 0) = 0");
        }
        if (hasReviewStatus) {
            sql.append(" AND COALESCE(p.review_status, 'normal') <> 'review'");
        }
        if ("concept".equalsIgnoreCase(normalizedMode)) {
            sql.append(" AND COALESCE(p.is_concept, 0) = 1");
        } else if ("notice".equalsIgnoreCase(normalizedMode)) {
            sql.append(" AND COALESCE(p.is_notice, 0) = 1");
        }
        if (normalizedCategory != null) {
            sql.append(" AND COALESCE(p.category, '') = ?");
            args.add(normalizedCategory);
        }
        sql.append(" ORDER BY ");
        if (hasNotice) {
            sql.append("COALESCE(p.is_notice, 0) DESC, ");
        }
        if (hasPinnedAt) {
            sql.append("p.pinned_at DESC, ");
        }
        if (hasBumpedAt) {
            sql.append("COALESCE(p.bumped_at, p.writed_at) DESC, ");
        }
        sql.append("p.writed_at DESC, p.id DESC, p.post_no DESC LIMIT ? OFFSET ?");
        args.add(size);
        args.add(offset);
        return decorateListRows(sanitizeRowsContent(jdbcTemplate.queryForList(sql.toString(), args.toArray())));
    }

    public Map<String, Object> getPostDetail(String gallId, Long postNo) {
        String sql = """
                SELECT p.*, g.gall_name, g.manager_uid,
                       pc.content AS post_content_body,
                       pc.content_format,
                       pc.render_policy,
                       pc.allow_images,
                       pc.image_count,
                       pc.word_count,
                       author.nick_type,
                       author.nick_icon_type,
                       CASE
                           WHEN LOWER(COALESCE(g.gall_type, '')) <> 'main' AND p.writer_uid IS NOT NULL AND p.writer_uid = g.manager_uid THEN 'manager'
                           WHEN LOWER(COALESCE(g.gall_type, '')) <> 'main' AND p.writer_uid IS NOT NULL AND EXISTS (
                               SELECT 1
                               FROM board_submanager bs
                               WHERE bs.gall_id = p.gall_id
                                 AND bs.uid = p.writer_uid
                           ) THEN 'submanager'
                           ELSE NULL
                       END AS author_board_role,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN board g ON g.gall_id = p.gall_id
                LEFT JOIN post_content pc ON pc.post_id = p.id
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
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
        result.put("pendingStaffRequests", getPendingBoardStaffRequests(gallId));
        result.put("settings", getBoardSettings(gallId));
        boolean isAdmin = isGlobalAdmin(viewerDivision);
        boolean isManager = isBoardManager(gallId, viewerUid);
        boolean isSubmanager = isBoardSubmanager(gallId, viewerUid);
        Map<String, Object> permissions = new LinkedHashMap<>();
        permissions.put("isManager", isManager);
        permissions.put("isSubmanager", isSubmanager);
        permissions.put("isAdmin", isAdmin);
        permissions.put("canManage", canManageBoard(gallId, viewerUid, viewerDivision));
        permissions.put("canEditSettings", canEditBoardSettings(gallId, viewerUid, viewerDivision));
        permissions.put("canModerate", canModerateBoardContent(gallId, viewerUid, viewerDivision));
        permissions.put("canDeletePost", canDeletePost(gallId, viewerUid, viewerDivision));
        permissions.put("canDeleteComment", canDeleteComment(gallId, viewerUid, viewerDivision));
        permissions.put("canManageWrite", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_WRITE));
        permissions.put("canManageGuestPenalty", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_GUEST_PENALTY));
        permissions.put("canManageTags", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_TAGS));
        permissions.put("canManageImages", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_IMAGES));
        permissions.put("canManageNotice", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_NOTICE));
        permissions.put("canManageCategories", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_CATEGORIES));
        permissions.put("canManageCover", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_COVER));
        permissions.put("canBanUser", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_BAN_USER));
        permissions.put("canManageForbiddenWord", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_FORBIDDEN_WORD));
        permissions.put("canBumpPost", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_BUMP_POST));
        permissions.put("canManageConcept", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_CONCEPT));
        permissions.put("canManageConceptCut", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_CONCEPT_CUT));
        permissions.put("canManageSubmanager", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_MANAGE_SUBMANAGER));
        permissions.put("canAppoint", canAssignBoardStaff(gallId, viewerUid, viewerDivision));
        permissions.put("canAssignSubmanager", canAssignBoardStaff(gallId, viewerUid, viewerDivision));
        permissions.put("canTransferManager", canTransferBoardManager(gallId, viewerUid, viewerDivision));
        result.put("permissions", permissions);
        result.put("boardBans", hasBoardPermission(gallId, viewerUid, viewerDivision, PERMISSION_BAN_USER) ? getActiveBoardBans(gallId) : List.of());
        result.put("roleLabels", resolveBoardRoleLabels(gallId, viewerUid, viewerDivision));
        return result;
    }

    private List<Map<String, Object>> getActiveBoardBans(String gallId) {
        return jdbcTemplate.queryForList("""
                SELECT bb.ban_id,
                       bb.gall_id,
                       bb.target_uid,
                       tu.nick AS target_nick,
                       bb.target_ip,
                       bb.banned_by,
                       bu.nick AS banned_by_nick,
                       bb.reason,
                       bb.banned_at,
                       bb.expires_at
                FROM board_ban bb
                LEFT JOIN user tu ON tu.uid = bb.target_uid
                LEFT JOIN user bu ON bu.uid = bb.banned_by
                WHERE bb.gall_id = ?
                  AND (bb.expires_at IS NULL OR bb.expires_at > NOW())
                ORDER BY bb.banned_at DESC, bb.ban_id DESC
                LIMIT 200
                """, gallId);
    }

    private List<Map<String, Object>> getPendingBoardStaffRequests(String gallId) {
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                SELECT a.alarm_id,
                       a.uid,
                       a.alarm_type,
                       a.title,
                       a.content,
                       a.ref_type,
                       a.ref_id,
                       a.is_read,
                       a.created_at,
                       a.read_at,
                       target.nick AS target_nick
                FROM alarm a
                LEFT JOIN user target ON target.uid = a.uid
                WHERE a.ref_type = ?
                  AND a.ref_id = ?
                  AND a.is_read = 0
                  AND a.alarm_type IN (?, ?)
                ORDER BY a.created_at DESC, a.alarm_id DESC
                """,
                ALARM_REF_TYPE_BOARD_STAFF,
                boardId,
                ALARM_TYPE_MANAGER_REQUEST,
                ALARM_TYPE_SUBMANAGER_REQUEST);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = enrichRequestAlarm(row, "pending");
            String targetUid = firstNonBlank(nullableText(item.get("target_uid")), nullableText(row.get("uid")));
            String targetNick = firstNonBlank(nullableText(row.get("target_nick")), targetUid);
            item.put("target_uid", targetUid);
            item.put("target_nick", targetNick);
            item.put("display_name", formatStaffDisplayName(targetNick, targetUid));
            result.add(item);
        }
        return result;
    }

    public Map<String, Object> getBoardSettings(String gallId) {
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        Map<String, Object> defaults = defaultBoardSettings(boardId);
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap("""
                    SELECT gall_id,
                           board_notice,
                           welcome_message,
                           cover_image_url,
                           category_options,
                           board_tags,
                           theme_color,
                           concept_recommend_threshold,
                           allow_guest_post,
                           allow_guest_comment,
                           allow_member_image,
                           allow_guest_image,
                           join_policy,
                           visibility,
                           read_visibility,
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
            defaults.put("board_tags", normalizeBoardTagsForBoard(boardId, nullableText(row.get("board_tags"))));
            defaults.put("concept_recommend_threshold", normalizeConceptThreshold(row.get("concept_recommend_threshold")));
            defaults.put("allow_guest_post", toBooleanFlag(row.get("allow_guest_post")));
            defaults.put("allow_guest_comment", toBooleanFlag(row.get("allow_guest_comment")));
            defaults.put("allow_member_image", toBooleanFlag(row.get("allow_member_image")));
            defaults.put("allow_guest_image", toBooleanFlag(row.get("allow_guest_image")));
            defaults.put("join_policy", firstNonBlank(nullableText(row.get("join_policy")), "free"));
            defaults.put("visibility", firstNonBlank(nullableText(row.get("visibility")), "public"));
            defaults.put("read_visibility", firstNonBlank(nullableText(row.get("read_visibility")), "inherit"));
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
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        String actorUid = required(uid, "필수 값을 입력해 주세요.");

        Map<String, Object> boardRow = requireBoard(boardId);
        Map<String, Object> currentSettings = getBoardSettings(boardId);
        if (!canEditBoardSettings(boardId, actorUid, memberDivision)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        String requestedTopicId = nullableTrim(payload.get("topicId"));
        if (requestedTopicId != null) {
            String currentTopicId = nullableTrim(nullableText(boardRow.get("topic_id")));
            String normalizedCurrentTopicId = currentTopicId == null ? "other" : currentTopicId;
            if (!requestedTopicId.equalsIgnoreCase(normalizedCurrentTopicId)) {
                throw new RuntimeException("보드 주제는 개설 이후 변경할 수 없습니다.");
            }
        }

        String boardNotice = nullableTrim(payload.get("boardNotice"));
        String welcomeMessage = nullableTrim(payload.get("welcomeMessage"));
        String coverImageUrl = nullableTrim(payload.get("coverImageUrl"));
        String categoryOptions = normalizeCategoryOptions(payload.get("categoryOptions"));
        String boardTags = normalizeBoardTagsForBoard(boardId, payload.get("boardTags"));
        String themeColor = normalizeThemeColor(payload.get("themeColor"));
        int conceptRecommendThreshold = normalizeConceptThreshold(payload.get("conceptRecommendThreshold"));
        int allowGuestPost = parseBooleanFlag(payload.get("allowGuestPost"));
        int allowGuestComment = parseBooleanFlag(payload.get("allowGuestComment"));
        int allowMemberImage = parseBooleanFlag(payload.get("allowMemberImage"));
        int allowGuestImage = parseBooleanFlag(payload.get("allowGuestImage"));
        String joinPolicy = normalizeChoice(payload.get("joinPolicy"), List.of("free", "approval"), "free");
        String visibility = normalizeChoice(payload.get("visibility"), List.of("public", "private", "members"), "public");
        String readVisibility = normalizeChoice(payload.get("readVisibility"), List.of("inherit", "public", "private", "members"), "inherit");
        int pinnedNoticeCount = normalizeNonNegativeInt(payload.get("pinnedNoticeCount"), 3);
        String allowedAttachmentTypes = nullableTrim(payload.get("allowedAttachmentTypes"));
        long attachmentMaxBytes = normalizeLong(payload.get("attachmentMaxBytes"), 0L);
        String sideBoardApprovalPolicy = normalizeChoice(payload.get("sideBoardApprovalPolicy"), List.of("operator", "auto"), "operator");
        int dormantAfterDays = normalizeNonNegativeInt(payload.get("dormantAfterDays"), 180);

        assertBoardSettingPermissions(
                boardId,
                actorUid,
                memberDivision,
                currentSettings,
                boardNotice,
                welcomeMessage,
                coverImageUrl,
                categoryOptions,
                boardTags,
                themeColor,
                conceptRecommendThreshold,
                allowGuestPost,
                allowGuestComment,
                allowMemberImage,
                allowGuestImage,
                joinPolicy,
                visibility,
                readVisibility,
                pinnedNoticeCount,
                allowedAttachmentTypes,
                attachmentMaxBytes,
                sideBoardApprovalPolicy,
                dormantAfterDays
        );

        jdbcTemplate.update("""
                INSERT INTO gallery_setting (
                    gall_id, board_notice, welcome_message, cover_image_url, board_tags, theme_color, concept_recommend_threshold,
                    allow_guest_post, allow_guest_comment, allow_member_image, allow_guest_image, category_options,
                    join_policy, visibility, read_visibility, pinned_notice_count, allowed_attachment_types,
                    attachment_max_bytes, side_board_approval_policy, dormant_after_days,
                    updated_by, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    board_notice = VALUES(board_notice),
                    welcome_message = VALUES(welcome_message),
                    cover_image_url = VALUES(cover_image_url),
                    board_tags = VALUES(board_tags),
                    theme_color = VALUES(theme_color),
                    concept_recommend_threshold = VALUES(concept_recommend_threshold),
                    allow_guest_post = VALUES(allow_guest_post),
                    allow_guest_comment = VALUES(allow_guest_comment),
                    allow_member_image = VALUES(allow_member_image),
                    allow_guest_image = VALUES(allow_guest_image),
                    category_options = VALUES(category_options),
                    join_policy = VALUES(join_policy),
                    visibility = VALUES(visibility),
                    read_visibility = VALUES(read_visibility),
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
                boardTags,
                themeColor,
                conceptRecommendThreshold,
                allowGuestPost,
                allowGuestComment,
                allowMemberImage,
                allowGuestImage,
                categoryOptions,
                joinPolicy,
                visibility,
                readVisibility,
                pinnedNoticeCount,
                allowedAttachmentTypes,
                attachmentMaxBytes,
                sideBoardApprovalPolicy,
                dormantAfterDays,
                actorUid
        );

        syncConceptTargetsForThresholdChange(boardId, normalizeConceptThreshold(currentSettings.get("concept_recommend_threshold")), conceptRecommendThreshold);

        return getBoardSettings(boardId);
    }

    private void syncConceptTargetsForThresholdChange(String boardId, int previousThreshold, int currentThreshold) {
        if (previousThreshold == currentThreshold) {
            return;
        }
        if (currentThreshold < previousThreshold) {
            jdbcTemplate.update("""
                    UPDATE post
                    SET concept_target_count = CASE
                        WHEN COALESCE(is_concept, 0) = 1 THEN concept_target_count
                        WHEN COALESCE(concept_manual_state, 'auto') <> 'auto' THEN concept_target_count
                        WHEN COALESCE(recommend_count, 0) >= ? AND COALESCE(recommend_count, 0) < ? THEN COALESCE(recommend_count, 0) + 1
                        WHEN COALESCE(recommend_count, 0) < ? THEN ?
                        ELSE concept_target_count
                    END
                    WHERE gall_id = ?
                      AND is_deleted = 0
                    """, currentThreshold, previousThreshold, currentThreshold, currentThreshold, boardId);
            return;
        }
        jdbcTemplate.update("""
                UPDATE post
                SET concept_target_count = CASE
                    WHEN COALESCE(is_concept, 0) = 1 THEN concept_target_count
                    WHEN COALESCE(concept_manual_state, 'auto') <> 'auto' THEN concept_target_count
                    ELSE ?
                END
                WHERE gall_id = ?
                  AND is_deleted = 0
                """, currentThreshold, boardId);
    }

    @Transactional
    public Map<String, Object> renameBoardCategory(String gallId, Map<String, String> payload, String uid, String memberDivision) {
        String boardId = required(gallId, "보드 ID가 필요합니다.");
        String actorUid = required(uid, "로그인이 필요합니다.");
        requireBoardPermission(boardId, actorUid, memberDivision, PERMISSION_MANAGE_CATEGORIES, "말머리를 변경할 권한이 없습니다.");

        String oldName = normalizeCategoryName(payload == null ? null : payload.get("oldName"), "기존 말머리를 입력해 주세요.");
        String newName = normalizeCategoryName(payload == null ? null : payload.get("newName"), "새 말머리를 입력해 주세요.");
        if (oldName.equals(newName)) {
            return Map.of("updatedPosts", 0, "settings", getBoardSettings(boardId));
        }

        List<String> options = parseCategoryOptions(getBoardSettings(boardId).get("category_options"));
        if (!options.contains(oldName)) {
            throw new RuntimeException("기존 말머리를 찾을 수 없습니다.");
        }
        if (options.contains(newName)) {
            throw new RuntimeException("이미 사용 중인 말머리입니다.");
        }
        for (int i = 0; i < options.size(); i++) {
            if (oldName.equals(options.get(i))) {
                options.set(i, newName);
                break;
            }
        }
        String nextOptions = String.join("\n", options);
        jdbcTemplate.update("""
                INSERT INTO gallery_setting (gall_id, category_options, updated_by, updated_at)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    category_options = VALUES(category_options),
                    updated_by = VALUES(updated_by),
                    updated_at = NOW()
                """, boardId, nextOptions, actorUid);
        int updatedPosts = jdbcTemplate.update("""
                UPDATE post
                SET category = ?
                WHERE gall_id = ?
                  AND category = ?
                  AND is_deleted = 0
                """, newName, boardId, oldName);
        return Map.of("updatedPosts", updatedPosts, "settings", getBoardSettings(boardId));
    }

    @Transactional
    public Map<String, Object> renameBoardTag(String gallId, Map<String, String> payload, String uid, String memberDivision) {
        String boardId = required(gallId, "보드 ID가 필요합니다.");
        String actorUid = required(uid, "로그인이 필요합니다.");
        requireBoardPermission(boardId, actorUid, memberDivision, PERMISSION_MANAGE_TAGS, "태그를 변경할 권한이 없습니다.");

        String oldName = normalizeTagName(payload == null ? null : payload.get("oldName"), "기존 태그명을 입력해 주세요.");
        String newName = normalizeTagName(payload == null ? null : payload.get("newName"), "새 태그명을 입력해 주세요.");
        if (oldName.equals(newName)) {
            return Map.of("updatedTags", 0, "settings", getBoardSettings(boardId));
        }

        List<String> tags = parseBoardTags(getBoardSettings(boardId).get("board_tags"));
        if (!tags.contains(oldName)) {
            throw new RuntimeException("기존 태그를 찾을 수 없습니다.");
        }
        if (tags.contains(newName)) {
            throw new RuntimeException("이미 사용 중인 태그입니다.");
        }
        for (int i = 0; i < tags.size(); i++) {
            if (oldName.equals(tags.get(i))) {
                tags.set(i, newName);
                break;
            }
        }
        String nextTags = normalizeBoardTagsForBoard(boardId, tags.isEmpty() ? null : String.join(" ", tags));
        jdbcTemplate.update("""
                INSERT INTO gallery_setting (gall_id, board_tags, updated_by, updated_at)
                VALUES (?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    board_tags = VALUES(board_tags),
                    updated_by = VALUES(updated_by),
                    updated_at = NOW()
                """, boardId, nextTags, actorUid);
        return Map.of("updatedTags", 1, "settings", getBoardSettings(boardId));
    }

    private String normalizeCategoryName(String value, String message) {
        String normalized = required(nullableTrim(value), message);
        if (normalized.length() > 20 || normalized.contains(",") || normalized.contains("\n") || normalized.contains("\r") || normalized.startsWith(":")) {
            throw new RuntimeException("사용할 수 없는 말머리명입니다.");
        }
        return normalized;
    }

    private String normalizeTagName(String value, String message) {
        String normalized = required(nullableTrim(value), message);
        if (normalized.length() > 50 || normalized.matches(".*[\\s,]+.*")) {
            throw new RuntimeException("사용할 수 없는 태그명입니다.");
        }
        return normalized;
    }

    private void assertBoardSettingPermissions(
            String boardId,
            String actorUid,
            String memberDivision,
            Map<String, Object> current,
            String boardNotice,
            String welcomeMessage,
            String coverImageUrl,
            String categoryOptions,
            String boardTags,
            String themeColor,
            int conceptRecommendThreshold,
            int allowGuestPost,
            int allowGuestComment,
            int allowMemberImage,
            int allowGuestImage,
            String joinPolicy,
            String visibility,
            String readVisibility,
            int pinnedNoticeCount,
            String allowedAttachmentTypes,
            long attachmentMaxBytes,
            String sideBoardApprovalPolicy,
            int dormantAfterDays
    ) {
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "board_notice", boardNotice, PERMISSION_MANAGE_NOTICE, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "welcome_message", welcomeMessage, PERMISSION_MANAGE_NOTICE, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "cover_image_url", coverImageUrl, PERMISSION_MANAGE_COVER, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "theme_color", themeColor, PERMISSION_MANAGE_COVER, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "category_options", categoryOptions, PERMISSION_MANAGE_CATEGORIES, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "board_tags", boardTags, PERMISSION_MANAGE_TAGS, "보드 태그를 변경할 권한이 없습니다.");
        requirePermissionIfIntChanged(boardId, actorUid, memberDivision, current, "concept_recommend_threshold", conceptRecommendThreshold, PERMISSION_MANAGE_CONCEPT_CUT, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfFlagChanged(boardId, actorUid, memberDivision, current, "allow_guest_post", allowGuestPost, PERMISSION_MANAGE_WRITE, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfFlagChanged(boardId, actorUid, memberDivision, current, "allow_guest_comment", allowGuestComment, PERMISSION_MANAGE_WRITE, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfFlagChanged(boardId, actorUid, memberDivision, current, "allow_member_image", allowMemberImage, PERMISSION_MANAGE_IMAGES, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfFlagChanged(boardId, actorUid, memberDivision, current, "allow_guest_image", allowGuestImage, PERMISSION_MANAGE_IMAGES, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "join_policy", joinPolicy, PERMISSION_MANAGE_GUEST_PENALTY, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "visibility", visibility, PERMISSION_MANAGE_GUEST_PENALTY, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "read_visibility", readVisibility, PERMISSION_MANAGE_GUEST_PENALTY, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfIntChanged(boardId, actorUid, memberDivision, current, "pinned_notice_count", pinnedNoticeCount, PERMISSION_MANAGE_NOTICE, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "allowed_attachment_types", allowedAttachmentTypes, PERMISSION_MANAGE_IMAGES, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfLongChanged(boardId, actorUid, memberDivision, current, "attachment_max_bytes", attachmentMaxBytes, PERMISSION_MANAGE_IMAGES, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfChanged(boardId, actorUid, memberDivision, current, "side_board_approval_policy", sideBoardApprovalPolicy, PERMISSION_MANAGE_SUBMANAGER, "해당 설정을 변경할 권한이 없습니다.");
        requirePermissionIfIntChanged(boardId, actorUid, memberDivision, current, "dormant_after_days", dormantAfterDays, PERMISSION_MANAGE_GUEST_PENALTY, "해당 설정을 변경할 권한이 없습니다.");
    }

    private void requirePermissionIfChanged(String boardId, String actorUid, String memberDivision, Map<String, Object> current, String key, String nextValue, String permission, String message) {
        if (!sameText(nullableText(current.get(key)), nextValue)) {
            requireBoardPermission(boardId, actorUid, memberDivision, permission, message);
        }
    }

    private void requirePermissionIfFlagChanged(String boardId, String actorUid, String memberDivision, Map<String, Object> current, String key, int nextValue, String permission, String message) {
        if ((toBooleanFlag(current.get(key)) ? 1 : 0) != nextValue) {
            requireBoardPermission(boardId, actorUid, memberDivision, permission, message);
        }
    }

    private void requirePermissionIfIntChanged(String boardId, String actorUid, String memberDivision, Map<String, Object> current, String key, int nextValue, String permission, String message) {
        if (normalizeNonNegativeInt(current.get(key), 0) != nextValue) {
            requireBoardPermission(boardId, actorUid, memberDivision, permission, message);
        }
    }

    private void requirePermissionIfLongChanged(String boardId, String actorUid, String memberDivision, Map<String, Object> current, String key, long nextValue, String permission, String message) {
        if (normalizeLong(current.get(key), 0L) != nextValue) {
            requireBoardPermission(boardId, actorUid, memberDivision, permission, message);
        }
    }

    private void requireBoardPermission(String boardId, String actorUid, String memberDivision, String permission, String message) {
        if (!hasBoardPermission(boardId, actorUid, memberDivision, permission)) {
            throw new RuntimeException(message);
        }
    }

    private boolean sameText(String left, String right) {
        String normalizedLeft = left == null ? "" : left.trim();
        String normalizedRight = right == null ? "" : right.trim();
        return normalizedLeft.equals(normalizedRight);
    }

    public boolean canUploadImage(String gallId, String uid) {
        Map<String, Object> settings = getBoardSettings(gallId);
        if (uid != null && !uid.isBlank()) {
            return toBooleanFlag(settings.get("allow_member_image"));
        }
        return toBooleanFlag(settings.get("allow_guest_image"));
    }

    public void assertAttachmentPolicy(String gallId, String contentType, long size) {
        Map<String, Object> settings = getBoardSettings(gallId);
        String allowedTypes = nullableText(settings.get("allowed_attachment_types"));
        if (allowedTypes == null) {
            return;
        }
        String normalizedType = nullableText(contentType);
        if (normalizedType == null) {
            return;
        }
        normalizedType = normalizedType.trim().toLowerCase(Locale.ROOT);
        if ("application/octet-stream".equals(normalizedType)) {
            return;
        }
        if ("image/jpg".equals(normalizedType) || "image/pjpeg".equals(normalizedType)) {
            normalizedType = "image/jpeg";
        }
        boolean allowed = false;
        for (String item : allowedTypes.split("[,\\r\\n]+")) {
            String allowedType = item.trim().toLowerCase(Locale.ROOT);
            if (!allowedType.isBlank() && (allowedType.equals(normalizedType) || ("image/*".equals(allowedType) && normalizedType.startsWith("image/")))) {
                allowed = true;
                break;
            }
        }
        if (!allowed) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
    }

    @Transactional
    public void assignManager(String gallId, String targetUid, String actorUid, String actorDivision) {
        assignManager(gallId, targetUid, actorUid, actorDivision, null);
    }

    @Transactional
    public void assignManager(String gallId, String targetUid, String actorUid, String actorDivision, String actorPassword) {
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        String actor = required(actorUid, "필수 값을 입력해 주세요.");
        String resolvedTarget = required(targetUid == null || targetUid.isBlank() ? actorUid : targetUid, "필수 값을 입력해 주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        String currentManager = nullableText(board.get("manager_uid"));
        boolean globalAdmin = isGlobalAdmin(actorDivision);

        if (currentManager == null || currentManager.isBlank()) {
            if (!globalAdmin && !actor.equals(resolvedTarget)) {
                throw new RuntimeException("요청을 처리할 수 없습니다.");
            }
        } else if (!globalAdmin && !currentManager.equals(actor)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        if (currentManager != null && !currentManager.isBlank() && !globalAdmin && !isBoardSubmanager(boardId, resolvedTarget)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        requireManagerPasswordForStaffAction(boardId, actor, actorDivision, actorPassword, board, "manager transfer");
        createBoardStaffRequest(board, resolvedTarget, actor, "manager");
    }

    @Transactional
    public void appointSubmanager(String gallId, String targetUid, String actorUid, String actorDivision) {
        appointSubmanager(gallId, targetUid, actorUid, actorDivision, null);
    }

    @Transactional
    public void appointSubmanager(String gallId, String targetUid, String actorUid, String actorDivision, String actorPassword) {
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        String actor = required(actorUid, "필수 값을 입력해 주세요.");
        String resolvedTarget = required(targetUid, "필수 값을 입력해 주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        String managerUid = getManagerUid(boardId);
        if (managerUid != null && managerUid.equals(resolvedTarget)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        requireManagerPasswordForStaffAction(boardId, actor, actorDivision, actorPassword, board, "submanager appointment");
        createBoardStaffRequest(board, resolvedTarget, actor, "submanager");
    }

    @Transactional
    public void revokeSubmanager(String gallId, String targetUid, String actorUid, String actorDivision) {
        revokeSubmanager(gallId, targetUid, actorUid, actorDivision, null);
    }

    @Transactional
    public void revokeSubmanager(String gallId, String targetUid, String actorUid, String actorDivision, String actorPassword) {
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        String actor = required(actorUid, "필수 값을 입력해 주세요.");
        String resolvedTarget = required(targetUid, "필수 값을 입력해 주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        requireManagerPasswordForStaffAction(boardId, actor, actorDivision, actorPassword, board, "부매니저 해임");
        jdbcTemplate.update("DELETE FROM board_submanager WHERE gall_id = ? AND uid = ?", boardId, resolvedTarget);
    }

    @Transactional
    public Map<String, Object> updateSubmanagerPermissions(String gallId, String targetUid, Map<String, String> payload, String actorUid, String actorDivision) {
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        String actor = required(actorUid, "필수 값을 입력해 주세요.");
        String resolvedTarget = required(targetUid, "필수 값을 입력해 주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)
                && !hasBoardPermission(boardId, actor, actorDivision, PERMISSION_MANAGE_SUBMANAGER)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        if (!isBoardSubmanager(boardId, resolvedTarget)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        StringBuilder sql = new StringBuilder("UPDATE board_submanager SET ");
        List<Object> args = new ArrayList<>();
        boolean appended = false;
        for (String column : SUBMANAGER_PERMISSION_COLUMNS) {
            if (payload != null && payload.containsKey(column)) {
                if (appended) {
                    sql.append(", ");
                }
                sql.append(column).append(" = ?");
                args.add(parseBooleanFlag(payload.get(column)));
                appended = true;
            }
        }
        if (!appended) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        sql.append(" WHERE gall_id = ? AND uid = ?");
        args.add(boardId);
        args.add(resolvedTarget);
        jdbcTemplate.update(sql.toString(), args.toArray());
        return getBoardManageInfo(boardId, actor, actorDivision);
    }

    public List<Map<String, Object>> getMyAlarms(String uid) {
        String resolvedUid = required(uid, "필수 값을 입력해 주세요.");
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
        String role = required(payload.get("role"), "역할 정보가 없습니다.");
        String gallId = required(payload.get("gallId"), "보드 ID가 없습니다.");
        String targetUid = required(payload.get("targetUid"), "대상 사용자 정보가 없습니다.");
        String requesterUid = required(payload.get("requesterUid"), "요청자 정보가 없습니다.");

        if (!uid.equals(targetUid)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
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

        throw new RuntimeException("요청을 처리할 수 없습니다.");
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
        throw new RuntimeException("요청을 처리할 수 없습니다.");
    }

    @Transactional
    public void requestSideBoardCreation(Map<String, String> payload, String requesterUid) {
        String uid = required(requesterUid, "필수 값을 입력해 주세요.");
        String gallId = normalizeRequestedGallId(payload.get("gallId"));
        String gallName = required(payload.get("gallName"), "보드 이름을 입력해 주세요.");
        String topicId = resolveBoardTopicForApproval(requesterUid, gallId, payload.get("topicId"));
        String reason = required(payload.get("reason"), "신청 사유를 입력해 주세요.");

        ensureSideBoardRequestAllowed(uid, gallId, gallName);

        if (isSideBoardAutoApprovalEnabled()) {
            jdbcTemplate.update("""
                    INSERT INTO board (gall_id, gall_name, gall_type, category, topic_id, manager_uid, post_count, status)
                    VALUES (?, ?, 'm', 'user-requested', ?, ?, 0, 'active')
                    """, gallId, gallName, topicId, uid);
            jdbcTemplate.update("""
                    INSERT INTO board_counter (gall_id, last_post_no)
                    VALUES (?, 0)
                    ON DUPLICATE KEY UPDATE last_post_no = last_post_no
                    """, gallId);
            jdbcTemplate.update("""
                    INSERT INTO board_request (
                        requester_uid, gall_id, gall_name, gall_type, topic_id, reason, status, reviewed_by, reviewed_at, created_at
                    )
                    VALUES (?, ?, ?, 'm', ?, ?, 'approved', 'system', NOW(), NOW())
                    """, uid, gallId, gallName, topicId, reason);
            notifyRequesterBoardRequestResult(uid, gallId, gallName, true, reason);
            return;
        }

        jdbcTemplate.update("""
                INSERT INTO board_request (
                    requester_uid, gall_id, gall_name, gall_type, topic_id, reason, status, reviewed_by, reviewed_at, created_at
                )
                VALUES (?, ?, ?, 'm', ?, ?, 'pending', NULL, NULL, NOW())
                """, uid, gallId, gallName, topicId, reason);

        notifyAdminsForSideBoardRequest(uid, gallId, gallName, topicId, reason);
    }

    public Map<String, Object> getAdminRequestDashboard(String adminUid) {
        String uid = required(adminUid, "필수 값을 입력해 주세요.");
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
                       br.topic_id,
                       bt.topic_name,
                       br.reason,
                       br.status,
                       br.reviewed_by,
                       reviewer.nick AS reviewed_by_nick,
                       br.reviewed_at,
                       br.created_at
                FROM board_request br
                LEFT JOIN board_topic bt ON bt.topic_id = br.topic_id
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
        String gallId = required(payload.get("gid"), "보드 ID를 입력해 주세요.");
        String title = required(payload.get("title"), "제목을 입력해 주세요.");
        String content = requiredHtml(payload.get("content"), "본문을 입력해 주세요.");
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        Integer createdPostNo = jdbcTemplate.queryForObject(
                "SELECT last_post_no FROM board_counter WHERE gall_id = ?",
                Integer.class,
                gallId
        );
        if (createdPostNo == null) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
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
        Long postId = jdbcTemplate.queryForObject(
                "SELECT id FROM post WHERE gall_id = ? AND post_no = ?",
                Long.class,
                gallId,
                createdPostNo
        );
        upsertPostContent(postId, gallId, createdPostNo.longValue(), content);
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
        Map<String, Object> board = getBoardRow(gallId);
        if (isGlobalAdmin(memberDivision)) {
            return true;
        }
        if (!isManagedBoardEligible(board)) {
            return false;
        }
        if (uid == null || uid.isBlank()) {
            return false;
        }
        return isBoardManager(gallId, uid) || isBoardSubmanager(gallId, uid);
    }

    public boolean canModerateBoardContent(String gallId, String uid, String memberDivision) {
        return canDeletePost(gallId, uid, memberDivision)
                || canDeleteComment(gallId, uid, memberDivision)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_BAN_USER)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_FORBIDDEN_WORD)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_CONCEPT)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_BUMP_POST);
    }

    public boolean canEditBoardSettings(String gallId, String uid, String memberDivision) {
        return hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_WRITE)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_GUEST_PENALTY)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_TAGS)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_IMAGES)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_NOTICE)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_CATEGORIES)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_COVER)
                || hasBoardPermission(gallId, uid, memberDivision, PERMISSION_MANAGE_CONCEPT_CUT);
    }

    public boolean canDeletePost(String gallId, String uid, String memberDivision) {
        return hasBoardDeletePermission(gallId, uid, memberDivision, PERMISSION_DELETE_POST);
    }

    public boolean canDeleteComment(String gallId, String uid, String memberDivision) {
        return hasBoardDeletePermission(gallId, uid, memberDivision, PERMISSION_DELETE_COMMENT);
    }

    private boolean hasBoardDeletePermission(String gallId, String uid, String memberDivision, String permissionColumn) {
        if (isGlobalAdmin(memberDivision)) {
            return true;
        }
        if (uid == null || uid.isBlank()) {
            return false;
        }
        if (isBoardManager(gallId, uid)) {
            return true;
        }
        return hasBoardPermission(gallId, uid, memberDivision, permissionColumn);
    }

    public boolean hasBoardPermission(String gallId, String uid, String memberDivision, String permissionColumn) {
        if (!SUBMANAGER_PERMISSION_COLUMNS.contains(permissionColumn)) {
            return false;
        }
        Map<String, Object> board = getBoardRow(gallId);
        if (isGlobalAdmin(memberDivision)) {
            return true;
        }
        if (!isManagedBoardEligible(board)) {
            return false;
        }
        if (uid == null || uid.isBlank()) {
            return false;
        }
        if (isBoardManager(gallId, uid)) {
            return true;
        }
        if (!isBoardSubmanager(gallId, uid)) {
            return false;
        }
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM board_submanager WHERE gall_id = ? AND uid = ? AND " + permissionColumn + " = 1",
                Integer.class,
                gallId,
                uid
        );
        return count != null && count > 0;
    }

    public boolean canAssignBoardStaff(String gallId, String uid, String memberDivision) {
        Map<String, Object> board = getBoardRow(gallId);
        if (!isManagedBoardEligible(board)) {
            return false;
        }
        if (isGlobalAdmin(memberDivision)) {
            return true;
        }
        if (uid == null || uid.isBlank()) {
            return false;
        }
        return isBoardManager(gallId, uid);
    }

    public boolean canTransferBoardManager(String gallId, String uid, String memberDivision) {
        Map<String, Object> board = getBoardRow(gallId);
        if (!isManagedBoardEligible(board)) {
            return false;
        }
        if (isGlobalAdmin(memberDivision)) {
            return true;
        }
        if (uid == null || uid.isBlank()) {
            return false;
        }
        return isBoardManager(gallId, uid);
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
                       bs.created_at,
                       bs.can_delete_post,
                       bs.can_delete_comment,
                       bs.can_manage_write,
                       bs.can_manage_guest_penalty,
                       bs.can_manage_tags,
                       bs.can_manage_images,
                       bs.can_manage_notice,
                       bs.can_manage_categories,
                       bs.can_manage_cover,
                       bs.can_ban_user,
                       bs.can_manage_forbidden_word,
                       bs.can_bump_post,
                       bs.can_manage_concept,
                       bs.can_manage_concept_cut,
                       bs.can_manage_submanager
                FROM board_submanager bs
                LEFT JOIN user u ON u.uid = bs.uid
                LEFT JOIN user appointor ON appointor.uid = bs.appointed_by
                WHERE bs.gall_id = ?
                ORDER BY bs.created_at ASC
                """, gallId);
    }

    private void applyManagerAssignment(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        String actor = required(actorUid, "필수 값을 입력해 주세요.");
        String resolvedTarget = required(targetUid, "필수 값을 입력해 주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        String currentManager = nullableText(board.get("manager_uid"));
        boolean globalAdmin = isGlobalAdmin(actorDivision);

        if (currentManager == null || currentManager.isBlank()) {
            if (!globalAdmin && !actor.equals(resolvedTarget)) {
                throw new RuntimeException("요청을 처리할 수 없습니다.");
            }
        } else if (!globalAdmin && !currentManager.equals(actor)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        jdbcTemplate.update("UPDATE board SET manager_uid = ? WHERE gall_id = ?", resolvedTarget, boardId);
        jdbcTemplate.update("DELETE FROM board_submanager WHERE gall_id = ? AND uid = ?", boardId, resolvedTarget);
    }

    private void applySubmanagerAppointment(String gallId, String targetUid, String actorUid, String actorDivision) {
        String boardId = required(gallId, "필수 값을 입력해 주세요.");
        String actor = required(actorUid, "필수 값을 입력해 주세요.");
        String resolvedTarget = required(targetUid, "필수 값을 입력해 주세요.");
        Map<String, Object> board = requireBoard(boardId);
        ensureManagedBoardEligible(board);
        ensureUserExists(resolvedTarget);

        if (!canAssignBoardStaff(boardId, actor, actorDivision)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        String managerUid = getManagerUid(boardId);
        if (managerUid != null && managerUid.equals(resolvedTarget)) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        jdbcTemplate.update("""
                INSERT INTO board_submanager (gall_id, uid, appointed_by)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE appointed_by = VALUES(appointed_by)
                """, boardId, resolvedTarget, actor);
    }

    private void acceptSideBoardRequest(Long alarmId, String adminUid, Map<String, String> payload) {
        if (!isGlobalAdmin(getUserMemberDivision(adminUid))) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        String requesterUid = required(payload.get("requesterUid"), "요청자 정보가 없습니다.");
        String gallId = required(payload.get("gallId"), "보드 ID가 없습니다.");
        String gallName = required(payload.get("gallName"), "보드 이름이 없습니다.");
        String topicId = resolveBoardTopicForApproval(requesterUid, gallId, payload.get("topicId"));
        String reason = nullableTrim(payload.get("reason"));

        ensureSideBoardCreationTargetAvailable(null, gallId, gallName);
        ensureUserExists(requesterUid);

        jdbcTemplate.update("""
                INSERT INTO board (gall_id, gall_name, gall_type, category, topic_id, manager_uid, post_count, status)
                VALUES (?, ?, 'm', 'user-requested', ?, ?, 0, 'active')
                """, gallId, gallName, topicId, requesterUid);
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
                """, gallId, gallName + " 보드가 생성되었습니다.", adminUid);
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }

        String requesterUid = required(payload.get("requesterUid"), "요청자 정보가 없습니다.");
        String gallId = required(payload.get("gallId"), "보드 ID가 없습니다.");
        String gallName = required(payload.get("gallName"), "보드 이름이 없습니다.");
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

    // 보드 관리 요청 처리
    private void createBoardStaffRequest(Map<String, Object> board, String targetUid, String actorUid, String role) {
        String boardId = required(nullableText(board.get("gall_id")), "보드 ID가 없습니다.");
        String boardName = firstNonBlank(nullableText(board.get("gall_name")), boardId);
        String resolvedTarget = required(targetUid, "필수 값을 입력해 주세요.");
        String requesterUid = required(actorUid, "필수 값을 입력해 주세요.");
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        String resolvedUid = required(uid, "필수 값을 입력해 주세요.");
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
    }

    private void ensurePendingBoardStaffAlarm(Map<String, Object> alarm) {
        String alarmType = nullableText(alarm.get("alarm_type"));
        if (!isPendingBoardStaffAlarmType(alarmType) || isReadAlarm(alarm.get("is_read"))) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
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
        String content = required(nullableText(rawContent), "필수 값을 입력해 주세요.");
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
        ensureSideBoardCreationTargetAvailable(requesterUid, gallId, gallName);

    }

    private void ensureSideBoardCreationTargetAvailable(String requesterUid, String gallId, String gallName) {
        if (gallId == null || gallId.isBlank()) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        if (!gallId.matches("^[a-z0-9_\\-]{3,50}$")) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        if (gallName.length() < 2 || gallName.length() > 100) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        Integer existingGallery = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM board WHERE gall_id = ?",
                Integer.class,
                gallId
        );
        if (existingGallery != null && existingGallery > 0) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        if (requesterUid == null || requesterUid.isBlank()) {
            return;
        }

        Integer existingPending = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM board_request
                WHERE requester_uid = ?
                  AND gall_id = ?
                  AND status = 'pending'
                """, Integer.class, requesterUid, gallId);
        if (existingPending != null && existingPending > 0) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
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

    // 보드 관리 요청 처리
    private void notifyAdminsForSideBoardRequest(String requesterUid, String gallId, String gallName, String topicId, String reason) {
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
        payload.put("topicId", topicId);
        payload.put("reason", reason);
        payload.put("requestedAt", LocalDateTime.now().toString());

        String title = "[보드 관리] " + gallName;
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
                ? "[" + gallName + " 보드가 생성되었습니다."
                : "[" + gallName + " 보드 개설이 반려되었습니다.";
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

    private String normalizeBoardTopicId(String rawValue) {
        String topicId = nullableTrim(rawValue);
        if (topicId == null) {
            throw new RuntimeException("보드 주제를 선택해 주세요.");
        }
        String normalized = topicId.toLowerCase();
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM board_topic
                WHERE topic_id = ?
                  AND is_active = 1
                """, Integer.class, normalized);
        if (count == null || count == 0) {
            throw new RuntimeException("사용할 수 없는 보드 주제입니다.");
        }
        return normalized;
    }

    private String resolveBoardTopicForApproval(String requesterUid, String gallId, String payloadTopicId) {
        String topicId = nullableTrim(payloadTopicId);
        if (topicId != null) {
            return normalizeBoardTopicId(topicId);
        }
        try {
            String storedTopicId = jdbcTemplate.queryForObject("""
                    SELECT topic_id
                    FROM board_request
                    WHERE requester_uid = ?
                      AND gall_id = ?
                      AND status = 'pending'
                    ORDER BY created_at DESC, request_id DESC
                    LIMIT 1
                    """, String.class, requesterUid, gallId);
            return normalizeBoardTopicId(storedTopicId);
        } catch (EmptyResultDataAccessException e) {
            return normalizeBoardTopicId("other");
        }
    }

    private Map<String, Object> getBoardRow(String gallId) {
        try {
            return jdbcTemplate.queryForMap("""
                    SELECT g.gall_id,
                           g.gall_name,
                           g.gall_type,
                           g.category,
                           g.topic_id,
                           bt.topic_name,
                           g.post_count,
                           g.manager_uid,
                           manager.nick AS manager_nick
                    FROM board g
                    LEFT JOIN board_topic bt ON bt.topic_id = g.topic_id
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
    }

    private void requireManagerPasswordForStaffAction(String boardId,
                                                      String actorUid,
                                                      String actorDivision,
                                                      String actorPassword,
                                                      Map<String, Object> board,
                                                      String actionLabel) {
        if (isGlobalAdmin(actorDivision)) {
            return;
        }
        String currentManager = nullableText(board == null ? null : board.get("manager_uid"));
        if (currentManager == null || !currentManager.equals(actorUid)) {
            return;
        }
        String password = nullableTrim(actorPassword);
        if (password == null) {
            throw new RuntimeException(actionLabel + "요청을 처리할 수 없습니다.");
        }
        try {
            String passwordHash = jdbcTemplate.queryForObject(
                    "SELECT password_hash FROM user WHERE uid = ?",
                    String.class,
                    actorUid
            );
            if (passwordHash == null || passwordHash.isBlank() || !BCrypt.checkpw(password, passwordHash)) {
                throw new RuntimeException("요청을 처리할 수 없습니다.");
            }
        } catch (EmptyResultDataAccessException e) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
    }

    private void ensureUserExists(String uid) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user WHERE uid = ?",
                Integer.class,
                uid
        );
        if (count == null || count == 0) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
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

        String guestName = required(firstNonBlank(payload.get("name"), payload.get("guestName")), "이름을 입력해 주세요.");
        String guestPassword = required(firstNonBlank(payload.get("password"), payload.get("guestPassword")), "비밀번호를 입력해 주세요.");
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

    private void upsertPostContent(Long postId, String gallId, Long postNo, String content) {
        if (postId == null || gallId == null || postNo == null) {
            return;
        }
        String safeContent = content == null ? "" : content;
        int imageCount = countImageTags(safeContent);
        int wordCount = countTextWords(safeContent);
        jdbcTemplate.update("""
                INSERT INTO post_content (
                    post_id,
                    gall_id,
                    post_no,
                    content,
                    content_format,
                    render_policy,
                    allow_images,
                    image_count,
                    word_count
                )
                VALUES (?, ?, ?, ?, 'html', 'trusted_html', ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    content = VALUES(content),
                    content_format = VALUES(content_format),
                    render_policy = VALUES(render_policy),
                    allow_images = VALUES(allow_images),
                    image_count = VALUES(image_count),
                    word_count = VALUES(word_count)
                """,
                postId,
                gallId,
                postNo,
                safeContent,
                imageCount > 0 ? 1 : 0,
                imageCount,
                wordCount
        );
    }

    private int countImageTags(String content) {
        String lower = content.toLowerCase(Locale.ROOT);
        int count = 0;
        int index = lower.indexOf("<img");
        while (index >= 0) {
            count++;
            index = lower.indexOf("<img", index + 4);
        }
        return count;
    }

    private int countTextWords(String content) {
        String text = content.replaceAll("<[^>]*>", " ").trim();
        if (text.isEmpty()) {
            return 0;
        }
        return text.split("\\s+").length;
    }

    private Map<String, Object> sanitizeRowContent(Map<String, Object> row) {
        if (row == null) {
            return null;
        }
        Object rawContent = row.get("post_content_body");
        if (rawContent == null) {
            rawContent = row.get("content");
        }
        if (rawContent != null) {
            String sanitized = htmlSanitizerService.sanitize(String.valueOf(rawContent));
            row.put("content", sanitized);
            row.put("has_image", sanitized.toLowerCase().contains("<img"));
        }
        row.put("name", formatDisplayName(nullableText(row.get("name")), nullableText(row.get("writer_uid")), nullableText(row.get("ip"))));
        String displayCategory = normalizeDisplayCategory(nullableText(row.get("gall_id")), nullableText(row.get("category")));
        row.put("display_category", displayCategory);
        row.put("category", displayCategory);
        boolean concept = isOneFlag(row.get("is_concept"));
        boolean notice = isOneFlag(row.get("is_notice"));
        row.put("is_concept_flag", concept);
        row.put("is_notice_flag", notice);
        row.put("concept_label", concept ? "개념글" : "");
        row.put("notice_label", notice ? "공지" : "");
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
        String resolved = firstNonBlank(name, writerUid, "guest");
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
        return options.isEmpty() ? "general" : options.get(0);
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
        settings.put("category_options", "general");
        settings.put("category_options_list", List.of("general"));
        settings.put("board_tags", null);
        settings.put("theme_color", "#ff8fab");
        settings.put("concept_recommend_threshold", 10);
        settings.put("allow_guest_post", true);
        settings.put("allow_guest_comment", true);
        settings.put("allow_member_image", true);
        settings.put("allow_guest_image", false);
        settings.put("join_policy", "free");
        settings.put("visibility", "public");
        settings.put("read_visibility", "inherit");
        settings.put("pinned_notice_count", 3);
        settings.put("allowed_attachment_types", null);
        settings.put("attachment_max_bytes", 0L);
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

    private boolean isOneFlag(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        if (value instanceof Number number) {
            return number.intValue() == 1;
        }
        String text = nullableText(value);
        return "1".equals(text) || "true".equalsIgnoreCase(text) || "yes".equalsIgnoreCase(text) || "on".equalsIgnoreCase(text);
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        return normalized.toLowerCase();
    }

    private String normalizeCategoryOptions(String value) {
        List<String> options = parseCategoryOptions(value);
        if (options.isEmpty()) {
            options = List.of("general");
        }
        return String.join("\n", options);
    }

    private String normalizeBoardTags(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        List<String> tags = parseBoardTags(value);
        return tags.isEmpty() ? null : String.join(" ", tags);
    }

    private List<Map<String, Object>> resolveBoardTagRows(List<Map<String, Object>> rows) {
        for (Map<String, Object> row : rows) {
            String gallId = nullableText(row.get("gall_id"));
            String boardTags = nullableText(row.get("board_tags"));
            row.put("board_tags", normalizeBoardTagsForBoard(gallId, boardTags));
        }
        return rows;
    }

    private String normalizeBoardTagsForBoard(String gallId, String value) {
        List<String> tags = parseBoardTags(value);
        String topicTagText = getBoardTopicTagText(gallId);
        if (tags.isEmpty()) {
            return topicTagText;
        }
        List<String> resolved = new ArrayList<>();
        for (String tag : tags) {
            if (isReservedBoardTag(tag)) {
                for (String topicToken : parseBoardTags(topicTagText)) {
                    if (!resolved.contains(topicToken)) {
                        resolved.add(topicToken);
                    }
                }
                continue;
            }
            if (!resolved.contains(tag)) {
                resolved.add(tag);
            }
        }
        return resolved.isEmpty() ? topicTagText : String.join(" ", resolved);
    }

    private String getBoardTopicTagText(String gallId) {
        try {
            Map<String, Object> topic = jdbcTemplate.queryForMap("""
                    SELECT COALESCE(b.topic_id, 'other') AS topic_id,
                           COALESCE(bt.topic_name, '기타') AS topic_name
                    FROM board b
                    LEFT JOIN board_topic bt ON bt.topic_id = b.topic_id
                    WHERE b.gall_id = ?
                    """, gallId);
            String topicId = nullableText(topic.get("topic_id"));
            String topicName = nullableText(topic.get("topic_name"));
            return String.join(" ", parseBoardTags((firstNonBlank(topicId, "other") + " " + firstNonBlank(topicName, "기타"))));
        } catch (Exception ignored) {
            return "other 기타";
        }
    }

    private boolean containsReservedBoardTag(String value) {
        for (String tag : parseBoardTags(value)) {
            if (isReservedBoardTag(tag)) {
                return true;
            }
        }
        return false;
    }

    private boolean isReservedBoardTag(String tag) {
        if (tag == null) {
            return false;
        }
        String normalized = tag.trim().toLowerCase(Locale.ROOT);
        String compact = normalized
                .replace("#", "")
                .replace("[", "")
                .replace("]", "")
                .replace("(", "")
                .replace(")", "")
                .replace("{", "")
                .replace("}", "")
                .replace("_", "")
                .replace("-", "")
                .replace(".", "");
        return "dc".equals(compact)
                || "dcinside".equals(compact)
                || "디시".equals(compact);
    }

    private List<String> parseBoardTags(Object value) {
        String raw = nullableText(value);
        if (raw == null || raw.isBlank()) {
            return new ArrayList<>();
        }
        List<String> tags = new ArrayList<>();
        for (String token : raw.split("[,\\r\\n\\t ]+")) {
            String tag = token.trim();
            if (!tag.isBlank() && tag.length() <= 50 && !tags.contains(tag)) {
                tags.add(tag);
            }
            if (tags.size() >= 30) {
                break;
            }
        }
        return tags;
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
                throw new RuntimeException("요청을 처리할 수 없습니다.");
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
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        if (category.length() > 20) {
            throw new RuntimeException("요청을 처리할 수 없습니다.");
        }
        return category;
    }

    private String normalizeBoardListMode(String value) {
        String normalized = nullableTrim(value);
        if (normalized == null) {
            return "all";
        }
        return switch (normalized.toLowerCase(Locale.ROOT)) {
            case "concept" -> "concept";
            case "notice" -> "notice";
            default -> "all";
        };
    }

    private String normalizeBoardListCategory(String gallId, String value) {
        String normalized = nullableTrim(value);
        if (normalized == null || normalized.startsWith(":")) {
            return null;
        }
        return normalized;
    }

    @Transactional
    public void autoRefreshBoardRankingsIfNeeded() {
        LocalDate today = LocalDate.now();
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM board_ranking_snapshot
                WHERE ranking_date = ?
                """, Integer.class, today);
        jdbcTemplate.update("""
                INSERT INTO board_ranking_refresh_state (ranking_date, refresh_count, last_refreshed_at)
                VALUES (?, 0, NULL)
                ON DUPLICATE KEY UPDATE ranking_date = ranking_date
                """, today);
        Integer refreshCount = jdbcTemplate.queryForObject("""
                SELECT COALESCE(refresh_count, 0)
                FROM board_ranking_refresh_state
                WHERE ranking_date = ?
                """, Integer.class, today);
        LocalDateTime lastRefreshedAt = toLocalDateTime(jdbcTemplate.queryForObject("""
                SELECT last_refreshed_at
                FROM board_ranking_refresh_state
                WHERE ranking_date = ?
                """, Object.class, today));
        int used = refreshCount == null ? 0 : refreshCount;
        boolean missingSnapshot = count == null || count == 0;
        if (!missingSnapshot) {
            if (used >= BOARD_RANKING_DAILY_LIMIT) {
                return;
            }
            if (lastRefreshedAt != null && lastRefreshedAt.plusMinutes(BOARD_RANKING_AUTO_REFRESH_MINUTES).isAfter(LocalDateTime.now())) {
                return;
            }
        }
        rebuildBoardRankings(today);
        jdbcTemplate.update("""
                UPDATE board_ranking_refresh_state
                SET refresh_count = ?,
                    last_refreshed_at = NOW()
                WHERE ranking_date = ?
                """, missingSnapshot ? Math.max(1, used + 1) : used + 1, today);
    }

    private void rebuildBoardRankings(LocalDate rankingDate) {
        List<Map<String, Object>> rankedBoards = jdbcTemplate.queryForList("""
                SELECT b.gall_id,
                       COALESCE(NULLIF(b.gall_name, ''), b.gall_id) AS gall_name,
                       COALESCE(b.gall_type, 'other') AS gall_type,
                       COALESCE(b.post_count, 0) AS post_count,
                       SUM(CASE
                               WHEN p.is_deleted = 0
                                AND COALESCE(p.is_draft, 0) = 0
                                AND p.writed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                               THEN 1 ELSE 0
                           END) AS recent_post_count,
                       SUM(CASE
                               WHEN p.is_deleted = 0
                                AND COALESCE(p.is_draft, 0) = 0
                                AND p.writed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                               THEN COALESCE(p.recommend_count, 0) ELSE 0
                           END) AS recent_recommend_sum,
                       (
                           COALESCE(b.post_count, 0) * 2 +
                           SUM(CASE
                                   WHEN p.is_deleted = 0
                                    AND COALESCE(p.is_draft, 0) = 0
                                    AND p.writed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                                   THEN 8 ELSE 0
                               END) +
                           SUM(CASE
                                   WHEN p.is_deleted = 0
                                    AND COALESCE(p.is_draft, 0) = 0
                                    AND p.writed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                                   THEN COALESCE(p.recommend_count, 0) * 3 ELSE 0
                               END) +
                           SUM(CASE
                                   WHEN p.is_deleted = 0
                                    AND COALESCE(p.is_draft, 0) = 0
                                    AND p.writed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                                   THEN LEAST(COALESCE(p.view_count, 0), 500) ELSE 0
                               END) / 25
                       ) AS score
                FROM board b
                LEFT JOIN post p ON p.gall_id = b.gall_id
                WHERE COALESCE(b.status, 'active') <> 'deleted'
                GROUP BY b.gall_id, b.gall_name, b.gall_type, b.post_count
                ORDER BY score DESC, recent_post_count DESC, post_count DESC, b.gall_id ASC
                LIMIT 10
                """);
        jdbcTemplate.update("DELETE FROM board_ranking_snapshot WHERE ranking_date = ?", rankingDate);
        int rank = 1;
        for (Map<String, Object> item : rankedBoards) {
            jdbcTemplate.update("""
                    INSERT INTO board_ranking_snapshot (
                        ranking_date, rank_no, gall_id, gall_name, gall_type,
                        score, post_count, recent_post_count, recent_recommend_sum, refreshed_at
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    """,
                    rankingDate,
                    rank++,
                    nullableText(item.get("gall_id")),
                    nullableText(item.get("gall_name")),
                    nullableText(item.get("gall_type")),
                    normalizeLong(item.get("score"), 0L),
                    normalizeNonNegativeInt(item.get("post_count"), 0),
                    normalizeNonNegativeInt(item.get("recent_post_count"), 0),
                    normalizeNonNegativeInt(item.get("recent_recommend_sum"), 0)
            );
        }
    }

    private String formatStaffDisplayName(String nick, String uid) {
        String resolvedUid = nullableTrim(uid);
        String resolvedNick = nullableTrim(nick);
        if (resolvedNick == null) {
            return resolvedUid == null ? "guest" : resolvedUid;
        }
        if (resolvedUid == null || resolvedNick.equals(resolvedUid)) {
            return resolvedNick;
        }
        return resolvedNick + " (" + resolvedUid + ")";
    }

    private record WriterInfo(String uid, String name, String ip, String passwordHash) {
    }
    private LocalDateTime toLocalDateTime(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDateTime ldt) {
            return ldt;
        }
        if (value instanceof java.sql.Timestamp ts) {
            return ts.toLocalDateTime();
        }
        if (value instanceof java.time.Instant instant) {
            return LocalDateTime.ofInstant(instant, java.time.ZoneId.systemDefault());
        }
        throw new RuntimeException("요청을 처리할 수 없습니다.");
    }
}
