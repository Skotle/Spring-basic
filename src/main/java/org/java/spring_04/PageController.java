package org.java.spring_04;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import java.time.LocalDateTime;

@Controller
public class PageController {
    @GetMapping("/")
    public String index() {
        System.out.print("["+LocalDateTime.now()+"]");
        System.out.print("GET INDEX PAGE\n");
        return "index"; // ← templates/home.html
    }
    @GetMapping("/signin")
    public String login() {
        System.out.print("["+LocalDateTime.now()+"]");
        System.out.print("GET LOGIN PAGE\n");
        return "login"; // ← templates/home.html
    }
    @GetMapping("/nid")
    public String nid() {
        System.out.print("["+LocalDateTime.now()+"]");
        System.out.print("GET NEWID PAGE\n");
        return "nid"; // ← templates/nid.html
    }
}