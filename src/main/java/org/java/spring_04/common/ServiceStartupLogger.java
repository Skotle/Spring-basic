package org.java.spring_04.common;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.util.Arrays;

@Component
public class ServiceStartupLogger {
    private static final Logger log = LoggerFactory.getLogger(ServiceStartupLogger.class);

    private final Environment environment;

    public ServiceStartupLogger(Environment environment) {
        this.environment = environment;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void logStartupState() {
        String datasourceUrl = environment.getProperty("spring.datasource.url", "");
        String adminAddresses = environment.getProperty("app.security.admin-allowed-addresses", "");

        log.info("SERVICE_READY application={} port={} database={} mailConfigured={} gcsConfigured={} adminAddressCount={} sessionSecure={}",
                environment.getProperty("spring.application.name", "unknown"),
                environment.getProperty("server.port", "8080"),
                databaseName(datasourceUrl),
                hasText(environment.getProperty("spring.mail.username")) && hasText(environment.getProperty("spring.mail.password")),
                hasText(environment.getProperty("app.gcs.bucket-name")),
                countCsv(adminAddresses),
                environment.getProperty("server.servlet.session.cookie.secure", "false"));
    }

    private String databaseName(String datasourceUrl) {
        if (!hasText(datasourceUrl)) {
            return "not-configured";
        }
        try {
            String schemeSpecificPart = URI.create(datasourceUrl.substring(5)).getSchemeSpecificPart();
            int question = schemeSpecificPart.indexOf('?');
            String withoutQuery = question >= 0 ? schemeSpecificPart.substring(0, question) : schemeSpecificPart;
            int slash = withoutQuery.lastIndexOf('/');
            return slash >= 0 && slash + 1 < withoutQuery.length() ? withoutQuery.substring(slash + 1) : "configured";
        } catch (Exception ignored) {
            int question = datasourceUrl.indexOf('?');
            String withoutQuery = question >= 0 ? datasourceUrl.substring(0, question) : datasourceUrl;
            int slash = withoutQuery.lastIndexOf('/');
            return slash >= 0 && slash + 1 < withoutQuery.length() ? withoutQuery.substring(slash + 1) : "configured";
        }
    }

    private int countCsv(String value) {
        if (!hasText(value)) {
            return 0;
        }
        return (int) Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .count();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
