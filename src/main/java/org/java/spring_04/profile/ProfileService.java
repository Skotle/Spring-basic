package org.java.spring_04.profile;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ProfileService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @PostConstruct
    public void initializeProfileSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_profile_setting (
                    uid VARCHAR(50) NOT NULL,
                    status_message VARCHAR(160) NULL,
                    bio TEXT NULL,
                    accent_color VARCHAR(20) NOT NULL DEFAULT '#ff8fab',
                    show_posts TINYINT(1) NOT NULL DEFAULT 1,
                    show_comments TINYINT(1) NOT NULL DEFAULT 1,
                    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (uid)
                )
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS user_follow (
                    follower_uid VARCHAR(50) NOT NULL,
                    following_uid VARCHAR(50) NOT NULL,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (follower_uid, following_uid),
                    INDEX idx_user_follow_following (following_uid, created_at)
                )
                """);
    }

    public Map<String, Object> getProfile(String targetUid, String viewerUid) {
        String resolvedTarget = required(targetUid, "프로필 사용자를 찾을 수 없습니다.");
        Map<String, Object> user = getUserRow(resolvedTarget);
        if (user == null) {
            throw new RuntimeException("프로필 사용자를 찾을 수 없습니다.");
        }

        boolean ownerView = resolvedTarget.equals(nullableText(viewerUid));
        Map<String, Object> settings = getProfileSettings(resolvedTarget);
        boolean showPosts = ownerView || toBooleanFlag(settings.get("show_posts"));
        boolean showComments = ownerView || toBooleanFlag(settings.get("show_comments"));

        Map<String, Object> profile = new LinkedHashMap<>();
        profile.put("uid", user.get("uid"));
        profile.put("nick", user.get("nick"));
        profile.put("nickIconType", user.get("nick_icon_type"));
        profile.put("memberDivision", user.get("member_division"));
        profile.put("email", ownerView ? nullableText(user.get("email")) : null);
        profile.put("statusMessage", nullableText(settings.get("status_message")));
        profile.put("bio", nullableText(settings.get("bio")));
        profile.put("accentColor", firstNonBlank(nullableText(settings.get("accent_color")), "#ff8fab"));
        profile.put("ownerView", ownerView);
        profile.put("canEdit", ownerView);
        profile.put("showPosts", toBooleanFlag(settings.get("show_posts")));
        profile.put("showComments", toBooleanFlag(settings.get("show_comments")));
        profile.put("stats", Map.of(
                "postCount", countPosts(resolvedTarget),
                "commentCount", countComments(resolvedTarget),
                "managedBoardCount", countManagedBoards(resolvedTarget),
                "submanagerBoardCount", countSubmanagedBoards(resolvedTarget),
                "followerCount", countFollowers(resolvedTarget),
                "followingCount", countFollowing(resolvedTarget)
        ));
        profile.put("follow", Map.of(
                "viewerUid", nullableText(viewerUid),
                "isFollowing", isFollowing(viewerUid, resolvedTarget),
                "isFollowedBy", isFollowing(resolvedTarget, viewerUid)
        ));
        profile.put("followers", getFollowers(resolvedTarget));
        profile.put("following", getFollowing(resolvedTarget));
        profile.put("postsHidden", !showPosts);
        profile.put("commentsHidden", !showComments);
        profile.put("posts", showPosts ? getPostsByUser(resolvedTarget) : List.of());
        profile.put("comments", showComments ? getCommentsByUser(resolvedTarget) : List.of());
        return profile;
    }

    public Map<String, Object> follow(String followerUid, String targetUid) {
        String actorUid = required(followerUid, "로그인이 필요합니다.");
        String resolvedTarget = required(targetUid, "대상 사용자를 찾을 수 없습니다.");
        ensureUserExists(actorUid);
        ensureUserExists(resolvedTarget);
        if (actorUid.equals(resolvedTarget)) {
            throw new RuntimeException("자기 자신은 팔로우할 수 없습니다.");
        }
        jdbcTemplate.update("""
                INSERT INTO user_follow (follower_uid, following_uid)
                VALUES (?, ?)
                ON DUPLICATE KEY UPDATE created_at = created_at
                """, actorUid, resolvedTarget);
        return getProfile(resolvedTarget, actorUid);
    }

    public Map<String, Object> unfollow(String followerUid, String targetUid) {
        String actorUid = required(followerUid, "로그인이 필요합니다.");
        String resolvedTarget = required(targetUid, "대상 사용자를 찾을 수 없습니다.");
        jdbcTemplate.update("""
                DELETE FROM user_follow
                WHERE follower_uid = ?
                  AND following_uid = ?
                """, actorUid, resolvedTarget);
        return getProfile(resolvedTarget, actorUid);
    }

    public Map<String, Object> saveProfileSettings(String uid, Map<String, String> payload) {
        String actorUid = required(uid, "로그인이 필요합니다.");
        ensureUserExists(actorUid);

        String statusMessage = nullableTrim(payload.get("statusMessage"));
        String bio = nullableTrim(payload.get("bio"));
        String accentColor = normalizeThemeColor(payload.get("accentColor"));
        int showPosts = parseBooleanFlag(payload.get("showPosts"), true);
        int showComments = parseBooleanFlag(payload.get("showComments"), true);

        if (statusMessage != null && statusMessage.length() > 160) {
            throw new RuntimeException("상태 메시지는 160자까지 입력할 수 있습니다.");
        }
        if (bio != null && bio.length() > 4000) {
            throw new RuntimeException("소개글이 너무 깁니다.");
        }

        jdbcTemplate.update("""
                INSERT INTO user_profile_setting (
                    uid, status_message, bio, accent_color, show_posts, show_comments, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    status_message = VALUES(status_message),
                    bio = VALUES(bio),
                    accent_color = VALUES(accent_color),
                    show_posts = VALUES(show_posts),
                    show_comments = VALUES(show_comments),
                    updated_at = NOW()
                """,
                actorUid,
                statusMessage,
                bio,
                accentColor,
                showPosts,
                showComments
        );

        return getProfile(actorUid, actorUid);
    }

    private Map<String, Object> getProfileSettings(String uid) {
        Map<String, Object> defaults = new LinkedHashMap<>();
        defaults.put("uid", uid);
        defaults.put("status_message", null);
        defaults.put("bio", null);
        defaults.put("accent_color", "#ff8fab");
        defaults.put("show_posts", true);
        defaults.put("show_comments", true);
        try {
            Map<String, Object> row = jdbcTemplate.queryForMap("""
                    SELECT uid, status_message, bio, accent_color, show_posts, show_comments, updated_at
                    FROM user_profile_setting
                    WHERE uid = ?
                    """, uid);
            defaults.putAll(row);
        } catch (EmptyResultDataAccessException ignored) {
        }
        return defaults;
    }

    private Map<String, Object> getUserRow(String uid) {
        try {
            return jdbcTemplate.queryForMap("""
                    SELECT uid, nick, email, nick_icon_type, member_division
                    FROM user
                    WHERE uid = ?
                    """, uid);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private void ensureUserExists(String uid) {
        if (getUserRow(uid) == null) {
            throw new RuntimeException("프로필 사용자를 찾을 수 없습니다.");
        }
    }

    private int countPosts(String uid) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM post
                WHERE writer_uid = ?
                  AND is_deleted = 0
                """, Integer.class, uid);
        return count == null ? 0 : count;
    }

    private int countComments(String uid) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM comment
                WHERE writer_uid = ?
                  AND is_deleted = 0
                """, Integer.class, uid);
        return count == null ? 0 : count;
    }

    private int countManagedBoards(String uid) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM gallery
                WHERE manager_uid = ?
                """, Integer.class, uid);
        return count == null ? 0 : count;
    }

    private int countSubmanagedBoards(String uid) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM board_submanager
                WHERE uid = ?
                """, Integer.class, uid);
        return count == null ? 0 : count;
    }

    private int countFollowers(String uid) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM user_follow
                WHERE following_uid = ?
                """, Integer.class, uid);
        return count == null ? 0 : count;
    }

    private int countFollowing(String uid) {
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM user_follow
                WHERE follower_uid = ?
                """, Integer.class, uid);
        return count == null ? 0 : count;
    }

    private boolean isFollowing(String followerUid, String followingUid) {
        String follower = nullableText(followerUid);
        String following = nullableText(followingUid);
        if (follower == null || following == null) {
            return false;
        }
        Integer count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*)
                FROM user_follow
                WHERE follower_uid = ?
                  AND following_uid = ?
                """, Integer.class, follower, following);
        return count != null && count > 0;
    }

    private List<Map<String, Object>> getFollowers(String uid) {
        return jdbcTemplate.queryForList("""
                SELECT u.uid, u.nick, u.nick_icon_type, f.created_at
                FROM user_follow f
                JOIN user u ON u.uid = f.follower_uid
                WHERE f.following_uid = ?
                ORDER BY f.created_at DESC
                LIMIT 12
                """, uid);
    }

    private List<Map<String, Object>> getFollowing(String uid) {
        return jdbcTemplate.queryForList("""
                SELECT u.uid, u.nick, u.nick_icon_type, f.created_at
                FROM user_follow f
                JOIN user u ON u.uid = f.following_uid
                WHERE f.follower_uid = ?
                ORDER BY f.created_at DESC
                LIMIT 12
                """, uid);
    }

    private List<Map<String, Object>> getPostsByUser(String uid) {
        return jdbcTemplate.queryForList("""
                SELECT p.gall_id,
                       g.gall_name,
                       p.post_no,
                       p.title,
                       author.nick_icon_type,
                       p.writed_at,
                       p.view_count,
                       p.recommend_count,
                       (
                           SELECT COUNT(*)
                           FROM comment c
                           WHERE c.gall_id = p.gall_id
                             AND c.post_no = p.post_no
                             AND c.is_deleted = 0
                       ) AS comment_count
                FROM post p
                JOIN gallery g ON g.gall_id = p.gall_id
                LEFT JOIN user author ON author.uid = p.writer_uid
                WHERE p.writer_uid = ?
                  AND p.is_deleted = 0
                ORDER BY p.writed_at DESC, p.id DESC
                LIMIT 50
                """, uid);
    }

    private List<Map<String, Object>> getCommentsByUser(String uid) {
        return jdbcTemplate.queryForList("""
                SELECT c.id,
                       c.gall_id,
                       g.gall_name,
                       c.post_no,
                       c.content,
                       author.nick_icon_type,
                       c.writed_at,
                       p.title AS post_title
                FROM comment c
                JOIN post p ON p.gall_id = c.gall_id AND p.post_no = c.post_no
                JOIN gallery g ON g.gall_id = c.gall_id
                LEFT JOIN user author ON author.uid = c.writer_uid
                WHERE c.writer_uid = ?
                  AND c.is_deleted = 0
                  AND p.is_deleted = 0
                ORDER BY c.writed_at DESC, c.id DESC
                LIMIT 50
                """, uid);
    }

    private String required(String value, String message) {
        if (value == null || value.trim().isEmpty()) {
            throw new RuntimeException(message);
        }
        return value.trim();
    }

    private String nullableText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String nullableTrim(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
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

    private int parseBooleanFlag(String value, boolean defaultValue) {
        String normalized = nullableTrim(value);
        if (normalized == null) {
            return defaultValue ? 1 : 0;
        }
        return ("1".equals(normalized) || "true".equalsIgnoreCase(normalized) || "yes".equalsIgnoreCase(normalized) || "on".equalsIgnoreCase(normalized)) ? 1 : 0;
    }

    private String normalizeThemeColor(String value) {
        String normalized = nullableTrim(value);
        if (normalized == null) {
            return "#ff8fab";
        }
        if (!normalized.matches("^#[0-9a-fA-F]{6}$")) {
            throw new RuntimeException("프로필 색상 형식이 올바르지 않습니다.");
        }
        return normalized.toLowerCase();
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }
}
