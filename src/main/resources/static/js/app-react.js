(() => {
  const h = React.createElement;
  const { useEffect, useRef, useState } = React;

  const api = async (url, options = {}) => {
    const headers = options.body instanceof FormData
      ? { ...(options.headers || {}) }
      : { "Content-Type": "application/json", ...(options.headers || {}) };
    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include",
      ...options
    });
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(payload?.message || `Request failed (${response.status})`);
    }
    return payload;
  };

  const formatDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  };

  const getCurrentPageFromLocation = () => {
    const params = new URLSearchParams(window.location.search);
    const raw = Number(params.get("page") || "1");
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  };

  const MAX_IMAGE_UPLOAD_BYTES = 50 * 1024 * 1024;

  const authorLabel = (item) => {
    if (!item) return "익명";
    if (item.writer_uid) return item.name || item.writer_uid;
    return item.name || "익명";
  };

  function matchRoute(pathname) {
    if (pathname === "/") return { name: "home", params: {} };
    if (pathname === "/signin") return { name: "login", params: {} };
    if (pathname === "/nid") return { name: "signup", params: {} };
    if (pathname === "/alarms") return { name: "alarms", params: {} };
    if (pathname === "/profile") return { name: "profile", params: {} };
    let match = pathname.match(/^\/profile\/([^/]+)$/);
    if (match) return { name: "profile", params: { uid: decodeURIComponent(match[1]) } };
    if (pathname === "/boards" || pathname === "/board_main") return { name: "boards", params: {} };
    match = pathname.match(/^\/board\/([^/]+)\/write$/);
    if (match) return { name: "write", params: { gid: decodeURIComponent(match[1]) } };
    match = pathname.match(/^\/board\/([^/]+)\/manage$/);
    if (match) return { name: "boardManage", params: { gid: decodeURIComponent(match[1]) } };
    match = pathname.match(/^\/board\/([^/]+)\/settings$/);
    if (match) return { name: "boardManage", params: { gid: decodeURIComponent(match[1]) } };
    match = pathname.match(/^\/board\/([^/]+)$/);
    if (match) return { name: "board", params: { gid: decodeURIComponent(match[1]) } };
    return { name: "notFound", params: {} };
  }

  function navigate(path, replace = false) {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    window.dispatchEvent(new Event("app:navigate"));
  }

  function Link({ href, className, children, reload = false }) {
    return h("a", {
      href,
      className,
      onClick(event) {
        if (reload || !href.startsWith("/")) return;
        event.preventDefault();
        navigate(href);
      }
    }, children);
  }

  function Feedback({ feedback }) {
    if (!feedback) return null;
    return h("div", { className: feedback.type === "error" ? "error-box" : "success-box" }, feedback.message);
  }

  function Topbar({ session, onLogout, alarmCount = 0 }) {
    return h("header", { className: "topbar" },
      h("div", { className: "frame" },
        h("div", { className: "topbar-inner" },
          h(Link, { href: "/", className: "brand" },
            h("span", { className: "brand-mark" }),
            h("span", null, "irisen web")
          ),
          h("div", { className: "nav-actions" },
            h(Link, { href: "/", className: "btn btn-ghost" }, "홈"),
            h(Link, { href: "/boards", className: "btn btn-ghost" }, "보드"),
            session?.loggedIn
              ? [
                  h(Link, { href: "/profile", className: "btn btn-ghost", key: "profile" }, "프로필"),
                  h(Link, { href: "/alarms", className: "btn btn-ghost", key: "alarms" }, alarmCount > 0 ? `알림 ${alarmCount}` : "알림"),
                  h("span", { className: "chip", key: "nick" }, session.nick || session.uid),
                  h("button", { type: "button", className: "btn btn-secondary", key: "logout", onClick: onLogout }, "로그아웃")
                ]
              : [
                  h(Link, { href: "/signin", className: "btn btn-ghost", key: "login" }, "로그인"),
                  h(Link, { href: "/nid", className: "btn btn-primary", key: "signup" }, "회원가입")
                ]
          )
        )
      )
    );
  }

  function SectionHead({ eyebrow, title, action }) {
    return h("div", { className: "section-head" },
      h("div", null,
        h("span", { className: "eyebrow" }, eyebrow),
        h("h2", { className: "section-title" }, title)
      ),
      action || null
    );
  }

  function BoardSettingsPanel({ settings, feedback, onSave }) {
    const [boardNotice, setBoardNotice] = useState(settings?.board_notice || "");
    const [welcomeMessage, setWelcomeMessage] = useState(settings?.welcome_message || "");
    const [themeColor, setThemeColor] = useState(settings?.theme_color || "#ff8fab");
    const [conceptRecommendThreshold, setConceptRecommendThreshold] = useState(String(settings?.concept_recommend_threshold || 10));
    const [allowGuestPost, setAllowGuestPost] = useState(settings?.allow_guest_post !== false);
    const [allowGuestComment, setAllowGuestComment] = useState(settings?.allow_guest_comment !== false);

    useEffect(() => {
      setBoardNotice(settings?.board_notice || "");
      setWelcomeMessage(settings?.welcome_message || "");
      setThemeColor(settings?.theme_color || "#ff8fab");
      setConceptRecommendThreshold(String(settings?.concept_recommend_threshold || 10));
      setAllowGuestPost(settings?.allow_guest_post !== false);
      setAllowGuestComment(settings?.allow_guest_comment !== false);
    }, [settings]);

    return h("article", { className: "card board-settings-card" },
      h(SectionHead, { eyebrow: "Manager", title: "Board settings" }),
      h("div", { className: "stack" },
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-notice" }, "Notice"),
          h("textarea", {
            id: "board-setting-notice",
            rows: 3,
            value: boardNotice,
            onChange: (event) => setBoardNotice(event.target.value)
          })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-welcome" }, "Welcome message"),
          h("textarea", {
            id: "board-setting-welcome",
            rows: 4,
            value: welcomeMessage,
            onChange: (event) => setWelcomeMessage(event.target.value)
          })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-color" }, "Theme color"),
          h("input", {
            id: "board-setting-color",
            type: "color",
            value: themeColor,
            onChange: (event) => setThemeColor(event.target.value || "#ff8fab")
          })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-concept-threshold" }, "Concept recommend threshold"),
          h("input", {
            id: "board-setting-concept-threshold",
            type: "number",
            min: 1,
            step: 1,
            value: conceptRecommendThreshold,
            onChange: (event) => setConceptRecommendThreshold(event.target.value)
          })
        ),
        h("label", { className: "check-row" },
          h("input", {
            type: "checkbox",
            checked: allowGuestPost,
            onChange: (event) => setAllowGuestPost(event.target.checked)
          }),
          h("span", null, "Allow guest posts")
        ),
        h("label", { className: "check-row" },
          h("input", {
            type: "checkbox",
            checked: allowGuestComment,
            onChange: (event) => setAllowGuestComment(event.target.checked)
          }),
          h("span", null, "Allow guest comments")
        ),
        h(Feedback, { feedback }),
        h("div", { className: "inline-actions" },
          h("button", {
            type: "button",
            className: "btn btn-primary",
            onClick() {
              onSave({
                boardNotice,
                welcomeMessage,
                themeColor,
                conceptRecommendThreshold,
                allowGuestPost,
                allowGuestComment
              });
            }
          }, "Save settings")
        )
      )
    );
  }

  function BoardManageView({ session, gid, board, manageData, feedback, onSaveSettings, onLogout, alarmCount }) {
    const permissions = manageData?.permissions || {};
    const settings = manageData?.settings || { gall_id: gid, theme_color: "#ff8fab", concept_recommend_threshold: 10, allow_guest_post: true, allow_guest_comment: true };
    const manager = manageData?.manager || null;
    const accentStyle = settings?.theme_color ? { borderTop: `4px solid ${settings.theme_color}` } : null;

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(SectionHead, {
              eyebrow: "Manage",
              title: `${board?.gall_name || gid} board management`,
              action: h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-secondary" }, "Back to board")
            }),
            permissions.canManage
              ? h(React.Fragment, null,
                  h(BoardSettingsPanel, {
                    settings,
                    feedback,
                    onSave: onSaveSettings
                  }),
                  h("article", { className: "card board-manage-info-card", style: accentStyle },
                    h("span", { className: "eyebrow" }, "Overview"),
                    h("div", { className: "stack compact-stack" },
                      h("div", null,
                        h("strong", null, "Board ID"),
                        h("div", { className: "muted" }, gid)
                      ),
                      h("div", null,
                        h("strong", null, "Manager"),
                        h("div", { className: "muted" }, manager?.nick || manager?.uid || board?.manager_nick || board?.manager_uid || "-")
                      ),
                      h("div", null,
                        h("strong", null, "Guest posts"),
                        h("div", { className: "muted" }, settings?.allow_guest_post !== false ? "Allowed" : "Blocked")
                      ),
                      h("div", null,
                        h("strong", null, "Guest comments"),
                        h("div", { className: "muted" }, settings?.allow_guest_comment !== false ? "Allowed" : "Blocked")
                      ),
                      h("div", null,
                        h("strong", null, "Concept threshold"),
                        h("div", { className: "muted" }, `${settings?.concept_recommend_threshold || 10} recommends`)
                      )
                    )
                  )
                )
              : h("article", { className: "card board-settings-card" },
                  h("div", { className: "error-box" }, "You do not have permission to manage this board.")
                )
          )
        )
      )
    );
  }
  function PopupDeleteControl({ session, buttonLabel, passwordLabel = "비밀번호", onDelete }) {
    return h("div", { className: "inline-actions delete-control" },
      h("button", {
        type: "button",
        className: "btn btn-secondary btn-danger",
        onClick() {
          if (!session?.loggedIn) {
            const password = window.prompt(passwordLabel);
            if (password === null) return;
            onDelete(password, () => {});
            return;
          }
          onDelete("", () => {});
        }
      }, buttonLabel)
    );
  }

  function GuestFields({ name, password, setName, setPassword, prefix }) {
    return h("div", { className: "stack" },
      h("div", { className: "field" },
        h("label", { htmlFor: `${prefix}-guest-name` }, "비회원 이름"),
        h("input", {
          id: `${prefix}-guest-name`,
          type: "text",
          value: name,
          onChange: (event) => setName(event.target.value)
        })
      ),
      h("div", { className: "field" },
        h("label", { htmlFor: `${prefix}-guest-password` }, "비밀번호"),
        h("input", {
          id: `${prefix}-guest-password`,
          type: "password",
          value: password,
          onChange: (event) => setPassword(event.target.value)
        })
      )
    );
  }

  function EditorToolbar({ onImageSelect, imageUploading }) {
    const tools = [
      { label: "굵게", command: "bold" },
      { label: "기울임", command: "italic" },
      { label: "밑줄", command: "underline" },
      { label: "제목", command: "formatBlock", value: "h2" },
      { label: "본문", command: "formatBlock", value: "p" },
      { label: "인용", command: "formatBlock", value: "blockquote" }
    ];
    return h("div", { className: "editor-toolbar" },
      tools.map((tool) =>
        h("button", {
          key: tool.label,
          type: "button",
          className: "tool-btn",
          onClick() {
            document.execCommand(tool.command, false, tool.value || null);
          }
        }, tool.label)
      ),
      h("button", {
        type: "button",
        className: "tool-btn",
        disabled: imageUploading,
        onClick() {
          onImageSelect?.();
        }
      }, imageUploading ? "Uploading..." : "Image")
    );
  }

  function HtmlEditor({ id, value, onChange, placeholder }) {
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadFeedback, setUploadFeedback] = useState(null);
    const [imageUploading, setImageUploading] = useState(false);
    useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }, [value]);

    function insertImage(url) {
      if (!editorRef.current) return;
      editorRef.current.focus();
      document.execCommand("insertHTML", false, `<p><img src="${url}" alt="" /></p>`);
      onChange(editorRef.current.innerHTML);
    }

    async function handleFileChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploadFeedback(null);
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        setUploadFeedback({ type: "error", message: "Images up to 50MB can be uploaded." });
        if (event.target) event.target.value = "";
        return;
      }
      setImageUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const result = await api("/api/upload/image", {
          method: "POST",
          body: formData
        });

        if (!result?.success || !result?.url) {
          throw new Error(result?.message || "Image upload failed.");
        }

        insertImage(result.url);
        setUploadFeedback({ type: "success", message: "Image uploaded." });
      } catch (error) {
        setUploadFeedback({ type: "error", message: error.message || "Image upload failed." });
      } finally {
        setImageUploading(false);
        if (event.target) event.target.value = "";
      }
    }

    return h("div", { className: "editor-shell" },
      h(EditorToolbar, {
        imageUploading,
        onImageSelect() {
          fileInputRef.current?.click();
        }
      }),
      h("input", {
        ref: fileInputRef,
        type: "file",
        accept: "image/*",
        hidden: true,
        onChange: handleFileChange
      }),
      h("div", {
        id,
        ref: editorRef,
        className: "html-editor",
        contentEditable: true,
        suppressContentEditableWarning: true,
        "data-placeholder": placeholder,
        onInput(event) {
          onChange(event.currentTarget.innerHTML);
        }
      }),
      h(Feedback, { feedback: uploadFeedback })
    );
  }

function HomeView({ session, boards, feed, onLogout, alarmCount }) {
    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout, alarmCount }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "hero card" },
            h("span", { className: "eyebrow" }, "Home"),
            h("h1", { className: "section-title" }, "irisen25.com"),
            h("p", { className: "hero-copy" }, "sunggall archive"),
            h(
              "div",
              { className: "inline-actions" },
              h(Link, { href: "/boards", className: "btn btn-primary" }, "보드 보기"),
              h(Link, { href: "/signin", className: "btn btn-ghost" }, "로그인")
            )
          ),
          h(
            "section",
            { className: "section-stack" },
            h(SectionHead, { eyebrow: "Feed", title: "추천 글" }),
            feed.length
              ? h(
                  "div",
                  { className: "stack" },
                  feed.map((post) =>
                    h(
                      Link,
                      {
                        href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`,
                        className: "card quick-card",
                        key: `${post.gall_id}-${post.post_no}`,
                        reload: true
                      },
                      h("div", { className: "board-title" }, post.title || "제목 없음"),
                      h("div", { className: "muted" }, `${post.gall_name || post.gall_id} · ${authorLabel(post)}`)
                    )
                  )
                )
              : h("div", { className: "empty-box" }, "추천 글이 없습니다."),
            h("div", { className: "muted" }, `전체 보드 ${boards.length}개`)
          )
        )
      )
    );
  }

function BoardsView({ session, boards, query, onQueryChange, onLogout, alarmCount }) {
    const filtered = boards.filter((board) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return String(board.gall_id || "").toLowerCase().includes(q) || String(board.gall_name || "").toLowerCase().includes(q);
    });

    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout, alarmCount }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "section-stack" },
            h(SectionHead, { eyebrow: "Boards", title: "보드 목록" }),
            h(
              "div",
              { className: "field" },
              h("label", { htmlFor: "board-search" }, "검색"),
              h("input", {
                id: "board-search",
                type: "text",
                value: query,
                onChange: (event) => onQueryChange(event.target.value)
              })
            ),
            filtered.length
              ? h(
                  "div",
                  { className: "stack" },
                  filtered.map((board) =>
                    h(
                      Link,
                      {
                        href: `/board/${encodeURIComponent(board.gall_id)}`,
                        className: "card quick-card",
                        key: board.gall_id
                      },
                      h("div", { className: "board-title" }, board.gall_name || board.gall_id),
                      h("div", { className: "muted" }, `${board.gall_id} · ${board.post_count ?? 0} posts`)
                    )
                  )
                )
              : h("div", { className: "empty-box" }, "검색 결과가 없습니다.")
          )
        )
      )
    );
  }

  function BoardView({ session, gid, board, posts, page, manageData, settingsFeedback, onSaveSettings, onPrevPage, onNextPage, onLogout, alarmCount }) {
    const settings = manageData?.settings || null;
    const permissions = manageData?.permissions || {};
    const manager = manageData?.manager || null;
    const boardInfo = manageData?.board || board || {};
    const submanagers = Array.isArray(manageData?.submanagers) ? manageData.submanagers : [];
    const boardThemeStyle = settings?.theme_color ? { "--board-accent": settings.theme_color } : null;
    const conceptThreshold = Number(settings?.concept_recommend_threshold || 10);
    const roleLabel = permissions.isManager
      ? "매니저"
      : permissions.isSubmanager
        ? "부매니저"
        : session?.loggedIn
          ? "일반 이용자"
          : "비회원";
    const policyItems = [
      `내 권한 ${roleLabel}`,
      `글쓰기 ${settings?.allow_guest_post !== false ? "허용" : "로그인 필요"}`,
      `댓글 ${settings?.allow_guest_comment !== false ? "허용" : "로그인 필요"}`,
      permissions.canManage ? "보드 관리 가능" : "보드 관리 불가"
    ];
    const staffItems = [
      manager ? `매니저 ${manager.nick || manager.uid}` : "매니저 미지정",
      ...submanagers.slice(0, 4).map((user) => `부매니저 ${user.nick || user.uid}`)
    ];
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "dc-board-shell", style: boardThemeStyle },
            h("div", { className: "dc-board-head" },
              h("div", { className: "dc-board-title-row" },
                h("h1", { className: "dc-board-title" }, boardInfo?.gall_name || gid),
                h("span", { className: "dc-board-id" }, gid)
              ),
              h("div", { className: "dc-board-head-links" },
                permissions.canManage ? h(Link, { href: `/board/${encodeURIComponent(gid)}/manage`, className: "dc-head-link" }, "?ㅼ젙") : null,
                h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "dc-head-link dc-head-link-strong" }, "湲?곌린")
              )
            ),
            h("div", { className: "dc-board-summary" },
              h("div", { className: "dc-board-summary-main" },
                h("div", { className: "dc-board-badge" }, String(boardInfo?.gall_type || "board").toUpperCase()),
                h("div", { className: "dc-board-summary-copy" },
                  h("div", { className: "dc-board-summary-lines" },
                    settings?.welcome_message ? h("p", null, settings.welcome_message) : h("p", null, `${boardInfo?.gall_name || gid} 게시판입니다.`),
                    settings?.board_notice ? h("p", { className: "dc-board-notice-line" }, settings.board_notice) : null
                  ),
                  h("div", { className: "dc-board-staff" },
                    h("strong", null, "운영진"),
                    h("div", { className: "dc-board-staff-list" }, staffItems.length ? staffItems.join(" · ") : "운영진 정보 없음")
                  )
                )
              ),
              h("aside", { className: "dc-board-policy" },
                h("strong", { className: "dc-side-heading" }, "보드 권한"),
                h("ul", { className: "dc-policy-list" },
                  policyItems.map((item) => h("li", { key: item }, item))
                )
              )
            ),
            h("div", { className: "dc-board-tabs" },
              h("button", { type: "button", className: "dc-tab is-active" }, "전체글"),
              h("button", { type: "button", className: "dc-tab" }, "?쇰컲湲"),
              h("button", { type: "button", className: "dc-tab" }, "怨듭?"),
              h("div", { className: "dc-board-actions" },
                h("span", { className: "dc-page-chip" }, `${page} ?섏씠吏`),
                h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "btn btn-primary btn-compact" }, "湲?곌린")
              )
            ),
            h("div", { className: "dc-post-table-wrap" },
              h("div", { className: "dc-post-table-head" },
                h("span", null, "번호"),
                h("span", null, "말머리"),
                h("span", null, "제목"),
                h("span", null, "글쓴이"),
                h("span", null, "작성일"),
                h("span", null, "조회"),
                h("span", null, "추천")
              ),
              posts.length
                ? posts.map((post) =>
                    h(Link, { href: `/board/${encodeURIComponent(gid)}/${post.post_no}?page=${page}`, className: "dc-post-row", key: `${gid}-${post.post_no}`, reload: true },
                      h("span", { className: "dc-post-no" }, post.post_no ?? "-"),
                      h("span", { className: "dc-post-kind" }, post.notice ? "공지" : Number(post.recommend_count || 0) >= conceptThreshold ? "개념글" : "일반"),
                      h("span", { className: "dc-post-subject" },
                        h("strong", null, post.title || "제목 없음"),
                        Number(post.comment_count || 0) > 0 ? h("em", null, `[${post.comment_count}]`) : null
                      ),
                      h("span", { className: "dc-post-author" }, authorLabel(post)),
                      h("span", { className: "dc-post-date" }, formatDate(post.writed_at || post.created_at)),
                      h("span", { className: "dc-post-view" }, post.view_count ?? 0),
                      h("span", { className: "dc-post-rec" }, post.recommend_count ?? 0)
                    )
                  )
                : h("div", { className: "empty-box dc-post-empty" }, "게시글이 없습니다.")
            ),
            h("div", { className: "dc-pagination" },
              h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: onPrevPage }, "?댁쟾"),
              h("span", { className: "chip" }, `page ${page}`),
              h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: onNextPage }, "?ㅼ쓬")
            ),
            settingsFeedback ? h("div", { className: "board-settings-feedback" }, h(Feedback, { feedback: settingsFeedback })) : null
          )
        )
      )
    );
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("div", { className: "board-layout" },
            h("section", { className: "section-stack" },
              h(SectionHead, {
                eyebrow: "Board",
                title: board?.gall_name || gid,
                action: h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "btn btn-primary" }, "湲?곌린")
              }),
              settings?.welcome_message
                ? h("article", { className: "card board-setting-preview", style: accentStyle },
                    h("div", { className: "muted" }, "Welcome"),
                    h("div", null, settings.welcome_message)
                  )
                : null,
              settings?.board_notice
                ? h("article", { className: "card board-setting-preview", style: accentStyle },
                    h("div", { className: "muted" }, "Notice"),
                    h("div", null, settings.board_notice)
                  )
                : null,
              permissions.canManage
                ? h(Link, { href: `/board/${encodeURIComponent(gid)}/manage`, className: "card quick-card board-setting-link" },
                    h("div", { className: "board-title" }, "Board manage"),
                    h("div", { className: "muted" }, "Open the management page for notice, welcome message, theme color, and guest permissions")
                  )
                : null,
              posts.length
                ? h("div", { className: "stack" },
                    posts.map((post) =>
                      h(Link, { href: `/board/${encodeURIComponent(gid)}/${post.post_no}?page=${page}`, className: "card quick-card", key: `${gid}-${post.post_no}`, reload: true },
                        h("div", { className: "board-title" }, post.title || "제목 없음"),
                        h("div", { className: "muted" }, `#${post.post_no} 쨌 ${authorLabel(post)} 쨌 議고쉶??${post.view_count} 쨌${formatDate(post.writed_at || post.created_at)}`)
                      )
                    )
                  )
                : h("div", { className: "empty-box" }, "寃뚯떆湲???놁뒿?덈떎."),
              h("div", { className: "inline-actions" },
                h("button", { type: "button", className: "btn btn-ghost", onClick: onPrevPage }, "?댁쟾"),
                h("span", { className: "chip" }, `page ${page}`),
                h("button", { type: "button", className: "btn btn-ghost", onClick: onNextPage }, "?ㅼ쓬")
              )
            ),
            h("aside", { className: "board-sideboard" },
              h("article", { className: "card board-cover-card", style: accentStyle },
                h("img", { className: "board-cover-image", src: coverImageUrl, alt: `${board?.gall_name || gid} cover` }),
                h("div", { className: "board-cover-body" },
                  h("span", { className: "eyebrow" }, "Sideboard"),
                  h("h3", { className: "board-title", style: { margin: 0 } }, board?.gall_name || gid),
                  h("div", { className: "muted" }, `매니저 ${manager?.nick || manager?.uid || board?.manager_nick || board?.manager_uid || "미지정"}`)
                )
              )
            )
          )
        )
      )
    );
  }

  function PostVotePanel({ post, voteState, voteFeedback, onVote }) {
    const canVote = voteState?.canVote !== false;
    const todayVote = voteState?.voteType === "up" ? "Recommended today" : voteState?.voteType === "down" ? "Downvoted today" : "No vote yet";
    return h("div", { className: "post-vote-panel" },
      h("div", { className: "post-vote-summary" },
        h("span", { className: "chip" }, `Recommend ${post?.recommend_count ?? 0}`),
        h("span", { className: "chip" }, `Downvote ${post?.unrecommend_count ?? 0}`)
      ),
      h("div", { className: "post-vote-actions" },
        h("button", {
          type: "button",
          className: "btn btn-primary btn-compact",
          disabled: !canVote,
          onClick() {
            onVote({ gid: post.gall_id, postNo: post.post_no, voteType: "up" });
          }
        }, "Recommend"),
        h("button", {
          type: "button",
          className: "btn btn-secondary btn-compact",
          disabled: !canVote,
          onClick() {
            onVote({ gid: post.gall_id, postNo: post.post_no, voteType: "down" });
          }
        }, "Downvote")
      ),
      h("div", { className: "muted" }, canVote ? "One vote per post per day for each agent." : todayVote),
      h(Feedback, { feedback: voteFeedback })
    );
  }

  function PostView({ session, gid, post, comments, feedback, deleteFeedback, voteFeedback, voteState, onSubmitComment, onDeletePost, onDeleteComment, onVote, onLogout, alarmCount }) {
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    const isAdmin = session?.memberDivision === "1" || session?.memberDivision === 1 || session?.memberDivision === "admin";

    function isOwnedBySession(item) {
      if (!session?.loggedIn || !session?.uid) return false;
      if (!item?.writer_uid) return false;
      return String(item.writer_uid).trim() === String(session.uid).trim();
    }

    function canRenderDelete(item) {
      if (!item) return false;
      if (!session?.loggedIn) return !item.writer_uid;
      return isOwnedBySession(item) || isAdmin;
    }

    if (!post) {
      return h(React.Fragment, null,
        h(Topbar, { session, onLogout, alarmCount }),
        h("main", { className: "shell" }, h("div", { className: "frame" }, h("div", { className: "error-box" }, "Post not found.")))
      );
    }

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("article", { className: "card post-card" },
            h("div", { className: "post-card-main" },
              h("div", { className: "post-meta-bar" },
                h("span", { className: "post-board-name" }, post.gall_name || gid)
              ),
              h("div", { className: "post-title-block" },
                h("h1", { className: "post-heading" }, post.title || "Untitled"),
                h("div", { className: "post-info-row" },
                  h("span", null, authorLabel(post)),
                  h("span", { className: "post-info-sep" }, "|"),
                  h("span", null, formatDate(post.writed_at || post.created_at)),
                  h("span", { className: "post-info-sep" }, "|"),
                  h("span", null, `議고쉶 ${post.view_count ?? 0}`),
                  h("span", { className: "post-info-sep" }, "|"),
                  h("span", null, `異붿쿇 ${post.recommend_count ?? 0}`)
                )
              ),
              h("section", { className: "post-content-panel" },
                h("div", { className: "post-content-label" }, "Content"),
                h("div", { className: "preview post-content-fill", dangerouslySetInnerHTML: { __html: post.content || "" } })
              )
            ),
            h("div", { className: "post-card-footer" },
              h(PostVotePanel, { post, voteState, voteFeedback, onVote }),
              canRenderDelete(post)
                ? h(PopupDeleteControl, {
                    session,
                    buttonLabel: "Delete post",
                    onDelete(password, reset) {
                      onDeletePost({
                        gid,
                        postNo: post.post_no,
                        password
                      }, reset);
                    }
                  })
                : null,
              h(Feedback, { feedback: deleteFeedback })
            )
          ),
          h("section", { className: "section-stack" },
            h(SectionHead, { eyebrow: "Comments", title: "Comments" }),
            comments.length
              ? h("div", { className: "stack" },
                  comments.map((comment) =>
                    h("article", { className: "card", key: comment.id || comment.comment_id || `${comment.created_at}-${comment.name}` },
                      h("div", { className: "muted" }, `${authorLabel(comment)} - ${formatDate(comment.writed_at || comment.created_at)}`),
                      h("div", { className: "preview", dangerouslySetInnerHTML: { __html: comment.content || "" } }),
                      canRenderDelete(comment)
                        ? h(PopupDeleteControl, {
                            session,
                            buttonLabel: "Delete comment",
                            onDelete(password, reset) {
                              onDeleteComment({
                                commentId: comment.id || comment.comment_id,
                                password
                              }, reset);
                            }
                          })
                        : null
                    )
                  )
                )
              : h("div", { className: "empty-box" }, "No comments yet."),
            h("article", { className: "card" },
              h("div", { className: "field" },
                h("label", { htmlFor: "comment-content" }, "Comment"),
                h("textarea", { id: "comment-content", rows: 5, value: content, onChange: (event) => setContent(event.target.value) })
              ),
              session?.loggedIn ? null : h(GuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "comment" }),
              h(Feedback, { feedback }),
              h("div", { className: "inline-actions" },
                h("button", {
                  type: "button",
                  className: "btn btn-primary",
                  onClick() {
                    onSubmitComment({
                      gid,
                      postNo: post.post_no,
                      content,
                      name: guestName.trim(),
                      password: guestPassword
                    }, () => {
                      setContent("");
                      setGuestName("");
                      setGuestPassword("");
                    });
                  }
                }, "Post comment")
              )
            )
          )
        )
      )
    );
  }

  function WriteView({ session, gid, feedback, onSubmitPost, onLogout, alarmCount }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "write-grid" },
            h("article", { className: "card" },
              h(SectionHead, { eyebrow: "Write", title: `${gid} 湲?곌린` }),
              h("div", { className: "field" },
                h("label", { htmlFor: "write-title" }, "제목"),
                h("input", { id: "write-title", type: "text", value: title, onChange: (event) => setTitle(event.target.value) })
              ),
              h("div", { className: "field" },
                h("label", { htmlFor: "write-content" }, "본문"),
                h(HtmlEditor, { id: "write-content", value: content, onChange: setContent, placeholder: "글 내용을 입력해주세요." })
              ),
              session?.loggedIn ? null : h(GuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "write" }),
              h(Feedback, { feedback }),
              h("div", { className: "inline-actions" },
                h("button", {
                  type: "button",
                  className: "btn btn-primary",
                  onClick() {
                    onSubmitPost({
                      gid,
                      title: title.trim(),
                      content,
                      name: guestName.trim(),
                      password: guestPassword
                    }, () => {
                      setTitle("");
                      setContent("");
                      setGuestName("");
                      setGuestPassword("");
                    });
                  }
                }, "작성 완료"),
                h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-ghost" }, "취소")
              )
            ),
            h("aside", { className: "preview-card card" },
              h("span", { className: "eyebrow" }, "Preview"),
              h("h3", { className: "section-title", style: { fontSize: "1.8rem" } }, "미리보기"),
              h("div", { className: "preview", dangerouslySetInnerHTML: { __html: content || "<p>아직 작성된 내용이 없습니다.</p>" } })
            )
          )
        )
      )
    );
  }

  function AuthView({ mode, feedback, onSubmitAuth, session, onLogout, alarmCount }) {
    const [uid, setUid] = useState("");
    const [nick, setNick] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [code, setCode] = useState("");
    const [verificationSent, setVerificationSent] = useState(false);
    const [signupStep, setSignupStep] = useState(0);
    const [stepFeedback, setStepFeedback] = useState(null);
    const isLogin = mode === "login";

    const signupSteps = [
      {
        eyebrow: "Step 1",
        title: "아이디 입력",
        field: "uid",
        value: uid,
        canNext: uid.trim().length > 0,
        render: h("div", { className: "field" },
          h("label", { htmlFor: "auth-uid" }, "아이디"),
          h("input", { id: "auth-uid", type: "text", value: uid, onChange: (event) => setUid(event.target.value), placeholder: "4-20자 영문, 숫자, 밑줄" })
        )
      },
      {
        eyebrow: "Step 2",
        title: "닉네임 입력",
        field: "nick",
        value: nick,
        canNext: nick.trim().length > 0,
        render: h("div", { className: "field" },
          h("label", { htmlFor: "auth-nick" }, "닉네임"),
          h("input", { id: "auth-nick", type: "text", value: nick, onChange: (event) => setNick(event.target.value), placeholder: "2-20자 문자/숫자" })
        )
      },
      {
        eyebrow: "Step 3",
        title: "이메일 입력",
        field: "email",
        value: email,
        canNext: email.trim().length > 0,
        render: h("div", { className: "field" },
          h("label", { htmlFor: "auth-email" }, "이메일"),
          h("input", { id: "auth-email", type: "email", value: email, onChange: (event) => setEmail(event.target.value), placeholder: "인증 메일을 받을 주소" })
        )
      },
      {
        eyebrow: "Step 4",
        title: "비밀번호 입력",
        field: "password",
        value: password,
        canNext: password.length >= 8,
        render: h("div", { className: "stack" },
          h("div", { className: "field" },
            h("label", { htmlFor: "auth-pw" }, "비밀번호"),
            h("input", { id: "auth-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value), placeholder: "8자 이상 강한 비밀번호" })
          ),
          h("div", { className: "muted" }, "대문자, 소문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.")
        )
      },
      {
        eyebrow: "Step 5",
        title: verificationSent ? "인증 코드 입력" : "이메일 인증",
        canNext: verificationSent ? code.trim().length > 0 : true,
        render: verificationSent
          ? h("div", { className: "field" },
              h("label", { htmlFor: "auth-code" }, "인증 코드"),
              h("input", { id: "auth-code", type: "text", value: code, onChange: (event) => setCode(event.target.value), placeholder: "메일로 받은 6자리 코드" })
            )
          : h("div", { className: "muted" }, `${email || "입력한 이메일"} 주소로 인증 메일을 보냅니다.`)
      }
    ];

    const currentSignupStep = signupSteps[Math.min(signupStep, signupSteps.length - 1)];

    async function validateCurrentStep() {
      if (!currentSignupStep.field) return true;
      const result = await api(`/api/signup/validate?field=${encodeURIComponent(currentSignupStep.field)}&value=${encodeURIComponent(currentSignupStep.value || "")}`);
      if (!result?.success || !result?.data?.valid) {
        setStepFeedback({ type: "error", message: result?.data?.message || "입력값을 확인해 주세요." });
        return false;
      }
      setStepFeedback({ type: "success", message: "사용 가능한 값입니다." });
      return true;
    }

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "auth-wrap" },
            h("article", { className: "auth-card card" },
              h("span", { className: "eyebrow" }, isLogin ? "Access" : currentSignupStep.eyebrow),
              h("h1", { className: "section-title" }, isLogin ? "로그인" : currentSignupStep.title),
              h("div", { className: "stack", style: { marginTop: "16px" } },
                isLogin
                  ? h("div", { className: "stack" },
                      h("div", { className: "field" },
                        h("label", { htmlFor: "auth-login-id" }, "아이디 또는 이메일"),
                        h("input", { id: "auth-login-id", type: "text", value: uid, onChange: (event) => setUid(event.target.value) })
                      ),
                      h("div", { className: "field" },
                        h("label", { htmlFor: "auth-login-pw" }, "비밀번호"),
                        h("input", { id: "auth-login-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value) })
                      )
                    )
                  : h("div", { className: "stack" },
                      h("div", { className: "chip" }, `${signupStep + 1} / ${signupSteps.length}`),
                      currentSignupStep.render,
                      verificationSent && signupStep === signupSteps.length - 1
                        ? h("div", { className: "success-box" }, "인증 메일을 보냈습니다. 코드를 입력해 가입을 완료해 주세요.")
                        : null
                    ),
                h(Feedback, { feedback }),
                isLogin ? null : h(Feedback, { feedback: stepFeedback }),
                h("div", { className: "inline-actions" },
                  isLogin
                    ? h("button", { type: "button", className: "btn btn-primary", onClick: () => onSubmitAuth({ mode, uid, password }) }, "로그인")
                    : signupStep < signupSteps.length - 1
                      ? [
                          signupStep > 0 ? h("button", { type: "button", className: "btn btn-ghost", key: "prev", onClick: () => setSignupStep((v) => Math.max(0, v - 1)) }, "이전") : null,
                          h("button", {
                            type: "button",
                            className: "btn btn-primary",
                            key: "next",
                            disabled: !currentSignupStep.canNext,
                            async onClick() {
                              const valid = await validateCurrentStep();
                              if (!valid) return;
                              setSignupStep((v) => Math.min(signupSteps.length - 1, v + 1));
                            }
                          }, "다음")
                        ]
                      : [
                          h("button", { type: "button", className: "btn btn-ghost", key: "prev", onClick: () => setSignupStep((v) => Math.max(0, v - 1)) }, "이전"),
                          h("button", {
                            type: "button",
                            className: "btn btn-secondary",
                            key: "send",
                            onClick: () => onSubmitAuth({ mode, uid, nick, email, password, resendOnly: true, setVerificationSent })
                          }, verificationSent ? "인증 메일 다시 보내기" : "인증 메일 보내기"),
                          verificationSent
                            ? h("button", {
                                type: "button",
                                className: "btn btn-primary",
                                key: "verify",
                                disabled: !currentSignupStep.canNext,
                                onClick: () => onSubmitAuth({ mode, uid, nick, email, password, code, verificationSent, setVerificationSent })
                              }, "인증 완료하고 가입")
                            : null
                        ],
                  h(Link, { href: isLogin ? "/nid" : "/signin", className: "btn btn-secondary" }, isLogin ? "회원가입" : "로그인으로")
                )
              )
            )
          )
        )
      )
    );
  }

  function AlarmsView({ session, alarms, feedback, onAcceptAlarm, onRejectAlarm, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(SectionHead, { eyebrow: "Inbox", title: "?뚮┝" }),
            !session?.loggedIn
              ? h("article", { className: "card auth-card" }, h("p", { className: "muted" }, "로그인 후 알림을 확인할 수 있습니다."))
              : h("div", { className: "stack" },
                  h(Feedback, { feedback }),
                  alarms.length
                    ? alarms.map((alarm) =>
                        h("article", { className: "card", key: alarm.alarm_id },
                          h("div", { className: "section-head" },
                            h("div", null,
                              h("span", { className: "eyebrow" }, alarm.alarm_type || "alarm"),
                              h("h2", { className: "section-title", style: { fontSize: "1.4rem" } }, alarm.title || "?뚮┝")
                            ),
                            h("span", { className: "chip" }, formatDate(alarm.created_at))
                          ),
                          h("p", { className: "muted" }, alarm.content || ""),
                          alarm.actionable
                            ? h("div", { className: "inline-actions" },
                                h("button", { type: "button", className: "btn btn-primary", onClick: () => onAcceptAlarm(alarm.alarm_id) }, "?섎씫"),
                                h("button", { type: "button", className: "btn btn-ghost", onClick: () => onRejectAlarm(alarm.alarm_id) }, "嫄곗젅")
                              )
                            : null
                        )
                      )
                    : h("div", { className: "empty-box" }, "받은 알림이 없습니다.")
                )
          )
        )
      )
    );
  }

  function ProfileView({ session, profileData, feedback, onSaveProfile, onLogout, alarmCount }) {
    const [statusMessage, setStatusMessage] = useState(profileData?.statusMessage || "");
    const [bio, setBio] = useState(profileData?.bio || "");
    const [accentColor, setAccentColor] = useState(profileData?.accentColor || "#ff8fab");
    const [showPosts, setShowPosts] = useState(profileData?.showPosts !== false);
    const [showComments, setShowComments] = useState(profileData?.showComments !== false);

    useEffect(() => {
      setStatusMessage(profileData?.statusMessage || "");
      setBio(profileData?.bio || "");
      setAccentColor(profileData?.accentColor || "#ff8fab");
      setShowPosts(profileData?.showPosts !== false);
      setShowComments(profileData?.showComments !== false);
    }, [profileData]);

    if (!profileData) {
      return h(React.Fragment, null,
        h(Topbar, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
          h("div", { className: "frame" },
            h("section", { className: "section-stack" },
              h("div", { className: "error-box" }, "프로필을 불러오지 못했습니다.")
            )
          )
        )
      );
    }

    const stats = profileData.stats || {};
    const accentStyle = profileData.accentColor ? { borderTop: `4px solid ${profileData.accentColor}` } : null;

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h("article", { className: "card profile-hero-card", style: accentStyle },
              h("div", { className: "profile-hero-head" },
                h("div", { className: "stack", style: { gap: "8px" } },
                  h("span", { className: "eyebrow" }, profileData.ownerView ? "My Profile" : "Profile"),
                  h("h1", { className: "section-title", style: { margin: 0 } }, profileData.nick || profileData.uid),
                  h("div", { className: "muted" }, `@${profileData.uid}`),
                  profileData.statusMessage ? h("div", { className: "profile-status-text" }, profileData.statusMessage) : null
                ),
                h("div", { className: "profile-stat-grid" },
                  h("div", { className: "profile-stat-card" }, h("strong", null, stats.postCount ?? 0), h("span", null, "湲")),
                  h("div", { className: "profile-stat-card" }, h("strong", null, stats.commentCount ?? 0), h("span", null, "댓글")),
                  h("div", { className: "profile-stat-card" }, h("strong", null, stats.managedBoardCount ?? 0), h("span", null, "관리 보드")),
                  h("div", { className: "profile-stat-card" }, h("strong", null, stats.submanagerBoardCount ?? 0), h("span", null, "부관리 보드"))
                )
              ),
              profileData.bio ? h("div", { className: "profile-bio-box" }, profileData.bio) : null,
              h("div", { className: "inline-actions" },
                h("span", { className: "chip" }, `沅뚰븳 ${profileData.memberDivision || "user"}`),
                profileData.email ? h("span", { className: "chip" }, profileData.email) : null
              )
            ),
            profileData.canEdit
              ? h("article", { className: "card profile-settings-card" },
                  h(SectionHead, { eyebrow: "Customize", title: "?꾨줈???ㅼ젙" }),
                  h("div", { className: "stack" },
                    h("div", { className: "field" },
                      h("label", { htmlFor: "profile-status-message" }, "?곹깭 硫붿떆吏"),
                      h("input", {
                        id: "profile-status-message",
                        type: "text",
                        maxLength: 160,
                        value: statusMessage,
                        onChange: (event) => setStatusMessage(event.target.value)
                      })
                    ),
                    h("div", { className: "field" },
                      h("label", { htmlFor: "profile-bio" }, "?뚭컻"),
                      h("textarea", {
                        id: "profile-bio",
                        rows: 5,
                        value: bio,
                        onChange: (event) => setBio(event.target.value)
                      })
                    ),
                    h("div", { className: "field profile-color-field" },
                      h("label", { htmlFor: "profile-color" }, "?ъ씤???됱긽"),
                      h("input", {
                        id: "profile-color",
                        type: "color",
                        value: accentColor,
                        onChange: (event) => setAccentColor(event.target.value || "#ff8fab")
                      })
                    ),
                    h("label", { className: "check-row" },
                      h("input", {
                        type: "checkbox",
                        checked: showPosts,
                        onChange: (event) => setShowPosts(event.target.checked)
                      }),
                      h("span", null, "작성 글 공개")
                    ),
                    h("label", { className: "check-row" },
                      h("input", {
                        type: "checkbox",
                        checked: showComments,
                        onChange: (event) => setShowComments(event.target.checked)
                      }),
                      h("span", null, "작성 댓글 공개")
                    ),
                    h(Feedback, { feedback }),
                    h("div", { className: "inline-actions" },
                      h("button", {
                        type: "button",
                        className: "btn btn-primary",
                        onClick() {
                          onSaveProfile({
                            statusMessage,
                            bio,
                            accentColor,
                            showPosts,
                            showComments
                          });
                        }
                      }, "프로필 저장")
                    )
                  )
                )
              : null,
            h("article", { className: "card profile-list-card" },
              h(SectionHead, { eyebrow: "Posts", title: "작성 글" }),
              profileData.postsHidden
                ? h("div", { className: "empty-box" }, "이 사용자는 작성 글을 비공개로 설정했습니다.")
                : profileData.posts?.length
                  ? h("div", { className: "compact-stack" },
                      profileData.posts.map((post) =>
                        h(Link, { href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, reload: true, className: "mini-link-card", key: `${post.gall_id}-${post.post_no}` },
                          h("div", { className: "board-title", style: { fontSize: "1rem" } }, post.title || "제목 없음"),
                          h("div", { className: "muted" }, `${post.gall_name || post.gall_id} · ${formatDate(post.writed_at)} · 조회 ${post.view_count ?? 0} · 댓글 ${post.comment_count ?? 0}`)
                        )
                      )
                    )
                  : h("div", { className: "empty-box" }, "작성한 글이 없습니다.")
            ),
            h("article", { className: "card profile-list-card" },
              h(SectionHead, { eyebrow: "Comments", title: "작성 댓글" }),
              profileData.commentsHidden
                ? h("div", { className: "empty-box" }, "이 사용자는 작성 댓글을 비공개로 설정했습니다.")
                : profileData.comments?.length
                  ? h("div", { className: "compact-stack" },
                      profileData.comments.map((comment) =>
                        h(Link, { href: `/board/${encodeURIComponent(comment.gall_id)}/${comment.post_no}`, reload: true, className: "mini-link-card", key: `${comment.id}` },
                          h("div", { className: "board-title", style: { fontSize: "1rem" } }, comment.post_title || "?먮Ц 蹂닿린"),
                          h("div", { className: "muted" }, `${comment.gall_name || comment.gall_id} 쨌 ${formatDate(comment.writed_at)}`),
                          h("div", { className: "muted profile-comment-preview" }, comment.content || "")
                        )
                      )
                    )
                  : h("div", { className: "empty-box" }, "작성한 댓글이 없습니다.")
            )
          )
        )
      )
    );
  }

  function NotFoundView({ session, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "auth-wrap" },
            h("article", { className: "auth-card card" },
              h("span", { className: "eyebrow" }, "404"),
              h("h1", { className: "section-title" }, "페이지를 찾을 수 없습니다."),
              h(Link, { href: "/", className: "btn btn-primary" }, "홈으로")
            )
          )
        )
      )
    );
  }

  function App() {
    const [route, setRoute] = useState(matchRoute(window.location.pathname));
    const [session, setSession] = useState({ loggedIn: false });
    const [boards, setBoards] = useState([]);
    const [feed, setFeed] = useState([]);
    const [alarms, setAlarms] = useState([]);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(getCurrentPageFromLocation());
    const [boardPosts, setBoardPosts] = useState([]);
    const [boardManageData, setBoardManageData] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [postData, setPostData] = useState({ post: null, comments: [], voteState: { canVote: true, voteType: "" } });
    const [authFeedback, setAuthFeedback] = useState(null);
    const [writeFeedback, setWriteFeedback] = useState(null);
    const [commentFeedback, setCommentFeedback] = useState(null);
    const [deleteFeedback, setDeleteFeedback] = useState(null);
    const [voteFeedback, setVoteFeedback] = useState(null);
    const [alarmFeedback, setAlarmFeedback] = useState(null);
    const [settingsFeedback, setSettingsFeedback] = useState(null);
    const [profileFeedback, setProfileFeedback] = useState(null);

    const currentBoard = boards.find((board) => board.gall_id === route.params.gid) || null;
    const targetProfileUid = route.params.uid || session.uid || "";
    const alarmCount = alarms.filter((alarm) => alarm?.actionable).length;

    useEffect(() => {
      const syncRoute = () => {
        setRoute(matchRoute(window.location.pathname));
        setPage(getCurrentPageFromLocation());
      };
      window.addEventListener("popstate", syncRoute);
      window.addEventListener("app:navigate", syncRoute);
      return () => {
        window.removeEventListener("popstate", syncRoute);
        window.removeEventListener("app:navigate", syncRoute);
      };
    }, []);

    function refreshSession() {
      return api("/api/check-login").then((data) => setSession(data || { loggedIn: false })).catch(() => setSession({ loggedIn: false }));
    }

    function refreshBoards() {
      return api("/api/board/list").then((data) => setBoards(Array.isArray(data) ? data : [])).catch(() => setBoards([]));
    }

    function refreshFeed() {
      return api("/api/posts/recommend").then((data) => setFeed(Array.isArray(data) ? data : [])).catch(() => setFeed([]));
    }

    function refreshAlarms() {
      if (!session?.loggedIn) {
        setAlarms([]);
        return Promise.resolve();
      }
      return api("/api/alarms/my").then((result) => setAlarms(result?.success && Array.isArray(result.alarms) ? result.alarms : [])).catch(() => setAlarms([]));
    }

    function refreshBoardPosts(gid, nextPage) {
      return api(`/api/board/posts/${encodeURIComponent(gid)}?page=${nextPage}`).then((data) => setBoardPosts(Array.isArray(data) ? data : [])).catch(() => setBoardPosts([]));
    }

    function refreshBoardManage(gid) {
      return api(`/api/board/manage/${encodeURIComponent(gid)}`)
        .then((result) => setBoardManageData(result?.success ? result.data : null))
        .catch(() => setBoardManageData(null));
    }

    function refreshProfile(uid) {
      if (!uid) {
        setProfileData(null);
        return Promise.resolve();
      }
      const endpoint = route.params.uid
        ? `/api/profile/${encodeURIComponent(uid)}`
        : "/api/profile/me";
      return api(endpoint)
        .then((result) => setProfileData(result?.success ? result.data : null))
        .catch(() => setProfileData(null));
    }

    function refreshPostDetail(gid, postNo) {
      return api(`/api/posts/get/${encodeURIComponent(gid)}/${encodeURIComponent(postNo)}`)
        .then((result) => setPostData({
          post: result?.success ? result.post : null,
          comments: result?.success && Array.isArray(result.comments) ? result.comments : [],
          voteState: result?.success && result.voteState ? result.voteState : { canVote: true, voteType: "" }
        }))
        .catch(() => setPostData({ post: null, comments: [], voteState: { canVote: true, voteType: "" } }));
    }

    useEffect(() => {
      refreshSession();
      refreshBoards();
      refreshFeed();
    }, []);

    useEffect(() => {
      if (session?.loggedIn) refreshAlarms();
      else setAlarms([]);
    }, [session?.loggedIn]);

    useEffect(() => {
      if (route.name === "board") {
        setPage(getCurrentPageFromLocation());
      }
    }, [route.name, route.params.gid]);

    useEffect(() => {
      if (route.name === "board") refreshBoardPosts(route.params.gid, page);
      if (route.name === "board") refreshBoardManage(route.params.gid);
      if (route.name === "boardManage") refreshBoardManage(route.params.gid);
      if (route.name === "profile") refreshProfile(targetProfileUid);
      if (route.name === "alarms") refreshAlarms();
    }, [route, page, targetProfileUid]);

    function handleLogout() {
      fetch("/logout", { method: "POST", credentials: "include" }).finally(() => {
        setSession({ loggedIn: false });
        navigate("/", true);
      });
    }

    function submitAuth(payload) {
      if (payload.mode === "login") {
        if (!payload.uid?.trim() || !payload.password) {
          setAuthFeedback({ type: "error", message: "아이디와 비밀번호를 입력해주세요." });
          return;
        }
        api("/login", {
          method: "POST",
          body: JSON.stringify({ userID: payload.uid.trim(), password: payload.password })
        }).then((result) => {
          if (!result.success) {
            setAuthFeedback({ type: "error", message: result.message || "로그인에 실패했습니다." });
            return;
          }
          refreshSession().then(() => navigate("/", true));
        }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "로그인 요청 중 오류가 발생했습니다." }));
        return;
      }

      if (!payload.uid?.trim() || !payload.nick?.trim() || !payload.email?.trim() || (payload.password || "").length < 8) {
        setAuthFeedback({ type: "error", message: "媛???뺣낫瑜??ㅼ떆 ?뺤씤??二쇱꽭??" });
        return;
      }

      if (!payload.verificationSent || payload.resendOnly) {
        api("/api/signup/request", {
          method: "POST",
          body: JSON.stringify({
            userID: payload.uid.trim(),
            username: payload.nick.trim(),
            email: payload.email.trim(),
            password: payload.password
          })
        }).then((result) => {
          if (!result.success) {
            setAuthFeedback({ type: "error", message: result.message || "인증 메일 발송에 실패했습니다." });
            return;
          }
          payload.setVerificationSent?.(true);
          setAuthFeedback({ type: "success", message: result.message || "인증 메일을 보냈습니다." });
        }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "인증 메일 발송 중 오류가 발생했습니다." }));
        return;
      }

      if (!payload.code?.trim()) {
        setAuthFeedback({ type: "error", message: "인증 코드를 입력해주세요." });
        return;
      }

      api("/api/signup/verify", {
        method: "POST",
        body: JSON.stringify({
          userID: payload.uid.trim(),
          email: payload.email.trim(),
          code: payload.code.trim()
        })
      }).then((result) => {
        if (!result.success) {
          setAuthFeedback({ type: "error", message: result.message || "이메일 인증 확인에 실패했습니다." });
          return;
        }
        setAuthFeedback({ type: "success", message: result.message || "?뚯썝媛?낆씠 ?꾨즺?섏뿀?듬땲??" });
        setTimeout(() => navigate("/signin"), 500);
      }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "이메일 인증 확인 중 오류가 발생했습니다." }));
    }

    function submitPost(payload, reset) {
      api("/api/posts/write", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result.success) {
            setWriteFeedback({ type: "error", message: result.message || "글 작성에 실패했습니다." });
            return;
          }
          reset?.();
          setWriteFeedback({ type: "success", message: "湲???깅줉?덉뒿?덈떎." });
          refreshBoards();
          refreshFeed();
          navigate(`/board/${encodeURIComponent(payload.gid)}`, true);
        })
        .catch((error) => setWriteFeedback({ type: "error", message: error.message || "글 작성 중 오류가 발생했습니다." }));
    }

    function submitComment(payload, reset) {
      api("/api/posts/comment", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result.success) {
            setCommentFeedback({ type: "error", message: result.message || "댓글 등록에 실패했습니다." });
            return;
          }
          reset?.();
          setCommentFeedback({ type: "success", message: "댓글이 등록되었습니다." });
          refreshPostDetail(payload.gid, payload.postNo);
        })
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 등록 중 오류가 발생했습니다." }));
    }

    function submitDeletePost(payload, reset) {
      api("/api/posts/delete", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result?.success) {
            setDeleteFeedback({ type: "error", message: result?.message || "??젣???ㅽ뙣?덉뒿?덈떎." });
            return;
          }
          reset?.();
          setDeleteFeedback({ type: "success", message: "寃뚯떆湲????젣?섏뿀?듬땲??" });
          navigate(`/board/${encodeURIComponent(payload.gid)}`, true);
        })
        .catch((error) => setDeleteFeedback({ type: "error", message: error.message || "??젣???ㅽ뙣?덉뒿?덈떎." }));
    }

    function submitDeleteComment(payload, reset) {
      api("/api/posts/comment/delete", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result?.success) {
            setDeleteFeedback({ type: "error", message: result?.message || "댓글 삭제에 실패했습니다." });
            return;
          }
          reset?.();
          setDeleteFeedback({ type: "success", message: "댓글을 삭제했습니다." });
          refreshPostDetail(route.params.gid, route.params.postNo);
        })
        .catch((error) => setDeleteFeedback({ type: "error", message: error.message || "댓글 삭제에 실패했습니다." }));
    }

    function submitVote(payload) {
      api("/api/posts/vote", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result?.success) {
            if (result?.post || result?.voteState) {
              setPostData((current) => ({
                ...current,
                post: current.post ? { ...current.post, ...(result.post || {}) } : current.post,
                voteState: result.voteState || current.voteState
              }));
            }
            setVoteFeedback({ type: "error", message: result?.message || "Vote failed." });
            return;
          }
          setPostData((current) => ({
            ...current,
            post: current.post ? { ...current.post, ...(result.post || {}) } : current.post,
            voteState: result.voteState || current.voteState
          }));
          refreshFeed();
          setVoteFeedback({ type: "success", message: result?.message || "Vote recorded." });
        })
        .catch((error) => setVoteFeedback({ type: "error", message: error.message || "Vote failed." }));
    }

    function submitBoardSettings(payload) {
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/settings`, {
        method: "POST",
        body: JSON.stringify({
          boardNotice: payload.boardNotice,
          welcomeMessage: payload.welcomeMessage,
          themeColor: payload.themeColor,
          conceptRecommendThreshold: payload.conceptRecommendThreshold,
          allowGuestPost: payload.allowGuestPost,
          allowGuestComment: payload.allowGuestComment
        })
      }).then((result) => {
        if (!result?.success) {
          setSettingsFeedback({ type: "error", message: result?.message || "Settings save failed." });
          return;
        }
        setBoardManageData((current) => current ? { ...current, settings: result.data } : { settings: result.data, permissions: {} });
        setSettingsFeedback({ type: "success", message: "Settings saved." });
      }).catch((error) => setSettingsFeedback({ type: "error", message: error.message || "Settings save failed." }));
    }

    function submitProfileSettings(payload) {
      api("/api/profile/me/settings", {
        method: "POST",
        body: JSON.stringify({
          statusMessage: payload.statusMessage,
          bio: payload.bio,
          accentColor: payload.accentColor,
          showPosts: payload.showPosts,
          showComments: payload.showComments
        })
      }).then((result) => {
        if (!result?.success) {
          setProfileFeedback({ type: "error", message: result?.message || "?꾨줈????μ뿉 ?ㅽ뙣?덉뒿?덈떎." });
          return;
        }
        setProfileData(result.data || null);
        setProfileFeedback({ type: "success", message: "프로필을 저장했습니다." });
      }).catch((error) => setProfileFeedback({ type: "error", message: error.message || "?꾨줈????μ뿉 ?ㅽ뙣?덉뒿?덈떎." }));
    }

    function acceptAlarm(alarmId) {
      api(`/api/alarms/${encodeURIComponent(alarmId)}/accept`, { method: "POST" })
        .then((result) => {
          if (!result.success) {
            setAlarmFeedback({ type: "error", message: result.message || "?뚮┝ ?섎씫???ㅽ뙣?덉뒿?덈떎." });
            return;
          }
          setAlarmFeedback({ type: "success", message: "?뚮┝???섎씫?덉뒿?덈떎." });
          refreshAlarms();
          refreshBoards();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "?뚮┝ ?섎씫 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." }));
    }

    function rejectAlarm(alarmId) {
      api(`/api/alarms/${encodeURIComponent(alarmId)}/reject`, { method: "POST" })
        .then((result) => {
          if (!result.success) {
            setAlarmFeedback({ type: "error", message: result.message || "?뚮┝ 嫄곗젅???ㅽ뙣?덉뒿?덈떎." });
            return;
          }
          setAlarmFeedback({ type: "success", message: "?뚮┝??嫄곗젅?덉뒿?덈떎." });
          refreshAlarms();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "?뚮┝ 嫄곗젅 以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎." }));
    }

    if (route.name === "home") return h(HomeView, { session, boards, feed, onLogout: handleLogout, alarmCount });
    if (route.name === "boards") return h(BoardsView, { session, boards, query, onQueryChange: setQuery, onLogout: handleLogout, alarmCount });
    if (route.name === "board") return h(BoardView, {
      session,
      gid: route.params.gid,
      board: currentBoard,
      posts: boardPosts,
      page,
      manageData: boardManageData,
      settingsFeedback,
      onSaveSettings: submitBoardSettings,
      onPrevPage: () => navigate(`/board/${encodeURIComponent(route.params.gid)}?page=${Math.max(1, page - 1)}`),
      onNextPage: () => navigate(`/board/${encodeURIComponent(route.params.gid)}?page=${page + 1}`),
      onLogout: handleLogout,
      alarmCount
    });
    if (route.name === "boardManage") return h(BoardManageView, { session, gid: route.params.gid, board: currentBoard, manageData: boardManageData, feedback: settingsFeedback, onSaveSettings: submitBoardSettings, onLogout: handleLogout, alarmCount });
    if (route.name === "profile") return h(ProfileView, { session, profileData, feedback: profileFeedback, onSaveProfile: submitProfileSettings, onLogout: handleLogout, alarmCount });
    if (route.name === "write") return h(WriteView, { session, gid: route.params.gid, feedback: writeFeedback, onSubmitPost: submitPost, onLogout: handleLogout, alarmCount });
    if (route.name === "login") return h(AuthView, { mode: "login", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    if (route.name === "signup") return h(AuthView, { mode: "signup", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    if (route.name === "alarms") return h(AlarmsView, { session, alarms, feedback: alarmFeedback, onAcceptAlarm: acceptAlarm, onRejectAlarm: rejectAlarm, onLogout: handleLogout, alarmCount });
    return h(NotFoundView, { session, onLogout: handleLogout, alarmCount });
  }

  ReactDOM.createRoot(document.getElementById("app")).render(h(App));
})();
