package org.java.spring_04;
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class BoardRouter(
    private val jdbcTemplate: JdbcTemplate
) {

    @GetMapping("/api/board/rec")
    fun wow(): List<Map<String, Any?>> {
        val sql = "SELECT * FROM gallery"
        return jdbcTemplate.queryForList(sql)
    }
}