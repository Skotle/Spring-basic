package org.java.spring_04;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling; // 추가

@EnableScheduling // 스케줄링 활성화
@SpringBootApplication
public class Spring04Application {
    public static void main(String[] args) {
        SpringApplication.run(Spring04Application.class, args);
    }
}
