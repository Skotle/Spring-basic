package org.java.spring_04.common;

import javax.sql.DataSource;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.util.Properties;

@Configuration
public class DatabaseConfig {
    private static final Logger log = LoggerFactory.getLogger(DatabaseConfig.class);

    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    @Value("${spring.datasource.username}")
    private String datasourceUsername;

    @Value("${spring.datasource.password}")
    private String datasourcePassword;

    @Value("${spring.datasource.driver-class-name:}")
    private String datasourceDriverClassName;

    @Bean
    public DataSource dataSource() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource();
        String configuredUrl = datasourceUrl == null ? "" : datasourceUrl.trim();
        if (configuredUrl.isEmpty()) {
            throw new IllegalStateException("SPRING_DATASOURCE_URL is required when running with MySQL.");
        }

        String driverClassName = datasourceDriverClassName == null || datasourceDriverClassName.isBlank()
                ? "com.mysql.cj.jdbc.Driver"
                : datasourceDriverClassName.trim();
        String configuredUsername = datasourceUsername == null ? "" : datasourceUsername.trim();
        if (configuredUsername.isEmpty()) {
            throw new IllegalStateException("SPRING_DATASOURCE_USERNAME is required when running with MySQL.");
        }
        String configuredPassword = datasourcePassword == null ? "" : datasourcePassword;

        dataSource.setDriverClassName(driverClassName);
        dataSource.setUrl(configuredUrl);
        dataSource.setUsername(configuredUsername);
        dataSource.setPassword(configuredPassword);

        if (driverClassName.contains("mysql")) {
            Properties properties = new Properties();
            properties.setProperty("useUnicode", "true");
            properties.setProperty("characterEncoding", "UTF-8");
            properties.setProperty("characterSetResults", "utf8mb4");
            properties.setProperty("connectionCollation", "utf8mb4_unicode_ci");
            properties.setProperty("connectionTimeZone", "Asia/Seoul");
            properties.setProperty("forceConnectionTimeZoneToSession", "true");
            properties.setProperty("serverTimezone", "Asia/Seoul");
            dataSource.setConnectionProperties(properties);
        }

        log.info("Datasource configured. driver={} database={}", driverClassName, databaseName(configuredUrl));
        return dataSource;
    }

    @Bean
    public JdbcTemplate jdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    private String databaseName(String jdbcUrl) {
        try {
            String uriText = jdbcUrl.replaceFirst("^jdbc:", "");
            URI uri = URI.create(uriText);
            String path = uri.getPath();
            if (path == null || path.length() <= 1) {
                return "unknown";
            }
            return path.substring(1);
        } catch (Exception ignored) {
            return "unknown";
        }
    }
}
