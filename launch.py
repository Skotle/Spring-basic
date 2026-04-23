import sqlite3

def init_db():
    # 1. 데이터베이스 연결 (파일이 없으면 생성)
    conn = sqlite3.connect("mydb.db")
    cursor = conn.cursor()

    # 2. 외래 키(Foreign Key) 제약 조건 활성화 (SQLite 기본값은 OFF임)
    cursor.execute("PRAGMA foreign_keys = ON;")

    try:
        # --- 1. gallery ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gallery (
                gall_id         TEXT    PRIMARY KEY NOT NULL,
                gall_name       TEXT    NOT NULL,
                gall_type       TEXT    NOT NULL DEFAULT 'M', -- M: 메인, MI: 마이너
                category        TEXT,
                manager_uid     TEXT,
                use_gall_nick   INTEGER NOT NULL DEFAULT 1,
                cmt_max_length  INTEGER NOT NULL DEFAULT 400,
                kcaptcha_use    INTEGER NOT NULL DEFAULT 0,
                adult_only      INTEGER NOT NULL DEFAULT 0,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        ''')

        # --- 2. gallery_counter (신규: 갤러리별 독립 번호 관리용) ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gallery_counter (
                gall_id         TEXT    PRIMARY KEY NOT NULL,
                last_post_no    INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (gall_id) REFERENCES gallery(gall_id) ON DELETE CASCADE
            )
        ''')

        # --- 3. user ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user (
                uid             TEXT    PRIMARY KEY NOT NULL,
                nick            TEXT    NOT NULL,
                nick_icon_type  TEXT,
                password_hash   TEXT    NOT NULL,
                gallercon_url   TEXT,
                gallog_url      TEXT,
                member_division INTEGER NOT NULL DEFAULT 0,
                accessToken     TEXT,
                refreshToken    TEXT,
                email TEXT UNIQUE,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        ''')

        # --- 4. post (개선됨: post_no 컬럼 및 제약 조건 추가) ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post (
                id              INTEGER PRIMARY KEY, 
                gall_id         TEXT    NOT NULL,
                post_no         INTEGER NOT NULL,
                title           TEXT    NOT NULL,
                content         TEXT,
                head_text       TEXT,
                writer_uid      TEXT,
                name            TEXT    NOT NULL,
                ip              TEXT,
                password        TEXT,
                post_type       TEXT    NOT NULL DEFAULT '일반',
                content_type    TEXT    NOT NULL DEFAULT 'txt',
                view_count      INTEGER NOT NULL DEFAULT 0,
                recommend_count INTEGER NOT NULL DEFAULT 0,
                comment_count   INTEGER NOT NULL DEFAULT 0,
                is_adult        INTEGER NOT NULL DEFAULT 0,
                is_deleted      INTEGER NOT NULL DEFAULT 0,
                write_device    TEXT,
                writed_at       DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (gall_id)    REFERENCES gallery(gall_id) ON DELETE CASCADE,
                FOREIGN KEY (writer_uid) REFERENCES user(uid) ON DELETE SET NULL,
                UNIQUE (gall_id, post_no) -- 갤러리 내 번호 중복 방지
            )
        ''')
        # 최신글 목록 조회를 위한 고성능 인덱스
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_post_gall_list ON post (gall_id, post_no DESC)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_post_writer ON post (writer_uid)")

        # 기존 DB에 comment_count 컬럼이 없으면 추가
        post_columns = [row[1] for row in cursor.execute("PRAGMA table_info(post)").fetchall()]
        if "comment_count" not in post_columns:
            cursor.execute("ALTER TABLE post ADD COLUMN comment_count INTEGER NOT NULL DEFAULT 0")

        # --- 5. post_attachment ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post_attachment (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id         INTEGER NOT NULL,
                file_no         TEXT    NOT NULL,
                original_name   TEXT    NOT NULL,
                download_url    TEXT    NOT NULL,
                file_type       TEXT,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (post_id) REFERENCES post(id) ON DELETE CASCADE
            )
        ''')

        # --- 6. comment ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS comment (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                gall_id               TEXT    NOT NULL,
                post_id               INTEGER NOT NULL,
                parent_id             INTEGER,
                writer_uid            TEXT,
                name                  TEXT    NOT NULL,
                ip                    TEXT,
                password              TEXT,
                content               TEXT    NOT NULL,
                dccon_no              TEXT,
                image_file_id         INTEGER,
                target_image_file_no  TEXT,
                recommend_count       INTEGER NOT NULL DEFAULT 0,
                is_deleted            INTEGER NOT NULL DEFAULT 0,
                writed_at             DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (gall_id)    REFERENCES gallery(gall_id) ON DELETE CASCADE,
                FOREIGN KEY (post_id)    REFERENCES post(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id)  REFERENCES comment(id) ON DELETE CASCADE,
                FOREIGN KEY (writer_uid) REFERENCES user(uid) ON DELETE SET NULL
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_comment_post ON comment (post_id, writed_at)")

        # --- 7. post_recommend ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post_recommend (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id         INTEGER NOT NULL,
                user_uid        TEXT,
                user_ip         TEXT,
                recommend_type  TEXT    NOT NULL DEFAULT 'up',
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (post_id)  REFERENCES post(id) ON DELETE CASCADE,
                FOREIGN KEY (user_uid) REFERENCES user(uid) ON DELETE SET NULL,
                UNIQUE (post_id, user_uid),
                UNIQUE (post_id, user_ip)
            )
        ''')

        # --- 8. report ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS report (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                target_type     TEXT    NOT NULL,
                target_id       INTEGER NOT NULL,
                gall_id         TEXT    NOT NULL,
                reporter_uid    TEXT,
                reporter_ip     TEXT,
                reason          TEXT,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (gall_id) REFERENCES gallery(gall_id) ON DELETE CASCADE
            )
        ''')

        # --- 9. gallery_manager ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gallery_manager (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                gall_id         TEXT    NOT NULL,
                user_uid        TEXT    NOT NULL,
                manager_type    TEXT    NOT NULL DEFAULT 'manager',
                assigned_at     DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (gall_id)  REFERENCES gallery(gall_id) ON DELETE CASCADE,
                FOREIGN KEY (user_uid) REFERENCES user(uid) ON DELETE CASCADE,
                UNIQUE (gall_id, user_uid)
            )
        ''')

        # --- 10. user_autozzal ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_autozzal (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uid        TEXT    NOT NULL,
                gall_id         TEXT,
                image_src       TEXT    NOT NULL,
                is_main         INTEGER NOT NULL DEFAULT 0,
                is_random       INTEGER NOT NULL DEFAULT 0,
                is_use          INTEGER NOT NULL DEFAULT 1,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (user_uid) REFERENCES user(uid) ON DELETE CASCADE,
                FOREIGN KEY (gall_id)  REFERENCES gallery(gall_id) ON DELETE CASCADE
            )
        ''')

        # --- 11. user_headtail ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_headtail (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uid        TEXT    NOT NULL,
                gall_id         TEXT,
                scope           TEXT    NOT NULL DEFAULT 'all',
                head_text       TEXT,
                head_color      TEXT,
                tail_text       TEXT,
                tail_color      TEXT,
                comment_tail    TEXT,
                view_use        INTEGER NOT NULL DEFAULT 1,
                comment_use     INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (user_uid) REFERENCES user(uid) ON DELETE CASCADE,
                FOREIGN KEY (gall_id)  REFERENCES gallery(gall_id) ON DELETE CASCADE,
                UNIQUE (user_uid, gall_id, scope)
            )
        ''')

        # --- 12. user_block ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_block (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uid        TEXT    NOT NULL,
                target_uid      TEXT,
                target_ip       TEXT,
                target_nick     TEXT,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (user_uid) REFERENCES user(uid) ON DELETE CASCADE
            )
        ''')

        # --- 13. scrap ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scrap (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id         INTEGER NOT NULL,
                user_uid        TEXT,
                session_key     TEXT,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (post_id)  REFERENCES post(id) ON DELETE CASCADE,
                FOREIGN KEY (user_uid) REFERENCES user(uid) ON DELETE CASCADE
            )
        ''')

        # --- 14. favorite_gallery ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS favorite_gallery (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uid        TEXT    NOT NULL,
                gall_id         TEXT    NOT NULL,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (user_uid) REFERENCES user(uid) ON DELETE CASCADE,
                FOREIGN KEY (gall_id)  REFERENCES gallery(gall_id) ON DELETE CASCADE,
                UNIQUE (user_uid, gall_id)
            )
        ''')

        # --- 15. dccon ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS dccon (
                con_no          TEXT    PRIMARY KEY NOT NULL,
                con_alt         TEXT,
                src_url         TEXT    NOT NULL,
                con_type        TEXT    NOT NULL DEFAULT 'mp4',
                is_nft          INTEGER NOT NULL DEFAULT 0
            )
        ''')

        # --- 16. user_dccon ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_dccon (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uid        TEXT    NOT NULL,
                con_no          TEXT    NOT NULL,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                expire_at       DATETIME,
                FOREIGN KEY (user_uid) REFERENCES user(uid) ON DELETE CASCADE,
                FOREIGN KEY (con_no)   REFERENCES dccon(con_no) ON DELETE CASCADE,
                UNIQUE (user_uid, con_no)
            )
        ''')

        conn.commit()
        print("데이터베이스 스키마 구성이 완료되었습니다.")

    except sqlite3.Error as e:
        print(f"오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()
