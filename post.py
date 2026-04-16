import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.servlet.http.HttpSession;
import java.util.Map;

@Service
public class PostService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    /**
     * 게시글 자동 작성 로직
     * @param session 현재 세션 (회원 여부 확인용)
     * @param postData {gall_id, title, content, name, password, ip}
     */
    @Transactional
    public Map<String, Object> autoWritePost(HttpSession session, Map<String, String> postData) {
        String gallId = postData.get("gall_id");
        String uid = (session != null) ? (String) session.getAttribute("uid") : null;
        
        try {
            // 1. gallery_counter 업데이트 및 새 post_no 획득
            // SQLite의 UPSERT 구문을 사용하여 카운터를 1 증가시킵니다.
            String counterSql = 
                "INSERT INTO gallery_counter (gall_id, last_post_no) VALUES (?, 1) " +
                "ON CONFLICT(gall_id) DO UPDATE SET last_post_no = last_post_no + 1";
            jdbcTemplate.update(counterSql, gallId);

            Integer newPostNo = jdbcTemplate.queryForObject(
                "SELECT last_post_no FROM gallery_counter WHERE gall_id = ?", 
                Integer.class, gallId);

            // 2. 회원/비회원에 따른 데이터 분기 (ip와 uid 중 하나만 입력)
            String finalUid = (uid != null && !uid.isEmpty()) ? uid : null;
            String finalIp = (finalUid == null) ? postData.get("ip") : null;

            // 3. post 테이블에 삽입
            String insertSql = "INSERT INTO post (gall_id, post_no, title, content, writer_uid, name, ip, password) " +
                               "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
            
            jdbcTemplate.update(insertSql, 
                gallId, 
                newPostNo, 
                postData.get("title"), 
                postData.get("content"), 
                finalUid, 
                postData.get("name"), 
                finalIp, 
                postData.get("password") // 비회원용 비밀번호
            );

            return Map.of("success", true, "post_no", newPostNo);
        } catch (Exception e) {
            return Map.of("success", false, "message", "작성 실패: " + e.getMessage());
        }
    }
}