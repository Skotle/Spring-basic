package org.java.spring_04.feature;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class FeatureScheduler {
    private final FeatureService featureService;
    private final JdbcTemplate jdbcTemplate;

    public FeatureScheduler(FeatureService featureService, JdbcTemplate jdbcTemplate) {
        this.featureService = featureService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(cron = "0 20 4 * * *")
    public void runDailyMaintenance() {
        try {
            featureService.runDormancyCheck();
            jdbcTemplate.update("DELETE FROM alarm WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)");
        } catch (Exception e) {
            System.err.println("[FeatureScheduler] daily maintenance failed: " + e.getMessage());
        }
    }
}
