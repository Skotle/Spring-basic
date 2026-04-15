package org.java.spring_04;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class PageController {

    @GetMapping("/")
    public String index() {
        System.out.println("GET INDEX");
        return "index"; // ← templates/home.html
    }
    @GetMapping("/signin")
    public String login() {
        System.out.println("GET INDEX");
        return "login"; // ← templates/home.html
    }
}