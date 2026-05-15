package org.java.spring_04.common;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RequestReplayGuard {
    private static final int MAX_TRACKED_REQUESTS = 20_000;
    private final ConcurrentHashMap<String, Long> seenRequests = new ConcurrentHashMap<>();

    public boolean markIfNew(HttpServletRequest request, String requestId, Duration ttl) {
        long now = System.currentTimeMillis();
        long expiresAt = now + ttl.toMillis();
        cleanupExpired(now);
        String key = replayKey(request, requestId);
        final boolean[] accepted = {false};
        seenRequests.compute(key, (ignored, existing) -> {
            if (existing == null || existing <= now) {
                accepted[0] = true;
                return expiresAt;
            }
            return existing;
        });
        return accepted[0];
    }

    private void cleanupExpired(long now) {
        if (seenRequests.size() < MAX_TRACKED_REQUESTS) {
            return;
        }
        seenRequests.entrySet().removeIf(entry -> entry.getValue() <= now);
    }

    private String replayKey(HttpServletRequest request, String requestId) {
        String scope = sessionScope(request);
        String id = requestId == null ? "" : requestId.trim().toLowerCase(Locale.ROOT);
        return scope + ":" + id;
    }

    private String sessionScope(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            return "session:" + session.getId();
        }
        String remote = request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
        String userAgent = request.getHeader("User-Agent") == null ? "" : request.getHeader("User-Agent");
        return "remote:" + remote + ":" + Integer.toHexString(userAgent.hashCode());
    }
}
