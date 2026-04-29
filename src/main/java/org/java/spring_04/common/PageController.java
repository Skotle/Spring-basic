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

    @GetMapping("/m")
    public String mobileIndex() {
        logRequest("MOBILE INDEX");
        return "mobile";
    }

    @GetMapping("/m/signin")
    public String mobileLogin() {
        logRequest("MOBILE LOGIN");
        return "mobile";
    }

    @GetMapping("/alarms")
    public String alarms() {
        logRequest("ALARMS");
        return "index";
    }

    @GetMapping("/board-requests")
    public String boardRequests() {
        logRequest("BOARD REQUESTS");
        return "index";
    }

    @GetMapping("/profile")
    public String profile() {
        logRequest("PROFILE");
        return "index";
    }

    @GetMapping("/profile/{uid}")
    public String publicProfile() {
        logRequest("PROFILE USER");
        return "index";
    }

    @GetMapping("/nid")
    public String nid() {
        logRequest("SIGNUP");
        return "index";
    }

    @GetMapping("/m/nid")
    public String mobileSignup() {
        logRequest("MOBILE SIGNUP");
        return "mobile";
    }

    @GetMapping("/m/board-request")
    public String mobileBoardRequest() {
        logRequest("MOBILE BOARD REQUEST");
        return "mobile";
    }

    @GetMapping("/policy.html")
    public String policy() {
        logRequest("POLICY");
        return "policy";
    }

    @GetMapping("/test")
    public String test() {
        logRequest("TEST");
        return "test";
    }

    @GetMapping("/admin")
    public String admin() {
        logRequest("ADMIN");
        return "admin";
    }
}
