package org.java.spring_04.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import javax.sql.DataSource;

@Configuration
public class DatabaseConfig {

    @Bean
    public DataSource dataSource() {
        System.out.println("[Config] GCP MySQL 연결 시도 중 (target: mydb)...");
        DriverManagerDataSource dataSource = new DriverManagerDataSource();

        dataSource.setDriverClassName("com.mysql.cj.jdbc.Driver");

        // [중요] GCP 콘솔 '개요' 탭에 있는 '공용 IP 주소'를 입력하세요.
        // 뒤에 /mydb를 붙여 이미지에 생성하신 mydb 스키마를 사용하도록 합니다.
        dataSource.setUrl("jdbc:mysql://34.81.209.172:3306/mydb?serverTimezone=Asia/Seoul&characterEncoding=UTF-8");

        // SQL 사용자 메뉴에서 설정한 계정 (보통 root)과 비밀번호
        dataSource.setUsername("Skotle");
        dataSource.setPassword("@A09ajdud21");

        System.out.println("[Config] GCP MySQL 연결 성공!");
        return dataSource;
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }
}