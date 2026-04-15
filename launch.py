import sqlite3

def init_db():
    # 1. 데이터베이스 연결 (파일이 없으면 새로 생성됨)
    conn = sqlite3.connect("mydb.db")
    cursor = conn.cursor()

    # 2. 외래 키 제약 조건 활성화
    cursor.execute("PRAGMA foreign_keys = ON;")

    # 3. 테이블 생성 로직 시작
    try:
        # --- 1. gallery ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gallery (
                gall_id         TEXT    PRIMARY KEY NOT NULL,
                gall_name       TEXT    NOT NULL,
                gall_type       TEXT    NOT NULL DEFAULT 'M',
                category        TEXT,
                manager_uid     TEXT,
                use_gall_nick   INTEGER NOT NULL DEFAULT 1,
                cmt_max_length  INTEGER NOT NULL DEFAULT 400,
                kcaptcha_use    INTEGER NOT NULL DEFAULT 0,
                adult_only      INTEGER NOT NULL DEFAULT 0,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        ''')

        # --- 2. user ---
        # Java 코드와의 호환성을 위해 passwordHash, accessToken 등 필요한 컬럼 유지
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
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        ''')

        # --- 3. post ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                gall_id         TEXT    NOT NULL,
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
                FOREIGN KEY (gall_id)    REFERENCES gallery(gall_id),
                FOREIGN KEY (writer_uid) REFERENCES user(uid)
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_post_gall ON post (gall_id, writed_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_post_writer ON post (writer_uid)")

        # --- 4. post_attachment ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post_attachment (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id         INTEGER NOT NULL,
                file_no         TEXT    NOT NULL,
                original_name   TEXT    NOT NULL,
                download_url    TEXT    NOT NULL,
                file_type       TEXT,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (post_id) REFERENCES post(id)
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attach_post ON post_attachment (post_id)")

        # --- 5. comment ---
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
                FOREIGN KEY (gall_id)    REFERENCES gallery(gall_id),
                FOREIGN KEY (post_id)    REFERENCES post(id),
                FOREIGN KEY (parent_id)  REFERENCES comment(id),
                FOREIGN KEY (writer_uid) REFERENCES user(uid)
            )
        ''')
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_comment_post ON comment (post_id, writed_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_comment_parent ON comment (parent_id)")

        # --- 6. post_recommend ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post_recommend (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id         INTEGER NOT NULL,
                user_uid        TEXT,
                user_ip         TEXT,
                recommend_type  TEXT    NOT NULL DEFAULT 'up',
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (post_id)  REFERENCES post(id),
                FOREIGN KEY (user_uid) REFERENCES user(uid),
                UNIQUE (post_id, user_uid),
                UNIQUE (post_id, user_ip)
            )
        ''')

        # --- 7. report ---
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
                FOREIGN KEY (gall_id) REFERENCES gallery(gall_id)
            )
        ''')

        # --- 8. gallery_manager ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gallery_manager (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                gall_id         TEXT    NOT NULL,
                user_uid        TEXT    NOT NULL,
                manager_type    TEXT    NOT NULL DEFAULT 'manager',
                assigned_at     DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (gall_id)  REFERENCES gallery(gall_id),
                FOREIGN KEY (user_uid) REFERENCES user(uid),
                UNIQUE (gall_id, user_uid)
            )
        ''')

        # --- 9. user_autozzal ---
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
                FOREIGN KEY (user_uid) REFERENCES user(uid),
                FOREIGN KEY (gall_id)  REFERENCES gallery(gall_id)
            )
        ''')

        # --- 10. user_headtail ---
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
                FOREIGN KEY (user_uid) REFERENCES user(uid),
                FOREIGN KEY (gall_id)  REFERENCES gallery(gall_id),
                UNIQUE (user_uid, gall_id, scope)
            )
        ''')

        # --- 11. user_block ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_block (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uid        TEXT    NOT NULL,
                target_uid      TEXT,
                target_ip       TEXT,
                target_nick     TEXT,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (user_uid) REFERENCES user(uid)
            )
        ''')

        # --- 12. scrap ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scrap (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id         INTEGER NOT NULL,
                user_uid        TEXT,
                session_key     TEXT,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (post_id)  REFERENCES post(id),
                FOREIGN KEY (user_uid) REFERENCES user(uid)
            )
        ''')

        # --- 13. favorite_gallery ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS favorite_gallery (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uid        TEXT    NOT NULL,
                gall_id         TEXT    NOT NULL,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (user_uid) REFERENCES user(uid),
                FOREIGN KEY (gall_id)  REFERENCES gallery(gall_id),
                UNIQUE (user_uid, gall_id)
            )
        ''')

        # --- 14. dccon ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS dccon (
                con_no          TEXT    PRIMARY KEY NOT NULL,
                con_alt         TEXT,
                src_url         TEXT    NOT NULL,
                con_type        TEXT    NOT NULL DEFAULT 'mp4',
                is_nft          INTEGER NOT NULL DEFAULT 0
            )
        ''')

        # --- 15. user_dccon ---
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_dccon (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                user_uid        TEXT    NOT NULL,
                con_no          TEXT    NOT NULL,
                sort_order      INTEGER NOT NULL DEFAULT 0,
                expire_at       DATETIME,
                FOREIGN KEY (user_uid) REFERENCES user(uid),
                FOREIGN KEY (con_no)   REFERENCES dccon(con_no),
                UNIQUE (user_uid, con_no)
            )
        ''')

        conn.commit()
        print("전체 테이블 생성이 완료되었습니다.")

    except sqlite3.Error as e:
        print(f"오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()