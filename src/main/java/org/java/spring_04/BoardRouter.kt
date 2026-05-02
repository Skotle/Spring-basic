package org.java.spring_04

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpSession
import org.java.spring_04.board.BoardService
import org.java.spring_04.common.RequestIpResolver
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
    private val boardService: BoardService,
    private val requestIpResolver: RequestIpResolver
) {

    private fun logRequest(pageName: String, detail: String? = null) {
        val suffix = if (detail.isNullOrBlank()) "" else " | $detail"
        println("[${LocalDateTime.now()}] GET $pageName PAGE$suffix")
    }

    @GetMapping("/boards", "/board", "/board_main")
    fun boards(
        @RequestParam(name = "type", required = false) type: String?,
        model: Model,
        session: HttpSession
    ): String {
        val boards = boardService.getBoardList()
        val mainBoards = boards.filter { boardType(it) == "main" }
        val sideBoards = boards.filter { boardType(it) == "side" }
        val otherBoards = boards.filter { boardType(it) == "other" }
        val currentType = normalizeBoardType(type)

        logRequest("BOARDS", "type=$currentType total=${boards.size}")
        model.addAttribute("loggedIn", isLoggedIn(session))
        model.addAttribute("sessionUid", sessionUid(session))
        model.addAttribute("sessionNick", session.getAttribute("nick")?.toString() ?: "")
        model.addAttribute("boards", boards)
        model.addAttribute("mainBoards", mainBoards)
        model.addAttribute("sideBoards", sideBoards)
        model.addAttribute("otherBoards", otherBoards)
        model.addAttribute("currentType", currentType)
        model.addAttribute("totalBoardCount", boards.size)
        model.addAttribute("mainBoardCount", mainBoards.size)
        model.addAttribute("sideBoardCount", sideBoards.size)
        model.addAttribute("otherBoardCount", otherBoards.size)
        return "boards"
    }

    @GetMapping("/m/boards")
    fun mobileBoards(
        @RequestParam(name = "type", required = false) type: String?,
        model: Model,
        session: HttpSession
    ): String {
        val boards = boardService.getBoardList()
        val mainBoards = boards.filter { boardType(it) == "main" }
        val sideBoards = boards.filter { boardType(it) == "side" }
        val otherBoards = boards.filter { boardType(it) == "other" }
        val currentType = normalizeBoardType(type)

        logRequest("MOBILE BOARDS", "type=$currentType total=${boards.size}")
        model.addAttribute("loggedIn", isLoggedIn(session))
        model.addAttribute("sessionUid", sessionUid(session))
        model.addAttribute("sessionNick", session.getAttribute("nick")?.toString() ?: "")
        model.addAttribute("boards", boards)
        model.addAttribute("mainBoards", mainBoards)
        model.addAttribute("sideBoards", sideBoards)
        model.addAttribute("otherBoards", otherBoards)
        model.addAttribute("currentType", currentType)
        model.addAttribute("totalBoardCount", boards.size)
        model.addAttribute("mainBoardCount", mainBoards.size)
        model.addAttribute("sideBoardCount", sideBoards.size)
        model.addAttribute("otherBoardCount", otherBoards.size)
        return "mobile_boards"
    }

    @GetMapping("/board/{gid}")
    fun boardDetail(
        @PathVariable gid: String,
        @RequestParam(name = "page", defaultValue = "1") page: Int,
        @RequestParam(name = "mode", defaultValue = "all") mode: String,
        @RequestParam(name = "category", required = false) category: String?,
        model: Model,
        session: HttpSession
    ): String {
        val boardId = cleanPathSegment(gid)
        val currentPage = if (page < 1) 1 else page
        val manageData = boardService.getBoardManageInfo(boardId, sessionUid(session), sessionDivision(session))
        @Suppress("UNCHECKED_CAST")
        val settings = manageData["settings"] as? Map<String, Any?> ?: emptyMap()
        @Suppress("UNCHECKED_CAST")
        val permissions = manageData["permissions"] as? Map<String, Any?> ?: emptyMap()
        @Suppress("UNCHECKED_CAST")
        val board = manageData["board"] as? Map<String, Any?> ?: emptyMap()
        @Suppress("UNCHECKED_CAST")
        val submanagers = manageData["submanagers"] as? List<Map<String, Any?>> ?: emptyList()

        val categoryOptions = (settings["category_options_list"] as? List<*>)?.mapNotNull {
            it?.toString()?.trim()?.takeIf(String::isNotBlank)
        } ?: emptyList()
        val currentMode = normalizeBoardMode(mode)
        val currentCategory = normalizeBoardCategory(category, categoryOptions)
        val posts = boardService.getPostsByGallery(boardId, currentPage, currentMode, currentCategory)
        val canWritePost = isLoggedIn(session) || flagEnabled(settings["allow_guest_post"])
        val boardBadgeImage = firstNonBlank(
            settings["cover_image_url"]?.toString(),
            board["cover_image_url"]?.toString(),
            board["badge_image_url"]?.toString(),
            board["badge_url"]?.toString(),
            board["icon_url"]?.toString(),
            board["image_url"]?.toString()
        )

        logRequest("BOARD $boardId", "page=$currentPage mode=$currentMode category=${currentCategory ?: "-"} posts=${posts.size}")
        model.addAttribute("gid", boardId)
        model.addAttribute("currentPage", currentPage)
        model.addAttribute("loggedIn", isLoggedIn(session))
        model.addAttribute("sessionUid", sessionUid(session))
        model.addAttribute("sessionNick", session.getAttribute("nick")?.toString() ?: "")
        model.addAttribute("manageData", manageData)
        model.addAttribute("boardInfo", board)
        model.addAttribute("settings", settings)
        model.addAttribute("permissions", permissions)
        model.addAttribute("manager", manageData["manager"])
        model.addAttribute("submanagers", submanagers)
        model.addAttribute("posts", posts)
        model.addAttribute("currentMode", currentMode)
        model.addAttribute("currentCategory", currentCategory)
        model.addAttribute("categoryOptions", categoryOptions)
        model.addAttribute("canWritePost", canWritePost)
        model.addAttribute("boardBadgeImage", boardBadgeImage)
        model.addAttribute("hasPrevPage", currentPage > 1)
        model.addAttribute("hasNextPage", posts.size >= 20)
        return "board_main"
    }

    @GetMapping("/m/board/{gid}")
    fun mobileBoardDetail(@PathVariable gid: String): String {
        logRequest("MOBILE BOARD $gid")
        return "mobile"
    }

    @GetMapping("/board/{gid}/write")
    fun postWrite(@PathVariable gid: String): String {
        logRequest("WRITE ${cleanPathSegment(gid)}")
        return "index"
    }

    @GetMapping("/board/{gid}/settings")
    fun boardSettings(@PathVariable gid: String, session: HttpSession): String {
        val boardId = cleanPathSegment(gid)
        logRequest("BOARD SETTINGS $boardId")
        if (!boardService.canEditBoardSettings(boardId, sessionUid(session), sessionDivision(session))) {
            return "redirect:/board/$boardId"
        }
        return "index"
    }

    @GetMapping("/board/{gid}/manage")
    fun boardManage(@PathVariable gid: String, session: HttpSession): String {
        val boardId = cleanPathSegment(gid)
        logRequest("BOARD MANAGE $boardId")
        if (!boardService.canManageBoard(boardId, sessionUid(session), sessionDivision(session))) {
            return "redirect:/board/$boardId"
        }
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
        val boardId = cleanPathSegment(gid)
        val viewerUid = sessionUid(session) ?: "guest"
        val clientIp = extractClientIp(request)
        val currentPage = if (page < 1) 1 else page
        logRequest("POST $boardId/$postNo", "viewer=$viewerUid ip=$clientIp page=$currentPage")
        val post = postService.getPostDetail(boardId, postNo)
        val manageData = boardService.getBoardManageInfo(boardId, sessionUid(session), sessionDivision(session))
        @Suppress("UNCHECKED_CAST")
        val settings = manageData["settings"] as? Map<String, Any?> ?: emptyMap()
        @Suppress("UNCHECKED_CAST")
        val permissions = manageData["permissions"] as? Map<String, Any?> ?: emptyMap()
        model.addAttribute("gid", boardId)
        model.addAttribute("postNo", postNo)
        model.addAttribute("currentPage", currentPage)
        model.addAttribute("loggedIn", isLoggedIn(session))
        model.addAttribute("sessionUid", sessionUid(session))
        model.addAttribute("sessionNick", session.getAttribute("nick")?.toString() ?: "")
        model.addAttribute("settings", settings)
        model.addAttribute("permissions", permissions)

        if (post == null) {
            model.addAttribute("errorMessage", "Post not found.")
            model.addAttribute("comments", emptyList<Map<String, Any>>())
            model.addAttribute("voteState", mapOf("canVote" to true, "voteType" to ""))
            model.addAttribute("postCanDelete", false)
            model.addAttribute("pagePosts", emptyList<Map<String, Any>>())
            return "post"
        }

        val comments = postService.getComments(boardId, postNo).map { comment ->
            val copy = LinkedHashMap(comment)
            val deleted = flagEnabled(comment["is_deleted"])
            copy["canDelete"] = !deleted && canDelete(comment, session, boardId, false)
            copy["requiresDeletePassword"] = requiresDeletePassword(comment, session)
            copy
        }

        model.addAttribute("post", post)
        model.addAttribute("comments", comments)
        model.addAttribute("pagePosts", boardService.getPostsByGallery(boardId, currentPage))
        model.addAttribute("voteState", postService.getVoteState(boardId, postNo, sessionUid(session), extractClientIp(request)))
        model.addAttribute("postCanDelete", canDelete(post, session, boardId, true))
        model.addAttribute("postRequiresDeletePassword", requiresDeletePassword(post, session))
        return "post"
    }

    @GetMapping("/m/board/{gid}/{postNo}")
    fun mobilePostDetail(@PathVariable gid: String, @PathVariable postNo: Long): String {
        logRequest("MOBILE POST $gid/$postNo")
        return "mobile"
    }

    private fun sessionUid(session: HttpSession): String? =
        session.getAttribute("uid")?.toString()?.takeIf { it.isNotBlank() }

    private fun sessionDivision(session: HttpSession): String =
        session.getAttribute("memberDivision")?.toString().orEmpty()

    private fun isLoggedIn(session: HttpSession): Boolean =
        !sessionUid(session).isNullOrBlank()

    private fun requiresDeletePassword(row: Map<String, *>, session: HttpSession): Boolean {
        val writerUid = row["writer_uid"]?.toString()?.trim().orEmpty()
        return writerUid.isBlank() && !isLoggedIn(session)
    }

    private fun canDelete(row: Map<String, *>, session: HttpSession, gallId: String, postDelete: Boolean): Boolean {
        val writerUid = row["writer_uid"]?.toString()?.trim().orEmpty()
        val currentUid = sessionUid(session)?.trim().orEmpty()
        val division = sessionDivision(session)
        val admin = division == "1"
                || division.equals("admin", ignoreCase = true)
                || division.equals("operator", ignoreCase = true)
        if (admin) return true
        if (if (postDelete) boardService.canDeletePost(gallId, currentUid, division) else boardService.canDeleteComment(gallId, currentUid, division)) return true
        if (writerUid.isNotBlank()) return currentUid.isNotBlank() && writerUid == currentUid
        return currentUid.isBlank()
    }

    private fun extractClientIp(request: HttpServletRequest): String =
        requestIpResolver.resolve(request)

    private fun normalizeBoardMode(value: String?): String {
        return when (value?.trim()?.lowercase()) {
            "concept" -> "concept"
            "notice" -> "notice"
            else -> "all"
        }
    }

    private fun normalizeBoardCategory(value: String?, options: List<String>): String? {
        val normalized = value?.trim()?.takeIf { it.isNotBlank() } ?: return null
        if (normalized.startsWith(":")) {
            return null
        }
        return normalized
    }

    private fun normalizeBoardType(value: String?): String {
        return when (value?.trim()?.lowercase()) {
            "main", "board" -> "main"
            "side", "m", "minor" -> "side"
            "other", "etc" -> "other"
            else -> "all"
        }
    }

    private fun boardType(board: Map<String, Any?>): String {
        return when (board["gall_type"]?.toString()?.trim()?.lowercase()) {
            "main" -> "main"
            "m", "side", "minor" -> "side"
            else -> "other"
        }
    }

    private fun cleanPathSegment(value: String): String =
        value.substringBefore(';').trim()

    private fun flagEnabled(value: Any?): Boolean {
        return when (value) {
            is Boolean -> value
            is Number -> value.toInt() != 0
            null -> false
            else -> {
                val text = value.toString().trim()
                text == "1" || text.equals("true", ignoreCase = true)
                        || text.equals("yes", ignoreCase = true)
                        || text.equals("on", ignoreCase = true)
            }
        }
    }

    private fun firstNonBlank(vararg values: String?): String? {
        for (value in values) {
            if (!value.isNullOrBlank()) {
                return value
            }
        }
        return null
    }
}
