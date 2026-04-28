package org.java.spring_04.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class MobileRedirectFilter extends OncePerRequestFilter {
    private static final Pattern BOARD_WRITE_PATTERN = Pattern.compile("^/board/([^/]+)/write/?$");
    private static final Pattern BOARD_MANAGE_PATTERN = Pattern.compile("^/board/([^/]+)/(?:manage|settings)/?$");
    private static final Pattern BOARD_POST_PATTERN = Pattern.compile("^/board/([^/]+)/([^/]+)/?$");
    private static final Pattern BOARD_PATTERN = Pattern.compile("^/board/([^/]+)/?$");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String target = mobileTarget(request);
        if (target == null) {
            filterChain.doFilter(request, response);
            return;
        }

        response.sendRedirect(response.encodeRedirectURL(target));
    }

    private String mobileTarget(HttpServletRequest request) {
        if (!isRedirectCandidate(request)) {
            return null;
        }

        String path = request.getRequestURI();
        String target = mapMobilePath(path);
        if (target == null || target.equals(path)) {
            return null;
        }

        String query = request.getQueryString();
        return query == null || query.isBlank() ? target : target + "?" + query;
    }

    private boolean isRedirectCandidate(HttpServletRequest request) {
        String method = request.getMethod();
        if (!"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method)) {
            return false;
        }

        String path = request.getRequestURI();
        if (path == null || path.startsWith("/m") || path.startsWith("/api") || path.startsWith("/admin")) {
            return false;
        }
        if (isStaticAsset(path)) {
            return false;
        }
        if (!acceptsHtml(request)) {
            return false;
        }
        return isMobileRequest(request);
    }

    private boolean isStaticAsset(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        return lower.startsWith("/css/")
                || lower.startsWith("/js/")
                || lower.startsWith("/images/")
                || lower.startsWith("/img/")
                || lower.startsWith("/webjars/")
                || lower.startsWith("/uploads/")
                || lower.equals("/favicon.ico")
                || lower.endsWith(".css")
                || lower.endsWith(".js")
                || lower.endsWith(".png")
                || lower.endsWith(".jpg")
                || lower.endsWith(".jpeg")
                || lower.endsWith(".gif")
                || lower.endsWith(".svg")
                || lower.endsWith(".ico")
                || lower.endsWith(".webp")
                || lower.endsWith(".map");
    }

    private boolean acceptsHtml(HttpServletRequest request) {
        String accept = request.getHeader("Accept");
        return accept == null || accept.contains("text/html") || accept.contains("*/*");
    }

    private boolean isMobileRequest(HttpServletRequest request) {
        String clientHint = request.getHeader("Sec-CH-UA-Mobile");
        if ("?1".equals(clientHint)) {
            return true;
        }

        String userAgent = request.getHeader("User-Agent");
        if (userAgent == null) {
            return false;
        }

        String ua = userAgent.toLowerCase(Locale.ROOT);
        return ua.contains("mobi")
                || ua.contains("android")
                || ua.contains("iphone")
                || ua.contains("ipod")
                || ua.contains("blackberry")
                || ua.contains("windows phone")
                || ua.contains("opera mini");
    }

    private String mapMobilePath(String path) {
        if (path == null || path.isBlank() || "/".equals(path)) {
            return "/m";
        }
        if ("/signin".equals(path)) {
            return "/m/signin";
        }
        if ("/nid".equals(path)) {
            return "/m/nid";
        }
        if ("/boards".equals(path) || "/board_main".equals(path)) {
            return "/m/boards";
        }

        Matcher writeMatcher = BOARD_WRITE_PATTERN.matcher(path);
        if (writeMatcher.matches()) {
            return "/m/board/" + writeMatcher.group(1) + "/write";
        }

        Matcher manageMatcher = BOARD_MANAGE_PATTERN.matcher(path);
        if (manageMatcher.matches()) {
            return "/m/board/" + manageMatcher.group(1);
        }

        Matcher postMatcher = BOARD_POST_PATTERN.matcher(path);
        if (postMatcher.matches()) {
            return "/m/board/" + postMatcher.group(1) + "/" + postMatcher.group(2);
        }

        Matcher boardMatcher = BOARD_PATTERN.matcher(path);
        if (boardMatcher.matches()) {
            return "/m/board/" + boardMatcher.group(1);
        }

        return null;
    }
}
