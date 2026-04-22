package org.java.spring_04.common;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.time.LocalDateTime;

@Controller
public class PageController {

    private void logRequest(String pageName) {
        System.out.printf("[%s] GET %s PAGE%n", LocalDateTime.now(), pageName);
    }

    @GetMapping("/")
    public String index() {
        logRequest("INDEX");
        return "index";
    }

    @GetMapping("/signin")
    public String login() {
        logRequest("LOGIN");
        return "index";
    }

    @GetMapping("/nid")
    public String nid() {
        logRequest("SIGNUP");
        return "index";
    }

    @GetMapping("/test")
    public String test() {
        logRequest("TEST");
        return "test";
    }
}
