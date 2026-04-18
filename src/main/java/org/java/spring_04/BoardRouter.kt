package org.java.spring_04

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.ResponseBody
import java.time.LocalDateTime

@Controller
class BoardRouter(
    private val jdbcTemplate: JdbcTemplate
) {

    private fun logRequest(pageName: String) {
        println("[${LocalDateTime.now()}] GET $pageName PAGE")
    }

    @GetMapping("/boards")
    fun boards(): String {
        logRequest("BOARDS")
        return "boards"
    }

    @GetMapping("/board_main")
    fun boardMain(): String {
        logRequest("BOARD IN")
        return "board_main"
    }

    @GetMapping("/board/{gid}")
    fun boardDetail(@PathVariable gid: String): String {
        logRequest("BOARD $gid")
        return "board_main"
    }

    @GetMapping("/board/{gid}/write")
    fun postWrite(@PathVariable gid: String): String {
        logRequest("WRITE $gid")
        return "post_write"
    }

    @GetMapping("/board/{gid}/{postNo}")
    fun postDetail(@PathVariable gid: String, @PathVariable postNo: Long): String {
        logRequest("POST $gid/$postNo")
        return "post"
    }

    @ResponseBody
    @GetMapping("/api/board/rec")
    fun recommendedStockusPosts(): List<Map<String, Any?>> {
        println("[${LocalDateTime.now()}] API /api/board/rec")
        val sql = "SELECT * FROM post WHERE gall_id = 'stockus'"
        return jdbcTemplate.queryForList(sql)
    }
}
