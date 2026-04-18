package org.java.spring_04.common;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.time.LocalDateTime;

@Controller
public class PageController {

    // 로그 출력을 담당하는 공통 메소드
    private void logRequest(String pageName) {
        System.out.printf("[%s] GET %s PAGE\n", LocalDateTime.now(), pageName);
    }

    @GetMapping("/")
    public String index() {
        logRequest("INDEX");
        return "index";
    }

    @GetMapping("/signin")
    public String login() {
        logRequest("LOGIN");
        return "login";
    }

    @GetMapping("/nid")
    public String nid() {
        logRequest("NEWID");
        return "nid";
    }
    @GetMapping("/test")
    public String test(){
        logRequest("TEST PAGE");
        return "test";
    }
    @GetMapping("/boards")
    public String boards(){
        logRequest("BOARDS");
        return "boards";
    }
    @GetMapping("/board_main")
    public String board_maim() {
        logRequest("BOARD IN");
        return "board_main";
    }

    @GetMapping("/board/{gid}")
    public String boardDetail(@PathVariable String gid) {
        logRequest("BOARD " + gid);
        return "board_main";
    }

    @GetMapping("/board/{gid}/{postNo}")
    public String postDetail(@PathVariable String gid, @PathVariable Long postNo) {
        logRequest("POST " + gid + "/" + postNo);
        return "post";
    }
}
