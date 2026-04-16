package org.java.spring_04;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Spring04Application {
    public static void main(String[] args) {
        // 서버 실행 시 스프링이 자동으로 Controller, Service 등을 찾아 빈(Bean)으로 등록합니다.
        SpringApplication.run(Spring04Application.class, args);
    }
}