import sqlite3
import bcrypt # 비밀번호 해싱을 위해 필요 (pip install bcrypt)

def init_database():
    # 1. DB 연결 (프로젝트 루트에 mydb.db 생성)
    conn = sqlite3.connect("mydb.db")
    cursor = conn.cursor()
    
    # 2. 외래 키 활성화
    cursor.execute("PRAGMA foreign_keys = ON;")

    try:
        # --- [1] user 테이블 생성 ---
        # Java AuthController와 호환되도록 users라는 이름을 사용하거나 
        # schema.js를 따르되 필요한 컬럼(accessToken 등)을 추가합니다.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user (
                uid          TEXT PRIMARY KEY NOT NULL,
                nick        TEXT NOT NULL,
                password_hash    TEXT NOT NULL,
                created_at      DATETIME DEFAULT (datetime('now', 'localtime'))
            )
        ''')

        # --- [2] 임시 데이터 삽입 (Insert) ---
        # 아이디: testuser / 비밀번호: 1234
        user_id = "skotle989"
        username = "슨일"
        raw_password = "a09ajdud21"
        
        # BCrypt 해싱 (Java의 BCrypt.checkpw와 호환됨)
        hashed_pw = bcrypt.hashpw(raw_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        # 데이터 삽입 (이미 있으면 무시)
        cursor.execute('''
            INSERT OR IGNORE INTO user (uid, nick, password_hash)
            VALUES (?, ?, ?)
        ''', (user_id, username, hashed_pw))

        # --- [3] 나머지 테이블 (schema.js 기반) ---
        # gallery 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gallery (
                gall_id         TEXT PRIMARY KEY NOT NULL,
                gall_name       TEXT NOT NULL,
                gall_type       TEXT NOT NULL DEFAULT 'M',
                category        TEXT,
                manager_uid     TEXT,
                created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime'))
            )
        ''')

        # post 테이블
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS post (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                gall_id         TEXT NOT NULL,
                title           TEXT NOT NULL,
                content         TEXT,
                writer_uid      TEXT,
                name            TEXT NOT NULL,
                writed_at       DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (gall_id)    REFERENCES gallery(gall_id),
                FOREIGN KEY (writer_uid) REFERENCES users(userID)
            )
        ''')

        conn.commit()
        print("✅ DB 초기화 및 임시 데이터 삽입 완료!")
        print(f"로그인 정보 -> ID: {user_id}, PW: {raw_password}")

    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    init_database()