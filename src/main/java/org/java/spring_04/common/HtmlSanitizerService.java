package org.java.spring_04.common;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;
import org.springframework.stereotype.Service;

@Service
public class HtmlSanitizerService {
    private static final Safelist SAFE_HTML = Safelist.relaxed()
            .addTags("span", "hr")
            .addAttributes("img", "alt", "title")
            .addProtocols("img", "src", "http", "https")
            .addProtocols("a", "href", "http", "https", "mailto");

    public String sanitize(String rawHtml) {
        if (rawHtml == null || rawHtml.isBlank()) {
            return "";
        }

        Document.OutputSettings outputSettings = new Document.OutputSettings();
        outputSettings.prettyPrint(false);
        return Jsoup.clean(rawHtml, "", SAFE_HTML, outputSettings).trim();
    }

    public String extractPlainText(String html) {
        if (html == null || html.isBlank()) {
            return "";
        }
        return Jsoup.parse(html).text().replace('\u00A0', ' ').trim();
    }
}
