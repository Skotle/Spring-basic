import sqlite3

def init_db():
    # 1. 데이터베이스 연결
    conn = sqlite3.connect("mydb.db")
    cursor = conn.cursor()

    # 2. 외래 키 제약 조건 활성화
    cursor.execute("PRAGMA foreign_keys = ON;")

    try:
        # --- [추가] 테이블 생성 로직 ---
        # 테이블이 없을 경우에만 생성하도록 IF NOT EXISTS를 사용합니다.
        cursor.execute('''
            INSERT INTO gallery (gall_id, gall_name, gall_type)
            VALUES ('sunggall', '성차별', 'side')
        ''')
        print("user 테이블 확인/생성 완료.")

        # 테스트용 데이터 삽입 (선택 사항)
        # cursor.execute("INSERT OR IGNORE INTO user VALUES ('admin', '관리자', 'hash_value')")

        # --- 3. 데이터 조회 로직 ---
        cursor.execute('''
            SELECT * FROM gallery
        ''')
        
        rows = cursor.fetchall()
        for row in rows:
            print(row)
            '''
            print(f"{row[0]}\n")
            print(f"[TEXT]아이디: {row[0]}\n[TEXT]이름:{row[1]}\n[TEXT]타입:{row[2]}\n[TEXT]해시:{row[3]}\n[DATATIME]생성:{row[9]}[TEXT]이메일:{row[10]}")
            print("\n")'''

        conn.commit() # 생성이나 삽입 시 변경사항 저장
        
    except sqlite3.Error as e:
        print(f"오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    init_db()