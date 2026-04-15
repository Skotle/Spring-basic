import sqlite3


def alter_gallery_table():
    conn = sqlite3.connect("mydb.db")
    cursor = conn.cursor()

    try:
        # 외래 키 비활성화 (참조 테이블 영향 방지)
        cursor.execute("PRAGMA foreign_keys = OFF;")

        # 1. 기존 데이터 중복 체크
        cursor.execute('''
                       SELECT gall_name, gall_type, COUNT(*)
                       FROM gallery
                       GROUP BY gall_name, gall_type
                       HAVING COUNT(*) > 1;
                       ''')
        duplicates = cursor.fetchall()
        if duplicates:
            print("중복 데이터가 존재합니다. 작업을 중단합니다.")
            for row in duplicates:
                print(f"  gall_name={row[0]}, gall_type={row[1]}, count={row[2]}")
            return

        # 2. 새 테이블 생성 (UNIQUE 제약 포함)
        cursor.execute("DROP TABLE IF EXISTS gallery")
        cursor.execute('''
                       CREATE TABLE gallery (
                                                    gall_id         TEXT    PRIMARY KEY NOT NULL,
                                                    gall_name       TEXT    NOT NULL,
                                                    gall_type       TEXT    NOT NULL DEFAULT 'M',
                                                    category        TEXT,
                                                    manager_uid     TEXT,
                                                    use_gall_nick   INTEGER NOT NULL DEFAULT 1,
                                                    cmt_max_length  INTEGER NOT NULL DEFAULT 400,
                                                    kcaptcha_use    INTEGER NOT NULL DEFAULT 0,
                                                    adult_only      INTEGER NOT NULL DEFAULT 0,
                                                    created_at      DATETIME NOT NULL DEFAULT (datetime('now', 'localtime')),
                                                    UNIQUE (gall_name, gall_type)
                       )
                       ''')

        # 3. 기존 데이터 복사
        cursor.execute("PRAGMA foreign_keys = ON;")

        conn.commit()
        print("gallery 테이블 대체키 설정이 완료되었습니다.")

    except sqlite3.Error as e:
        print(f"오류 발생: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    alter_gallery_table()