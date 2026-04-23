import sqlite3

def insert_temp_posts():
    conn = sqlite3.connect("mydb.db")
    cursor = conn.cursor()
    
    posts = [
        ('marine', 1, '해병대 공지', '필승!', 'admin', '관리자', '127.0.0.1'),
        ('marine', 2, '오늘 식단', '해병 짜장..?', 'user2', '아쎄이', '127.0.0.2'),
        ('stockus', 1, '엔비디아 풀매수', '가즈아', 'stock_god', '익명', '1.1.1.1'),
        ('openeye', 1, '첫 인사', '안녕하세요', 'eye_01', '눈눈', '2.2.2.2')
    ]
    
    sql = '''
        INSERT INTO post (gall_id, post_no, title, content, writer_uid, name, ip)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    '''
    
    try:
        cursor.executemany(sql, posts)
        # 각 갤러리의 최신 번호를 gallery_counter에도 반영해야 번호가 꼬이지 않습니다.
        for gid in ['marine', 'stockus', 'openeye']:
            cursor.execute('''
                INSERT OR REPLACE INTO gallery_counter (gall_id, last_post_no)
                VALUES (?, (SELECT MAX(post_no) FROM post WHERE gall_id = ?))
            ''', (gid, gid))
            
        conn.commit()
        print("임시 데이터 삽입 완료")
    except sqlite3.Error as e:
        print(f"오류: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    insert_temp_posts()