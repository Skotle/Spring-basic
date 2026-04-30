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
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
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
    fun boardDetail(
        @PathVariable gid: String,
        @RequestParam(name = "page", defaultValue = "1") page: Int,
        @RequestParam(name = "mode", defaultValue = "all") mode: String,
        @RequestParam(name = "category", required = false) category: String?,
        model: Model,
        session: HttpSession
    ): String {
        val currentPage = if (page < 1) 1 else page
        val manageData = boardService.getBoardManageInfo(gid, sessionUid(session), sessionDivision(session))
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

        if (shouldRedirectBoardCanonical(page, mode, category, currentPage, currentMode, currentCategory)) {
            return buildBoardCanonicalRedirect(gid, currentPage, currentMode, currentCategory)
        }

        val posts = boardService.getPostsByGallery(gid, currentPage, currentMode, currentCategory)
        val canWritePost = isLoggedIn(session) || flagEnabled(settings["allow_guest_post"])
        val boardBadgeImage = firstNonBlank(
            settings["cover_image_url"]?.toString(),
            board["cover_image_url"]?.toString(),
            board["badge_image_url"]?.toString(),
            board["badge_url"]?.toString(),
            board["icon_url"]?.toString(),
            board["image_url"]?.toString()
        )

        logRequest("BOARD $gid", "page=$currentPage mode=$currentMode category=${currentCategory ?: "-"} posts=${posts.size}")
        model.addAttribute("gid", gid)
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
        logRequest("WRITE $gid")
        return "index"
    }

    @GetMapping("/board/{gid}/settings")
    fun boardSettings(@PathVariable gid: String, session: HttpSession): String {
        logRequest("BOARD SETTINGS $gid")
        if (!boardService.canEditBoardSettings(gid, sessionUid(session), sessionDivision(session))) {
            return "redirect:/board/$gid"
        }
        return "index"
    }

    @GetMapping("/board/{gid}/manage")
    fun boardManage(@PathVariable gid: String, session: HttpSession): String {
        logRequest("BOARD MANAGE $gid")
        if (!boardService.canManageBoard(gid, sessionUid(session), sessionDivision(session))) {
            return "redirect:/board/$gid"
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
        val viewerUid = sessionUid(session) ?: "guest"
        val clientIp = extractClientIp(request)
        val currentPage = if (page < 1) 1 else page
        logRequest("POST $gid/$postNo", "viewer=$viewerUid ip=$clientIp page=$currentPage")
        val post = postService.getPostDetail(gid, postNo)
        val manageData = boardService.getBoardManageInfo(gid, sessionUid(session), sessionDivision(session))
        @Suppress("UNCHECKED_CAST")
        val settings = manageData["settings"] as? Map<String, Any?> ?: emptyMap()
        @Suppress("UNCHECKED_CAST")
        val permissions = manageData["permissions"] as? Map<String, Any?> ?: emptyMap()
        model.addAttribute("gid", gid)
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

        val comments = postService.getComments(gid, postNo).map { comment ->
            val copy = LinkedHashMap(comment)
            val deleted = flagEnabled(comment["is_deleted"])
            copy["canDelete"] = !deleted && canDelete(comment, session, gid, false)
            copy["requiresDeletePassword"] = requiresDeletePassword(comment, session)
            copy
        }

        model.addAttribute("post", post)
        model.addAttribute("comments", comments)
        model.addAttribute("pagePosts", boardService.getPostsByGallery(gid, currentPage))
        model.addAttribute("voteState", postService.getVoteState(gid, postNo, sessionUid(session), extractClientIp(request)))
        model.addAttribute("postCanDelete", canDelete(post, session, gid, true))
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

    private fun shouldRedirectBoardCanonical(
        rawPage: Int,
        rawMode: String?,
        rawCategory: String?,
        currentPage: Int,
        currentMode: String,
        currentCategory: String?
    ): Boolean {
        if (rawPage != currentPage) return true
        if (normalizeBoardMode(rawMode) != currentMode) return true
        val trimmedCategory = rawCategory?.trim()
        if (trimmedCategory.isNullOrEmpty()) {
            return rawCategory != null && currentCategory == null
        }
        if (trimmedCategory.startsWith(":")) {
            return currentCategory == null
        }
        return currentCategory != trimmedCategory
    }

    private fun buildBoardCanonicalRedirect(gid: String, page: Int, mode: String, category: String?): String {
        val query = mutableListOf("page=$page")
        if (mode != "all") {
            query += "mode=$mode"
        }
        if (!category.isNullOrBlank()) {
            query += "category=" + URLEncoder.encode(category, StandardCharsets.UTF_8)
        }
        return "redirect:/board/$gid?" + query.joinToString("&")
    }

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
