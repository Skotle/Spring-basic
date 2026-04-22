package org.java.spring_04

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import java.time.LocalDateTime

@Controller
class BoardRouter {

    private fun logRequest(pageName: String) {
        println("[${LocalDateTime.now()}] GET $pageName PAGE")
    }

    @GetMapping("/boards")
    fun boards(): String {
        logRequest("BOARDS")
        return "index"
    }

    @GetMapping("/m/boards")
    fun mobileBoards(): String {
        logRequest("MOBILE BOARDS")
        return "mobile"
    }

    @GetMapping("/board_main")
    fun boardMain(): String {
        logRequest("BOARD_MAIN")
        return "index"
    }

    @GetMapping("/board/{gid}")
    fun boardDetail(@PathVariable gid: String): String {
        logRequest("BOARD $gid")
        return "index"
    }

    @GetMapping("/m/board/{gid}")
    fun mobileBoardDetail(@PathVariable gid: String): String {
        logRequest("MOBILE BOARD $gid")
        return "mobile"
    }

    @GetMapping("/board/{gid}/write")
    fun postWrite(@PathVariable gid: String): String {
        logRequest("WRITE $gid")
        return "index"
    }

    @GetMapping("/m/board/{gid}/write")
    fun mobilePostWrite(@PathVariable gid: String): String {
        logRequest("MOBILE WRITE $gid")
        return "mobile"
    }

    @GetMapping("/board/{gid}/{postNo}")
    fun postDetail(@PathVariable gid: String, @PathVariable postNo: Long): String {
        logRequest("POST $gid/$postNo")
        return "index"
    }

    @GetMapping("/m/board/{gid}/{postNo}")
    fun mobilePostDetail(@PathVariable gid: String, @PathVariable postNo: Long): String {
        logRequest("MOBILE POST $gid/$postNo")
        return "mobile"
    }
}
