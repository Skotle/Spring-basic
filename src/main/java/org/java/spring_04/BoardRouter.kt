package org.java.spring_04

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpSession
import org.java.spring_04.board.BoardService
import org.java.spring_04.post.PostService
import org.springframework.stereotype.Controller
import org.springframework.ui.Model
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestParam
import java.time.LocalDateTime
import java.util.LinkedHashMap

@Controller
class BoardRouter(
    private val postService: PostService,
    private val boardService: BoardService
) {

    private fun logRequest(pageName: String, detail: String? = null) {
        val suffix = if (detail.isNullOrBlank()) "" else " | $detail"
        println("[${LocalDateTime.now()}] GET $pageName PAGE$suffix")
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

    @GetMapping("/board/{gid}/settings")
    fun boardSettings(@PathVariable gid: String): String {
        logRequest("BOARD SETTINGS $gid")
        return "index"
    }

    @GetMapping("/board/{gid}/manage")
    fun boardManage(@PathVariable gid: String): String {
        logRequest("BOARD MANAGE $gid")
        return "index"
    }

    @GetMapping("/m/board/{gid}/write")
    fun mobilePostWrite(@PathVariable gid: String): String {
        logRequest("MOBILE WRITE $gid")
        return "mobile"
    }

    @GetMapping("/board/{gid}/{postNo}")
    fun postDetail(
        @PathVariable gid: String,
        @PathVariable postNo: Long,
        @RequestParam(name = "page", defaultValue = "1") page: Int,
        model: Model,
        session: HttpSession,
        request: HttpServletRequest
    ): String {
        val viewerUid = sessionUid(session) ?: "guest"
        val clientIp = extractClientIp(request)
        val currentPage = if (page < 1) 1 else page
        logRequest("POST $gid/$postNo", "viewer=$viewerUid ip=$clientIp page=$currentPage")
        val post = postService.getPostDetail(gid, postNo)
        model.addAttribute("gid", gid)
        model.addAttribute("postNo", postNo)
        model.addAttribute("currentPage", currentPage)
        model.addAttribute("loggedIn", isLoggedIn(session))
        model.addAttribute("sessionUid", sessionUid(session))
        model.addAttribute("sessionNick", session.getAttribute("nick")?.toString() ?: "")

        if (post == null) {
            println("[${LocalDateTime.now()}] POST PAGE RESULT | gid=$gid postNo=$postNo result=not_found")
            model.addAttribute("errorMessage", "Post not found.")
            model.addAttribute("comments", emptyList<Map<String, Any>>())
            model.addAttribute("voteState", mapOf("canVote" to true, "voteType" to ""))
            model.addAttribute("postCanDelete", false)
            model.addAttribute("pagePosts", emptyList<Map<String, Any>>())
            return "post"
        }

        val comments = postService.getComments(gid, postNo).map { comment ->
            val copy = LinkedHashMap(comment)
            copy["canDelete"] = canDelete(comment, session)
            copy
        }

        model.addAttribute("post", post)
        model.addAttribute("comments", comments)
        model.addAttribute("pagePosts", boardService.getPostsByGallery(gid, currentPage))
        model.addAttribute("voteState", postService.getVoteState(gid, postNo, sessionUid(session), extractClientIp(request)))
        model.addAttribute("postCanDelete", canDelete(post, session))
        println("[${LocalDateTime.now()}] POST PAGE RESULT | gid=$gid postNo=$postNo page=$currentPage comments=${comments.size} canDelete=${canDelete(post, session)}")
        return "post"
    }

    @GetMapping("/m/board/{gid}/{postNo}")
    fun mobilePostDetail(@PathVariable gid: String, @PathVariable postNo: Long): String {
        logRequest("MOBILE POST $gid/$postNo")
        return "mobile"
    }

    private fun sessionUid(session: HttpSession): String? = session.getAttribute("uid")?.toString()?.takeIf { it.isNotBlank() }

    private fun sessionDivision(session: HttpSession): String = session.getAttribute("memberDivision")?.toString().orEmpty()

    private fun isLoggedIn(session: HttpSession): Boolean = !sessionUid(session).isNullOrBlank()

    private fun canDelete(row: Map<String, *>, session: HttpSession): Boolean {
        val writerUid = row["writer_uid"]?.toString()?.trim().orEmpty()
        val currentUid = sessionUid(session)?.trim().orEmpty()
        val admin = sessionDivision(session) == "1" || sessionDivision(session).equals("admin", ignoreCase = true)
        if (admin) return true
        if (writerUid.isNotBlank()) return currentUid.isNotBlank() && writerUid == currentUid
        return currentUid.isBlank()
    }

    private fun extractClientIp(request: HttpServletRequest): String {
        val forwarded = request.getHeader("X-Forwarded-For")
        if (!forwarded.isNullOrBlank()) {
            return forwarded.split(",")[0].trim()
        }
        val realIp = request.getHeader("X-Real-IP")
        if (!realIp.isNullOrBlank()) {
            return realIp.trim()
        }
        return request.remoteAddr
    }
}
