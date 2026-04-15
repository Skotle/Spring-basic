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
            SELECT uid,nick,password_hash FROM user
        ''')
    except sqlite3.Error as e:
        print(f"오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()