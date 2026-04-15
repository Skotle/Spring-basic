import sqlite3

def add_email_column():
    conn = sqlite3.connect("mydb.db")
    cursor = conn.cursor()
    
    try:
        # 1. 컬럼 존재 여부 확인
        cursor.execute("PRAGMA table_info(user)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'email' not in columns:
            # 2. UNIQUE 없이 컬럼만 먼저 추가 (가장 안전한 방법)
            cursor.execute("ALTER TABLE user ADD COLUMN email TEXT")
            conn.commit()
            print("✅ email 컬럼이 추가되었습니다.")
            
            # 3. 별도의 UNIQUE 인덱스 생성 (UNIQUE 제약 조건과 동일한 효과)
            cursor.execute("CREATE UNIQUE INDEX idx_user_email ON user(email)")
            conn.commit()
            print("✅ email 컬럼에 UNIQUE 인덱스가 설정되었습니다.")
        else:
            print("ℹ️ email 컬럼이 이미 존재합니다.")
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_email_column()