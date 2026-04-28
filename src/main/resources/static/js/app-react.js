(() => {
  const h = React.createElement;
  const { useEffect, useRef, useState } = React;

  const MAX_IMAGE_UPLOAD_BYTES = 50 * 1024 * 1024;
  const isMobilePath = window.location.pathname === "/m" || window.location.pathname.startsWith("/m/");

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
      throw new Error(payload?.message || `요청에 실패했습니다. (${response.status})`);
    }
    return payload;
  };

  async function uploadImageFile(file) {
    if (!file) {
      throw new Error("업로드할 파일이 없습니다.");
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error("이미지는 최대 50MB까지 업로드할 수 있습니다.");
    }
    const formData = new FormData();
    formData.append("file", file);
    const result = await api("/api/upload/image", { method: "POST", body: formData });
    if (!result?.success || !result?.url) {
      throw new Error(result?.message || "이미지 업로드에 실패했습니다.");
    }
    return result.url;
  }

  const appHref = (href) => {
    if (!isMobilePath || !href.startsWith("/") || href.startsWith("/m")) return href;
    return href === "/" ? "/m" : `/m${href}`;
  };

  const normalizePathname = (pathname) => {
    if (pathname === "/m") return "/";
    if (pathname.startsWith("/m/")) return pathname.slice(2) || "/";
    return pathname;
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

  const authorLabel = (item) => {
    if (!item) return "익명";
    if (item.writer_uid) return item.name || item.writer_uid;
    return item.name || "익명";
  };

  const displayCategory = (item) => item?.display_category || item?.category || "일반";

  function ProfileInlineLink({ item }) {
    if (!item?.writer_uid) return null;
    return h(Link, { href: `/profile/${encodeURIComponent(item.writer_uid)}`, className: "profile-inline-link" }, "○");
  }

  const flagEnabled = (value) => {
    if (value instanceof Boolean) return value.valueOf();
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (value == null) return true;
    const text = String(value).trim().toLowerCase();
    return text === "1" || text === "true" || text === "yes" || text === "on";
  };

  const categoryOptionsFromSettings = (settings) => {
    if (Array.isArray(settings?.category_options_list)) {
      return settings.category_options_list.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(settings?.category_options || "일반")
      .split(/[\r\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  function matchRoute(pathname) {
    const path = normalizePathname(pathname);
    if (path === "/") return { name: "home", params: {} };
    if (path === "/signin") return { name: "login", params: {} };
    if (path === "/nid") return { name: "signup", params: {} };
    if (path === "/alarms") return { name: "alarms", params: {} };
    if (path === "/profile") return { name: "profile", params: {} };
    if (path === "/boards" || path === "/board_main") return { name: "boards", params: {} };
    let match = path.match(/^\/profile\/([^/]+)$/);
    if (match) return { name: "profile", params: { uid: decodeURIComponent(match[1]) } };
    match = path.match(/^\/board\/([^/]+)\/write$/);
    if (match) return { name: "write", params: { gid: decodeURIComponent(match[1]) } };
    match = path.match(/^\/board\/([^/]+)\/(?:manage|settings)$/);
    if (match) return { name: "boardManage", params: { gid: decodeURIComponent(match[1]) } };
    match = path.match(/^\/board\/([^/]+)\/([^/]+)$/);
    if (match) return { name: "post", params: { gid: decodeURIComponent(match[1]), postNo: decodeURIComponent(match[2]) } };
    match = path.match(/^\/board\/([^/]+)$/);
    if (match) return { name: "board", params: { gid: decodeURIComponent(match[1]) } };
    return { name: "notFound", params: {} };
  }

  function navigate(path, replace = false) {
    const target = appHref(path);
    if (replace) window.history.replaceState({}, "", target);
    else window.history.pushState({}, "", target);
    window.dispatchEvent(new Event("app:navigate"));
  }

  function Link({ href, className, children, reload = false }) {
    const target = appHref(href);
    return h("a", {
      href: target,
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

  function PermissionNotice({ label, detail }) {
    return null;
  }

  function PermissionMatrix({ title = "행동별 필요 권한", items = [] }) {
    return null;
  }

  function ActionPermission({ children }) {
    return null;
  }

  function Topbar({ session, onLogout, alarmCount = 0 }) {
    return h("header", { className: "topbar" },
      h("div", { className: "frame" },
        h("div", { className: "topbar-inner" },
          h(Link, { href: "/", className: "brand" }, h("span", { className: "brand-mark" }), h("span", null, "irisen web")),
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
      h("div", null, h("span", { className: "eyebrow" }, eyebrow), h("h2", { className: "section-title" }, title)),
      action || null
    );
  }

  function GuestFields({ name, password, setName, setPassword, prefix }) {
    return h("div", { className: "stack" },
      h("div", { className: "field" },
        h("label", { htmlFor: `${prefix}-guest-name` }, "비회원 이름"),
        h("input", { id: `${prefix}-guest-name`, type: "text", value: name, onChange: (event) => setName(event.target.value) })
      ),
      h("div", { className: "field" },
        h("label", { htmlFor: `${prefix}-guest-password` }, "비밀번호"),
        h("input", { id: `${prefix}-guest-password`, type: "password", value: password, onChange: (event) => setPassword(event.target.value) })
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
      tools.map((tool) => h("button", {
        key: tool.label,
        type: "button",
        className: "tool-btn",
        onClick() {
          document.execCommand(tool.command, false, tool.value || null);
        }
      }, tool.label)),
      h("button", {
        type: "button",
        className: "tool-btn",
        disabled: imageUploading,
        onClick() {
          onImageSelect?.();
        }
      }, imageUploading ? "업로드 중" : "이미지")
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
        setUploadFeedback({ type: "error", message: "이미지는 최대 50MB까지 업로드할 수 있습니다." });
        event.target.value = "";
        return;
      }
      setImageUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await api("/api/upload/image", { method: "POST", body: formData });
        if (!result?.success || !result?.url) throw new Error(result?.message || "이미지 업로드에 실패했습니다.");
        insertImage(result.url);
        setUploadFeedback({ type: "success", message: "이미지를 업로드했습니다." });
      } catch (error) {
        setUploadFeedback({ type: "error", message: error.message || "이미지 업로드에 실패했습니다." });
      } finally {
        setImageUploading(false);
        event.target.value = "";
      }
    }

    return h("div", { className: "editor-shell" },
      h(EditorToolbar, { imageUploading, onImageSelect: () => fileInputRef.current?.click() }),
      h("input", { ref: fileInputRef, type: "file", accept: "image/*", hidden: true, onChange: handleFileChange }),
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
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "hero card" },
            h("span", { className: "eyebrow" }, "Home"),
            h("h1", { className: "section-title" }, "irisen25.com"),
            h("p", { className: "hero-copy" }, "sunggall archive"),
            h("div", { className: "inline-actions" },
              h(Link, { href: "/boards", className: "btn btn-primary" }, "보드 보기"),
              h(Link, { href: "/signin", className: "btn btn-ghost" }, "로그인")
            )
          ),
          h("section", { className: "section-stack" },
            h(PermissionNotice, { label: "홈 화면은 누구나 볼 수 있습니다.", detail: "로그인 없이 보드 탐색과 추천 글 확인이 가능합니다." }),
            h(PermissionMatrix, { items: [
              { action: "홈 보기", required: "비회원 포함 전체 사용자", available: true },
              { action: "추천 글 보기", required: "비회원 포함 전체 사용자", available: true },
              { action: "로그인 후 개인 기능 사용", required: "가입된 사용자", available: !!session?.loggedIn }
            ] }),
            h(SectionHead, { eyebrow: "Feed", title: "추천 글" }),
            feed.length
              ? h("div", { className: "stack" }, feed.map((post) =>
                  h(Link, { href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, className: "card quick-card", key: `${post.gall_id}-${post.post_no}`, reload: true },
                    h("div", { className: "board-title" }, post.title || "제목 없음"),
                  h("div", { className: "muted" }, `${post.gall_name || post.gall_id} · ${authorLabel(post)}`, h(ProfileInlineLink, { item: post }))
                  )))
              : h("div", { className: "empty-box" }, "추천 글이 없습니다."),
            h("div", { className: "muted" }, `전체 보드 ${boards.length}개`)
          )
        )
      )
    );
  }

  function BoardsView({ session, boards, query, onQueryChange, onSubmitSideBoardRequest, requestFeedback, onLogout, alarmCount }) {
    const [requestGid, setRequestGid] = useState("");
    const [requestName, setRequestName] = useState("");
    const [requestReason, setRequestReason] = useState("");
    const q = query.trim().toLowerCase();
    const filtered = boards.filter((board) => !q || String(board.gall_id || "").toLowerCase().includes(q) || String(board.gall_name || "").toLowerCase().includes(q));

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(PermissionNotice, {
              label: "보드 목록은 누구나 볼 수 있습니다.",
              detail: "사이드 보드 개설 요청은 로그인한 사용자만 보낼 수 있습니다."
            }),
            h(PermissionMatrix, { items: [
              { action: "보드 목록 보기", required: "비회원 포함 전체 사용자", available: true },
              { action: "사이드 보드 개설 요청", required: "로그인 사용자", available: !!session?.loggedIn, note: "요청은 관리자 또는 운영자가 알림에서 승인해야 반영됩니다." }
            ] }),
            h(SectionHead, { eyebrow: "Boards", title: "보드 목록" }),
            h("div", { className: "field" },
              h("label", { htmlFor: "board-search" }, "검색"),
              h("input", { id: "board-search", type: "text", value: query, onChange: (event) => onQueryChange(event.target.value) })
            ),
            filtered.length
              ? h("div", { className: "stack" }, filtered.map((board) =>
                  h(Link, { href: `/board/${encodeURIComponent(board.gall_id)}`, className: "card quick-card", key: board.gall_id },
                    h("div", { className: "board-title" }, board.gall_name || board.gall_id),
                    h("div", { className: "muted" }, `${board.gall_id} · ${board.post_count ?? 0} posts`)
                  )))
              : h("div", { className: "empty-box" }, "검색 결과가 없습니다."),
            h("article", { className: "card" },
              h("span", { className: "eyebrow" }, "Request"),
              h("h3", { className: "section-title", style: { fontSize: "1.3rem" } }, "사이드 보드 개설 요청"),
              h("div", { className: "muted" }, "원하는 사이드 보드가 없으면 운영진에게 개설 요청을 보낼 수 있습니다."),
              !session?.loggedIn
                ? h("div", { className: "empty-box", style: { marginTop: "12px" } }, "로그인 후 요청할 수 있습니다.")
                : h("div", { className: "stack", style: { marginTop: "12px" } },
                    h("div", { className: "field" },
                      h("label", { htmlFor: "side-board-gid" }, "보드 ID"),
                      h("input", { id: "side-board-gid", type: "text", value: requestGid, onChange: (event) => setRequestGid(event.target.value) })
                    ),
                    h("div", { className: "field" },
                      h("label", { htmlFor: "side-board-name" }, "보드 이름"),
                      h("input", { id: "side-board-name", type: "text", value: requestName, onChange: (event) => setRequestName(event.target.value) })
                    ),
                    h("div", { className: "field" },
                      h("label", { htmlFor: "side-board-reason" }, "요청 사유"),
                      h("textarea", { id: "side-board-reason", rows: 4, value: requestReason, onChange: (event) => setRequestReason(event.target.value) })
                    ),
                    h(Feedback, { feedback: requestFeedback }),
                    h(ActionPermission, null, "필요 권한: 로그인 사용자"),
                    h("div", { className: "inline-actions" },
                      h("button", {
                        type: "button",
                        className: "btn btn-primary",
                        onClick() {
                          onSubmitSideBoardRequest({ gallId: requestGid, gallName: requestName, reason: requestReason }, () => {
                            setRequestGid("");
                            setRequestName("");
                            setRequestReason("");
                          });
                        }
                      }, "요청 보내기")
                    )
                  )
            )
          )
        )
      )
    );
  }

  function BoardView({ session, gid, board, posts, page, manageData, settingsFeedback, onPrevPage, onNextPage, onLogout, alarmCount }) {
    const settings = manageData?.settings || null;
    const permissions = manageData?.permissions || {};
    const manager = manageData?.manager || null;
    const boardInfo = manageData?.board || board || {};
    const submanagers = Array.isArray(manageData?.submanagers) ? manageData.submanagers : [];
    const roleLabels = Array.isArray(manageData?.roleLabels) ? manageData.roleLabels : [];
    const roleLabel = roleLabels.length ? roleLabels.join(", ") : session?.loggedIn ? "member" : "guest";
    const [selectedCategory, setSelectedCategory] = useState("전체");
    const [listMode, setListMode] = useState("all");
    const parsedConceptThreshold = Number(settings?.concept_recommend_threshold || settings?.concept_threshold);
    const conceptThreshold = Number.isFinite(parsedConceptThreshold) && parsedConceptThreshold > 0 ? parsedConceptThreshold : 10;
    const boardThemeStyle = settings?.theme_color ? { "--board-accent": settings.theme_color } : null;
    const canWritePost = !!session?.loggedIn || flagEnabled(settings?.allow_guest_post);
    const configuredCategories = categoryOptionsFromSettings(settings);
    const postCategories = posts.map((post) => String(post.category || "").trim()).filter(Boolean);
    const categories = ["전체", ...Array.from(new Set([...configuredCategories, ...postCategories]))];
    const isConceptPost = (post) =>
      Number(post.is_concept || post.concept || 0) === 1 ||
      Number(post.recommend_count || post.recommend || post.likes || 0) >= conceptThreshold;
    const filteredPosts = posts.filter((post) => {
      const category = String(post.category || "일반");
      const matchesCategory = selectedCategory === "전체" || category === selectedCategory;
      const matchesMode =
        listMode === "all" ||
        (listMode === "concept" && isConceptPost(post)) ||
        (listMode === "notice" && Number(post.notice || post.is_notice || 0) === 1);
      return matchesCategory && matchesMode;
    });
    const staffItems = [
      manager ? `매니저 ${manager.nick || manager.uid}` : "매니저 미지정",
      ...submanagers.slice(0, 4).map((user) => `부매니저 ${user.nick || user.uid}`)
    ];

    useEffect(() => {
      setListMode("all");
      setSelectedCategory("전체");
    }, [gid]);

    useEffect(() => {
      if (!categories.includes(selectedCategory)) {
        setSelectedCategory("전체");
      }
    }, [categories.join("|")]);

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "dc-board-shell", style: boardThemeStyle },
            h(PermissionNotice, {
              label: "보드 열람은 누구나 가능합니다.",
              detail: `글쓰기 ${settings?.allow_guest_post !== false ? "허용" : "로그인 필요"} · 댓글 ${settings?.allow_guest_comment !== false ? "허용" : "로그인 필요"}`
            }),
            h(PermissionMatrix, { items: [
              { action: "게시글 목록 보기", required: "비회원 포함 전체 사용자", available: true },
              { action: "게시글 작성", required: settings?.allow_guest_post !== false ? "비회원 또는 로그인 사용자" : "로그인 사용자", available: settings?.allow_guest_post !== false || !!session?.loggedIn, note: "비회원 작성 시 이름과 비밀번호가 필요합니다." },
              { action: "보드 설정 변경", required: "관리자, 보드 매니저, 부매니저", available: !!permissions.canManage },
              { action: "부매니저 임명/해임", required: "관리자 또는 보드 매니저", available: !!permissions.canAppoint }
            ] }),
            h("div", { className: "dc-board-head" },
              h("div", { className: "dc-board-title-row" },
                h("h1", { className: "dc-board-title" }, boardInfo?.gall_name || gid),
                h("span", { className: "dc-board-id" }, gid)
              ),
              h("div", { className: "dc-board-head-links" },
                permissions.canManage ? h(Link, { href: `/board/${encodeURIComponent(gid)}/manage`, className: "dc-head-link" }, "설정") : null,
                canWritePost
                  ? h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "dc-head-link dc-head-link-strong" }, "글쓰기")
                  : h("button", { type: "button", className: "dc-head-link dc-head-link-strong", disabled: true }, "글쓰기")
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
              settings?.cover_image_url
                ? h("div", { className: "dc-board-cover" }, h("img", { src: settings.cover_image_url, alt: `${boardInfo?.gall_name || gid} cover` }))
                : null
            ),
            h("div", { className: "dc-board-tabs" },
              h("button", { type: "button", className: listMode === "all" ? "dc-tab is-active" : "dc-tab", onClick: () => setListMode("all") }, "전체글"),
              h("button", { type: "button", className: listMode === "concept" ? "dc-tab is-active" : "dc-tab", onClick: () => setListMode("concept") }, "개념글"),
              h("button", { type: "button", className: listMode === "notice" ? "dc-tab is-active" : "dc-tab", onClick: () => setListMode("notice") }, "공지"),
              h("div", { className: "dc-board-actions" },
                h("span", { className: "dc-page-chip" }, `${page} 페이지`),
                canWritePost
                  ? h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "btn btn-primary btn-compact" }, "글쓰기")
                  : h("button", { type: "button", className: "btn btn-primary btn-compact", disabled: true }, "글쓰기")
              )
            ),
            h("div", { className: "dc-category-strip", "aria-label": "말머리 목록" },
              categories.map((category) =>
                h("button", {
                  type: "button",
                  key: category,
                  className: selectedCategory === category ? "is-active" : "",
                  onClick: () => setSelectedCategory(category)
                }, category)
              ),
              h("span", { className: "dc-filter-count" }, `${filteredPosts.length}/${posts.length}`)
            ),
            h("div", { className: "dc-post-table-wrap" },
              h("div", { className: "dc-post-table-head" },
                ["번호", "말머리", "제목", "글쓴이", "작성일", "조회", "추천"].map((label) => h("span", { key: label }, label))
              ),
              filteredPosts.length
                ? filteredPosts.map((post) =>
                    h(Link, { href: `/board/${encodeURIComponent(gid)}/${post.post_no}?page=${page}`, className: "dc-post-row", key: `${gid}-${post.post_no}`, reload: true },
                      h("span", { className: "dc-post-no" }, post.post_no ?? "-"),
                      h("span", { className: "dc-post-kind" }, post.category || (post.notice ? "공지" : Number(post.recommend_count || 0) >= conceptThreshold ? "개념글" : "일반")),
                      h("span", { className: "dc-post-subject" }, h("strong", null, post.title || "제목 없음"), Number(post.comment_count || 0) > 0 ? h("em", null, `[${post.comment_count}]`) : null),
                      h("span", { className: "dc-post-author" }, authorLabel(post), h(ProfileInlineLink, { item: post })),
                      h("span", { className: "dc-post-date" }, formatDate(post.writed_at || post.created_at)),
                      h("span", { className: "dc-post-view" }, post.view_count ?? 0),
                      h("span", { className: "dc-post-rec" }, post.recommend_count ?? 0)
                    )
                  )
                : h("div", { className: "empty-box dc-post-empty" }, listMode === "concept" ? "조건에 맞는 개념글이 없습니다." : "표시할 게시글이 없습니다.")
            ),
            h("div", { className: "dc-pagination" },
              h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: onPrevPage }, "이전"),
              h("span", { className: "chip" }, `page ${page}`),
              h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: onNextPage }, "다음")
            ),
            settingsFeedback ? h("div", { className: "board-settings-feedback" }, h(Feedback, { feedback: settingsFeedback })) : null
          )
        )
      )
    );
  }

  function BoardSettingsPanel({ settings, feedback, onSave }) {
    const [boardNotice, setBoardNotice] = useState(settings?.board_notice || "");
    const [welcomeMessage, setWelcomeMessage] = useState(settings?.welcome_message || "");
    const [coverImageUrl, setCoverImageUrl] = useState(settings?.cover_image_url || "");
    const [themeColor, setThemeColor] = useState(settings?.theme_color || "#ff8fab");
    const [categoryOptions, setCategoryOptions] = useState(settings?.category_options || "일반");
    const [conceptRecommendThreshold, setConceptRecommendThreshold] = useState(String(settings?.concept_recommend_threshold || 10));
    const [allowGuestPost, setAllowGuestPost] = useState(settings?.allow_guest_post !== false);
    const [allowGuestComment, setAllowGuestComment] = useState(settings?.allow_guest_comment !== false);
    const [joinPolicy, setJoinPolicy] = useState(settings?.join_policy || "free");
    const [visibility, setVisibility] = useState(settings?.visibility || "public");
    const [pinnedNoticeCount, setPinnedNoticeCount] = useState(String(settings?.pinned_notice_count ?? 3));
    const [allowedAttachmentTypes, setAllowedAttachmentTypes] = useState(settings?.allowed_attachment_types || "");
    const [attachmentMaxBytes, setAttachmentMaxBytes] = useState(String(settings?.attachment_max_bytes || 10485760));

    useEffect(() => {
      setBoardNotice(settings?.board_notice || "");
      setWelcomeMessage(settings?.welcome_message || "");
      setCoverImageUrl(settings?.cover_image_url || "");
      setThemeColor(settings?.theme_color || "#ff8fab");
      setCategoryOptions(settings?.category_options || "일반");
      setConceptRecommendThreshold(String(settings?.concept_recommend_threshold || 10));
      setAllowGuestPost(settings?.allow_guest_post !== false);
      setAllowGuestComment(settings?.allow_guest_comment !== false);
      setJoinPolicy(settings?.join_policy || "free");
      setVisibility(settings?.visibility || "public");
      setPinnedNoticeCount(String(settings?.pinned_notice_count ?? 3));
      setAllowedAttachmentTypes(settings?.allowed_attachment_types || "");
      setAttachmentMaxBytes(String(settings?.attachment_max_bytes || 10485760));
    }, [settings]);

    return h("article", { className: "card board-settings-card" },
      h(SectionHead, { eyebrow: "Manager", title: "보드 설정" }),
      h("div", { className: "stack" },
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-notice" }, "공지"), h("textarea", { id: "board-setting-notice", rows: 3, value: boardNotice, onChange: (event) => setBoardNotice(event.target.value) })),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-welcome" }, "환영 문구"), h("textarea", { id: "board-setting-welcome", rows: 4, value: welcomeMessage, onChange: (event) => setWelcomeMessage(event.target.value) })),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-categories" }, "말머리 목록"), h("textarea", { id: "board-setting-categories", rows: 4, value: categoryOptions, onChange: (event) => setCategoryOptions(event.target.value), placeholder: "한 줄에 하나씩 입력하거나 쉼표로 구분" })),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-color" }, "테마 색상"), h("input", { id: "board-setting-color", type: "color", value: themeColor, onChange: (event) => setThemeColor(event.target.value || "#ff8fab") })),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-concept-threshold" }, "개념글 추천 기준"), h("input", { id: "board-setting-concept-threshold", type: "number", min: 1, step: 1, value: conceptRecommendThreshold, onChange: (event) => setConceptRecommendThreshold(event.target.value) })),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-join" }, "가입 방식"), h("select", { id: "board-setting-join", value: joinPolicy, onChange: (event) => setJoinPolicy(event.target.value) }, h("option", { value: "free" }, "자유 가입"), h("option", { value: "approval" }, "승인 가입"))),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-visibility" }, "공개 범위"), h("select", { id: "board-setting-visibility", value: visibility, onChange: (event) => setVisibility(event.target.value) }, h("option", { value: "public" }, "공개"), h("option", { value: "private" }, "비공개"), h("option", { value: "members" }, "멤버 전용"))),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-pin-count" }, "상단 고정 공지 수"), h("input", { id: "board-setting-pin-count", type: "number", min: 0, step: 1, value: pinnedNoticeCount, onChange: (event) => setPinnedNoticeCount(event.target.value) })),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-attachment-types" }, "허용 첨부 형식"), h("input", { id: "board-setting-attachment-types", type: "text", value: allowedAttachmentTypes, onChange: (event) => setAllowedAttachmentTypes(event.target.value), placeholder: "예: image/png,image/jpeg" })),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-attachment-size" }, "첨부 최대 용량(bytes)"), h("input", { id: "board-setting-attachment-size", type: "number", min: 0, step: 1, value: attachmentMaxBytes, onChange: (event) => setAttachmentMaxBytes(event.target.value) })),
        h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: allowGuestPost, onChange: (event) => setAllowGuestPost(event.target.checked) }), h("span", null, "비회원 글쓰기 허용")),
        h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: allowGuestComment, onChange: (event) => setAllowGuestComment(event.target.checked) }), h("span", null, "비회원 댓글 허용")),
        h("div", { className: "field" }, h("label", { htmlFor: "board-setting-cover-image" }, "Cover image URL"), h("input", { id: "board-setting-cover-image", type: "text", value: coverImageUrl, onChange: (event) => setCoverImageUrl(event.target.value), placeholder: "https://..." })),
        h(Feedback, { feedback }),
        h("div", { className: "inline-actions" },
          h("button", {
            type: "button",
            className: "btn btn-primary",
            onClick() {
              onSave({ boardNotice, welcomeMessage, coverImageUrl, categoryOptions, themeColor, conceptRecommendThreshold, allowGuestPost, allowGuestComment, joinPolicy, visibility, pinnedNoticeCount, allowedAttachmentTypes, attachmentMaxBytes });
            }
          }, "설정 저장")
        )
      )
    );
  }

  function BoardSettingsPanel({ settings, feedback, onSave }) {
    const fileInputRef = useRef(null);
    const [boardNotice, setBoardNotice] = useState(settings?.board_notice || "");
    const [welcomeMessage, setWelcomeMessage] = useState(settings?.welcome_message || "");
    const [coverImageUrl, setCoverImageUrl] = useState(settings?.cover_image_url || "");
    const [themeColor, setThemeColor] = useState(settings?.theme_color || "#ff8fab");
    const [categoryOptions, setCategoryOptions] = useState(settings?.category_options || "일반");
    const [conceptRecommendThreshold, setConceptRecommendThreshold] = useState(String(settings?.concept_recommend_threshold || 10));
    const [allowGuestPost, setAllowGuestPost] = useState(settings?.allow_guest_post !== false);
    const [allowGuestComment, setAllowGuestComment] = useState(settings?.allow_guest_comment !== false);
    const [joinPolicy, setJoinPolicy] = useState(settings?.join_policy || "free");
    const [visibility, setVisibility] = useState(settings?.visibility || "public");
    const [pinnedNoticeCount, setPinnedNoticeCount] = useState(String(settings?.pinned_notice_count ?? 3));
    const [allowedAttachmentTypes, setAllowedAttachmentTypes] = useState(settings?.allowed_attachment_types || "");
    const [attachmentMaxBytes, setAttachmentMaxBytes] = useState(String(settings?.attachment_max_bytes || 10485760));
    const [coverUploadFeedback, setCoverUploadFeedback] = useState(null);
    const [coverUploading, setCoverUploading] = useState(false);

    useEffect(() => {
      setBoardNotice(settings?.board_notice || "");
      setWelcomeMessage(settings?.welcome_message || "");
      setCoverImageUrl(settings?.cover_image_url || "");
      setThemeColor(settings?.theme_color || "#ff8fab");
      setCategoryOptions(settings?.category_options || "일반");
      setConceptRecommendThreshold(String(settings?.concept_recommend_threshold || 10));
      setAllowGuestPost(settings?.allow_guest_post !== false);
      setAllowGuestComment(settings?.allow_guest_comment !== false);
      setJoinPolicy(settings?.join_policy || "free");
      setVisibility(settings?.visibility || "public");
      setPinnedNoticeCount(String(settings?.pinned_notice_count ?? 3));
      setAllowedAttachmentTypes(settings?.allowed_attachment_types || "");
      setAttachmentMaxBytes(String(settings?.attachment_max_bytes || 10485760));
      setCoverUploadFeedback(null);
      setCoverUploading(false);
    }, [settings]);

    async function handleCoverFileChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      setCoverUploadFeedback(null);
      setCoverUploading(true);
      try {
        const url = await uploadImageFile(file);
        setCoverImageUrl(url);
        setCoverUploadFeedback({ type: "success", message: "대문 이미지를 업로드했습니다." });
      } catch (error) {
        setCoverUploadFeedback({ type: "error", message: error.message || "대문 이미지 업로드에 실패했습니다." });
      } finally {
        setCoverUploading(false);
        event.target.value = "";
      }
    }

    return h("article", { className: "card board-settings-card" },
      h(SectionHead, { eyebrow: "Manager", title: "보드 설정" }),
      h("div", { className: "stack" },
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-notice-v2" }, "공지"),
          h("textarea", { id: "board-setting-notice-v2", rows: 3, value: boardNotice, onChange: (event) => setBoardNotice(event.target.value) })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-welcome-v2" }, "환영 문구"),
          h("textarea", { id: "board-setting-welcome-v2", rows: 4, value: welcomeMessage, onChange: (event) => setWelcomeMessage(event.target.value) })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-categories-v2" }, "말머리 목록"),
          h("textarea", { id: "board-setting-categories-v2", rows: 4, value: categoryOptions, onChange: (event) => setCategoryOptions(event.target.value), placeholder: "한 줄에 하나씩 입력하거나 쉼표로 구분" })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-color-v2" }, "테마 색상"),
          h("input", { id: "board-setting-color-v2", type: "color", value: themeColor, onChange: (event) => setThemeColor(event.target.value || "#ff8fab") })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-concept-threshold-v2" }, "개념글 추천 기준"),
          h("input", { id: "board-setting-concept-threshold-v2", type: "number", min: 1, step: 1, value: conceptRecommendThreshold, onChange: (event) => setConceptRecommendThreshold(event.target.value) })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-join-v2" }, "가입 방식"),
          h("select", { id: "board-setting-join-v2", value: joinPolicy, onChange: (event) => setJoinPolicy(event.target.value) },
            h("option", { value: "free" }, "자유 가입"),
            h("option", { value: "approval" }, "승인 가입")
          )
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-visibility-v2" }, "공개 범위"),
          h("select", { id: "board-setting-visibility-v2", value: visibility, onChange: (event) => setVisibility(event.target.value) },
            h("option", { value: "public" }, "공개"),
            h("option", { value: "private" }, "비공개"),
            h("option", { value: "members" }, "멤버 전용")
          )
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-pin-count-v2" }, "상단 고정 공지 수"),
          h("input", { id: "board-setting-pin-count-v2", type: "number", min: 0, step: 1, value: pinnedNoticeCount, onChange: (event) => setPinnedNoticeCount(event.target.value) })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-attachment-types-v2" }, "허용 첨부 형식"),
          h("input", { id: "board-setting-attachment-types-v2", type: "text", value: allowedAttachmentTypes, onChange: (event) => setAllowedAttachmentTypes(event.target.value), placeholder: "예: image/png,image/jpeg" })
        ),
        h("div", { className: "field" },
          h("label", { htmlFor: "board-setting-attachment-size-v2" }, "첨부 최대 용량(bytes)"),
          h("input", { id: "board-setting-attachment-size-v2", type: "number", min: 0, step: 1, value: attachmentMaxBytes, onChange: (event) => setAttachmentMaxBytes(event.target.value) })
        ),
        h("label", { className: "check-row" },
          h("input", { type: "checkbox", checked: allowGuestPost, onChange: (event) => setAllowGuestPost(event.target.checked) }),
          h("span", null, "비회원 글쓰기 허용")
        ),
        h("label", { className: "check-row" },
          h("input", { type: "checkbox", checked: allowGuestComment, onChange: (event) => setAllowGuestComment(event.target.checked) }),
          h("span", null, "비회원 댓글 허용")
        ),
        h("div", { className: "field" },
          h("label", null, "대문 이미지"),
          h("input", { ref: fileInputRef, type: "file", accept: "image/*", hidden: true, onChange: handleCoverFileChange }),
          h("div", { className: "inline-actions" },
            h("button", { type: "button", className: "btn btn-secondary", onClick: () => fileInputRef.current?.click(), disabled: coverUploading }, coverUploading ? "업로드 중..." : "이미지 선택"),
            coverImageUrl ? h("button", { type: "button", className: "btn btn-ghost", onClick: () => setCoverImageUrl("") }, "대문 제거") : null
          ),
          coverImageUrl ? h("div", { className: "dc-board-cover" }, h("img", { src: coverImageUrl, alt: "Board cover preview" })) : null,
          h(Feedback, { feedback: coverUploadFeedback })
        ),
        h(Feedback, { feedback }),
        h("div", { className: "inline-actions" },
          h("button", {
            type: "button",
            className: "btn btn-primary",
            onClick() {
              onSave({ boardNotice, welcomeMessage, coverImageUrl, categoryOptions, themeColor, conceptRecommendThreshold, allowGuestPost, allowGuestComment, joinPolicy, visibility, pinnedNoticeCount, allowedAttachmentTypes, attachmentMaxBytes });
            }
          }, "설정 저장")
        )
      )
    );
  }

  function BoardManageView({ session, gid, board, manageData, feedback, onSaveSettings, onLogout, alarmCount }) {
    const permissions = manageData?.permissions || {};
    const settings = manageData?.settings || { gall_id: gid, theme_color: "#ff8fab", concept_recommend_threshold: 10, allow_guest_post: true, allow_guest_comment: true };
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(SectionHead, {
              eyebrow: "Manage",
              title: `${board?.gall_name || gid} 보드 관리`,
              action: h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-secondary" }, "보드로 돌아가기")
            }),
            h(PermissionMatrix, { items: [
              { action: "보드 설정 저장", required: "관리자, 보드 매니저, 부매니저", available: !!permissions.canManage },
              { action: "매니저 요청/양도", required: "관리자 또는 현재 매니저", available: !!permissions.canAppoint || !!permissions.isAdmin },
              { action: "부매니저 임명/해임", required: "관리자 또는 현재 매니저", available: !!permissions.canAppoint }
            ] }),
            permissions.canManage
              ? h(BoardSettingsPanel, { settings, feedback, onSave: onSaveSettings })
              : h("article", { className: "card board-settings-card" }, h("div", { className: "error-box" }, "이 보드를 관리할 권한이 없습니다."))
          )
        )
      )
    );
  }

  function PopupDeleteControl({ session, buttonLabel, passwordLabel = "비밀번호", requirePassword = false, onDelete }) {
    return h("div", { className: "inline-actions delete-control" },
      h("button", {
        type: "button",
        className: "btn btn-secondary btn-danger",
        onClick() {
          if (requirePassword || !session?.loggedIn) {
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

  function PostVotePanel({ post, voteState, voteFeedback, onVote }) {
    const canVote = voteState?.canVote !== false;
    const todayVote = voteState?.voteType === "up" ? "오늘 추천함" : voteState?.voteType === "down" ? "오늘 비추천함" : "아직 투표하지 않음";
    return h("div", { className: "post-vote-panel" },
      h("div", { className: "post-vote-summary" },
        h("span", { className: "chip" }, `추천 ${post?.recommend_count ?? 0}`),
        h("span", { className: "chip" }, `비추천 ${post?.unrecommend_count ?? 0}`)
      ),
      h("div", { className: "post-vote-actions" },
        h("button", { type: "button", className: "btn btn-primary btn-compact", disabled: !canVote, onClick: () => onVote({ gid: post.gall_id, postNo: post.post_no, voteType: "up" }) }, "추천"),
        h("button", { type: "button", className: "btn btn-secondary btn-compact", disabled: !canVote, onClick: () => onVote({ gid: post.gall_id, postNo: post.post_no, voteType: "down" }) }, "비추천")
      ),
      h("div", { className: "muted" }, canVote ? "게시글마다 하루 한 번 투표할 수 있습니다." : todayVote),
      h(Feedback, { feedback: voteFeedback })
    );
  }

  function PostView({ session, gid, post, comments, feedback, deleteFeedback, voteFeedback, voteState, manageData, onSubmitComment, onDeletePost, onDeleteComment, onVote, onScrapPost, onReportPost, onLikeComment, onReportComment, onCancelConcept, onLogout, alarmCount }) {
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    const isAdmin = ["1", 1, "admin", "operator"].includes(session?.memberDivision);
    const permissions = manageData?.permissions || {};
    const settings = manageData?.settings || null;
    const canComment = !!session?.loggedIn || flagEnabled(settings?.allow_guest_comment);
    const isOwnedBySession = (item) => session?.loggedIn && session?.uid && item?.writer_uid && String(item.writer_uid).trim() === String(session.uid).trim();
    const canRenderDelete = (item) => item && (!session?.loggedIn ? !item.writer_uid : isOwnedBySession(item) || isAdmin || !!permissions.canManage);

    if (!post) {
      return h(React.Fragment, null, h(Topbar, { session, onLogout, alarmCount }), h("main", { className: "shell" }, h("div", { className: "frame" }, h("div", { className: "error-box" }, "게시글을 찾을 수 없습니다."))));
    }

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h(PermissionMatrix, { items: [
            { action: "게시글 읽기", required: "비회원 포함 전체 사용자", available: true },
            { action: "추천/비추천", required: "비회원 포함 전체 사용자", available: voteState?.canVote !== false, note: "동일 게시글은 사용자 또는 IP 기준 하루 한 번만 투표할 수 있습니다." },
            { action: "댓글 작성", required: "보드 설정이 허용한 비회원 또는 로그인 사용자", available: true, note: "비회원 댓글은 이름과 비밀번호가 필요합니다." },
            { action: "게시글 삭제", required: "작성자, 비회원 작성 비밀번호, 관리자 또는 보드 운영진", available: canRenderDelete(post) },
            { action: "댓글 삭제", required: "작성자, 비회원 작성 비밀번호, 관리자 또는 보드 운영진", note: "댓글마다 삭제 가능 여부가 다르게 표시됩니다." }
          ] }),
          h("article", { className: "card post-card" },
            h("div", { className: "post-card-main" },
              h("div", { className: "post-meta-bar" }, h("span", { className: "post-board-name" }, post.gall_name || gid)),
              h("div", { className: "post-title-block" },
                post.category ? h("span", { className: "chip" }, `[${post.category}]`) : null,
                h("h1", { className: "post-heading" }, post.title || "제목 없음"),
                h("div", { className: "post-info-row" },
                  h("span", null, authorLabel(post), h(ProfileInlineLink, { item: post })),
                  h("span", { className: "post-info-sep" }, "|"),
                  h("span", null, formatDate(post.writed_at || post.created_at)),
                  h("span", { className: "post-info-sep" }, "|"),
                  h("span", null, `조회 ${post.view_count ?? 0}`),
                  h("span", { className: "post-info-sep" }, "|"),
                  h("span", null, `추천 ${post.recommend_count ?? 0}`)
                )
              ),
              h("section", { className: "post-content-panel" },
                h("div", { className: "post-content-label" }, "본문"),
                h("div", { className: "preview post-content-fill", dangerouslySetInnerHTML: { __html: post.content || "" } })
              )
            ),
            h("div", { className: "post-card-footer" },
              h(PostVotePanel, { post, voteState, voteFeedback, onVote }),
              h("div", { className: "inline-actions" },
                session?.loggedIn ? h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: () => onScrapPost(post) }, "스크랩") : null,
                h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: () => onReportPost(post) }, "신고"),
                (permissions.canManage || isAdmin) && Number(post.is_concept || 0) === 1 ? h("button", { type: "button", className: "btn btn-ghost btn-compact", onClick: () => onCancelConcept(post) }, "개념글 취소") : null
              ),
              canRenderDelete(post) ? h(PopupDeleteControl, { session, buttonLabel: "게시글 삭제", requirePassword: !post.writer_uid, onDelete: (password, reset) => onDeletePost({ gid, postNo: post.post_no, password }, reset) }) : null,
              h(Feedback, { feedback: deleteFeedback })
            )
          ),
          h("section", { className: "section-stack" },
            h(SectionHead, { eyebrow: "Comments", title: "댓글" }),
            comments.length
              ? h("div", { className: "stack" }, comments.map((comment) =>
                  h("article", { className: "card", key: comment.id || comment.comment_id || `${comment.created_at}-${comment.name}` },
                    h("div", { className: "muted" }, authorLabel(comment), h(ProfileInlineLink, { item: comment }), ` · ${formatDate(comment.writed_at || comment.created_at)}`),
                    h("div", { className: "preview", dangerouslySetInnerHTML: { __html: comment.content || "" } }),
                    h("div", { className: "inline-actions" },
                      h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: () => onLikeComment(comment) }, `공감 ${comment.like_count ?? 0}`),
                      h("button", { type: "button", className: "btn btn-ghost btn-compact", onClick: () => onReportComment(comment) }, "신고")
                    ),
                    canRenderDelete(comment) ? h(PopupDeleteControl, { session, buttonLabel: "댓글 삭제", requirePassword: !comment.writer_uid, onDelete: (password, reset) => onDeleteComment({ commentId: comment.id || comment.comment_id, password }, reset) }) : null
                  )))
              : h("div", { className: "empty-box" }, "아직 댓글이 없습니다."),
            h("article", { className: "card" },
              h("div", { className: "field" },
                h("label", { htmlFor: "comment-content" }, "댓글"),
                h("textarea", { id: "comment-content", rows: 5, value: content, onChange: (event) => setContent(event.target.value) })
              ),
              session?.loggedIn ? null : h(GuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "comment" }),
              canComment ? null : h("div", { className: "error-box" }, "이 보드는 로그인 사용자만 댓글을 작성할 수 있습니다."),
              h(Feedback, { feedback }),
              h(ActionPermission, null, "필요 권한: 댓글 작성이 허용된 보드의 로그인 사용자 또는 비회원(이름/비밀번호 필수)"),
              h("div", { className: "inline-actions" },
                h("button", {
                  type: "button",
                  className: "btn btn-primary",
                  disabled: !canComment,
                  onClick() {
                    if (!canComment) return;
                    onSubmitComment({ gid, postNo: post.post_no, content, name: guestName.trim(), password: guestPassword }, () => {
                      setContent("");
                      setGuestName("");
                      setGuestPassword("");
                    });
                  }
                }, "댓글 등록")
              )
            )
          )
        )
      )
    );
  }

  function WriteView({ session, gid, feedback, manageData, onSubmitPost, onLogout, alarmCount }) {
    const [title, setTitle] = useState("");
    const [category, setCategory] = useState("");
    const [content, setContent] = useState("");
    const [isDraft, setIsDraft] = useState(false);
    const [isSecret, setIsSecret] = useState(false);
    const [attachments, setAttachments] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    const settings = manageData?.settings || null;
    const canWritePost = !!session?.loggedIn || flagEnabled(settings?.allow_guest_post);
    const categoryOptions = categoryOptionsFromSettings(settings);
    useEffect(() => {
      if (!category && categoryOptions.length) {
        setCategory(categoryOptions[0]);
      }
      if (category && categoryOptions.length && !categoryOptions.includes(category)) {
        setCategory(categoryOptions[0]);
      }
    }, [settings?.category_options]);
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "write-grid" },
            h("article", { className: "card" },
              h(PermissionNotice, {
                label: "글쓰기는 보드 설정에 따라 비회원 또는 로그인 사용자만 가능합니다.",
                detail: "비회원 작성 시 이름과 비밀번호를 같이 입력해야 합니다."
              }),
              h(PermissionMatrix, { items: [
                { action: "게시글 작성", required: "보드 설정이 허용한 비회원 또는 로그인 사용자", available: true },
                { action: "HTML 서식/이미지 입력", required: "게시글 작성 가능 사용자", available: true, note: "입력창에서는 서식을 적용하고 저장 값은 HTML로 보관됩니다." },
                { action: "비회원 작성", required: "이름과 비밀번호 입력", available: !session?.loggedIn }
              ] }),
              h(SectionHead, { eyebrow: "Write", title: `${gid} 글쓰기` }),
              categoryOptions.length
                ? h("div", { className: "field" },
                    h("label", { htmlFor: "write-category" }, "말머리"),
                    h("select", { id: "write-category", value: category || categoryOptions[0], onChange: (event) => setCategory(event.target.value) },
                      categoryOptions.map((option) => h("option", { key: option, value: option }, `[${option}]`))
                    )
                  )
                : null,
              h("div", { className: "field" }, h("label", { htmlFor: "write-title" }, "제목"), h("input", { id: "write-title", type: "text", value: title, onChange: (event) => setTitle(event.target.value) })),
              h("div", { className: "field" }, h("label", { htmlFor: "write-content" }, "본문"), h(HtmlEditor, { id: "write-content", value: content, onChange: setContent, placeholder: "글 내용을 입력해주세요." })),
              h("div", { className: "field" }, h("label", { htmlFor: "write-attachments" }, "첨부 URL"), h("textarea", { id: "write-attachments", rows: 2, value: attachments, onChange: (event) => setAttachments(event.target.value), placeholder: "쉼표 또는 줄바꿈으로 여러 개 입력" })),
              h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: isDraft, onChange: (event) => setIsDraft(event.target.checked) }), h("span", null, "임시저장")),
              h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: isSecret, onChange: (event) => setIsSecret(event.target.checked) }), h("span", null, "비밀글")),
              session?.loggedIn ? null : h(GuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "write" }),
              canWritePost ? null : h("div", { className: "error-box" }, "이 보드는 로그인 사용자만 글을 작성할 수 있습니다."),
              h(Feedback, { feedback }),
              h(ActionPermission, null, session?.loggedIn ? "필요 권한: 로그인 사용자" : "필요 권한: 비회원 이름과 비밀번호 입력"),
              h("div", { className: "inline-actions" },
                h("button", {
                  type: "button",
                  className: "btn btn-primary",
                  disabled: !canWritePost,
                  onClick() {
                    if (!canWritePost) return;
                    onSubmitPost({ gid, category: category || categoryOptions[0] || "", title: title.trim(), content, name: guestName.trim(), password: guestPassword, isDraft, isSecret, attachments }, () => {
                      setTitle("");
                      setCategory(categoryOptions[0] || "");
                      setContent("");
                      setIsDraft(false);
                      setIsSecret(false);
                      setAttachments("");
                      setGuestName("");
                      setGuestPassword("");
                    });
                  }
                }, "글 등록"),
                h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-ghost" }, "취소")
              )
            ),
            h("aside", { className: "preview-card card" },
              h("span", { className: "eyebrow" }, "Preview"),
              h("h3", { className: "section-title", style: { fontSize: "1.8rem" } }, "미리보기"),
              h("div", { className: "preview", dangerouslySetInnerHTML: { __html: content || "<p>아직 작성한 내용이 없습니다.</p>" } })
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
      { eyebrow: "Step 1", title: "아이디 입력", field: "uid", value: uid, canNext: uid.trim().length > 0, render: h("div", { className: "field" }, h("label", { htmlFor: "auth-uid" }, "아이디"), h("input", { id: "auth-uid", type: "text", value: uid, onChange: (event) => setUid(event.target.value), placeholder: "4-20자 영문, 숫자, 밑줄" })) },
      { eyebrow: "Step 2", title: "닉네임 입력", field: "nick", value: nick, canNext: nick.trim().length > 0, render: h("div", { className: "field" }, h("label", { htmlFor: "auth-nick" }, "닉네임"), h("input", { id: "auth-nick", type: "text", value: nick, onChange: (event) => setNick(event.target.value), placeholder: "2-20자 문자/숫자" })) },
      { eyebrow: "Step 3", title: "이메일 입력", field: "email", value: email, canNext: email.trim().length > 0, render: h("div", { className: "field" }, h("label", { htmlFor: "auth-email" }, "이메일"), h("input", { id: "auth-email", type: "email", value: email, onChange: (event) => setEmail(event.target.value), placeholder: "인증 메일을 받을 주소" })) },
      { eyebrow: "Step 4", title: "비밀번호 입력", field: "password", value: password, canNext: password.length >= 8, render: h("div", { className: "stack" }, h("div", { className: "field" }, h("label", { htmlFor: "auth-pw" }, "비밀번호"), h("input", { id: "auth-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value), placeholder: "8자 이상 강한 비밀번호" })), h("div", { className: "muted" }, "대문자, 소문자, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.")) },
      { eyebrow: "Step 5", title: verificationSent ? "인증 코드 입력" : "이메일 인증", canNext: verificationSent ? code.trim().length > 0 : true, render: verificationSent ? h("div", { className: "field" }, h("label", { htmlFor: "auth-code" }, "인증 코드"), h("input", { id: "auth-code", type: "text", value: code, onChange: (event) => setCode(event.target.value), placeholder: "메일로 받은 6자리 코드" })) : h("div", { className: "muted" }, `${email || "입력한 이메일"} 주소로 인증 메일을 보냅니다.`) }
    ];
    const currentSignupStep = signupSteps[Math.min(signupStep, signupSteps.length - 1)];

    async function validateCurrentStep() {
      if (!currentSignupStep.field) return true;
      try {
        const result = await api(`/api/signup/validate?field=${encodeURIComponent(currentSignupStep.field)}&value=${encodeURIComponent(currentSignupStep.value || "")}`);
        if (!result?.success || !result?.data?.valid) {
          setStepFeedback({ type: "error", message: result?.data?.message || "입력값을 확인해주세요." });
          return false;
        }
        setStepFeedback({ type: "success", message: "사용 가능한 값입니다." });
        return true;
      } catch (error) {
        setStepFeedback({ type: "error", message: error.message || "입력값 확인에 실패했습니다." });
        return false;
      }
    }

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "auth-wrap" },
            h("article", { className: "auth-card card" },
              h(PermissionNotice, {
                label: isLogin ? "로그인은 비회원 페이지가 아닙니다." : "회원가입은 비회원만 진행할 수 있습니다.",
                detail: isLogin ? "로그인하면 알림, 권한, 보드 요청 기능을 사용할 수 있습니다." : "가입에는 이메일 인증 완료가 필요합니다."
              }),
              h(PermissionMatrix, { items: isLogin ? [
                { action: "로그인", required: "가입된 사용자 계정", available: true },
                { action: "알림 확인", required: "로그인 사용자", available: !!session?.loggedIn },
                { action: "보드 요청/권한 수락", required: "로그인 사용자", available: !!session?.loggedIn }
              ] : [
                { action: "회원가입", required: "비회원", available: !session?.loggedIn },
                { action: "이메일 인증 메일 발송", required: "아이디, 닉네임, 이메일, 비밀번호 정책 통과", available: true },
                { action: "가입 완료", required: "이메일 인증 코드 확인", available: false, note: "인증 성공 후 계정이 생성됩니다." }
              ] }),
              h("span", { className: "eyebrow" }, isLogin ? "Access" : currentSignupStep.eyebrow),
              h("h1", { className: "section-title" }, isLogin ? "로그인" : currentSignupStep.title),
              h("div", { className: "stack", style: { marginTop: "16px" } },
                isLogin
                  ? h("div", { className: "stack" },
                      h("div", { className: "field" }, h("label", { htmlFor: "auth-login-id" }, "아이디 또는 이메일"), h("input", { id: "auth-login-id", type: "text", value: uid, onChange: (event) => setUid(event.target.value) })),
                      h("div", { className: "field" }, h("label", { htmlFor: "auth-login-pw" }, "비밀번호"), h("input", { id: "auth-login-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value) }))
                    )
                  : h("div", { className: "stack" },
                      h("div", { className: "chip" }, `${signupStep + 1} / ${signupSteps.length}`),
                      currentSignupStep.render,
                      verificationSent && signupStep === signupSteps.length - 1 ? h("div", { className: "success-box" }, "인증 메일을 보냈습니다. 코드를 입력해 가입을 완료해주세요.") : null
                    ),
                h(Feedback, { feedback }),
                isLogin ? null : h(Feedback, { feedback: stepFeedback }),
                h("div", { className: "inline-actions" },
                  isLogin
                    ? h("button", { type: "button", className: "btn btn-primary", onClick: () => onSubmitAuth({ mode, uid, password }) }, "로그인")
                    : signupStep < signupSteps.length - 1
                      ? [
                          signupStep > 0 ? h("button", { type: "button", className: "btn btn-ghost", key: "prev", onClick: () => setSignupStep((v) => Math.max(0, v - 1)) }, "이전") : null,
                          h("button", { type: "button", className: "btn btn-primary", key: "next", disabled: !currentSignupStep.canNext, async onClick() {
                            if (await validateCurrentStep()) setSignupStep((v) => Math.min(signupSteps.length - 1, v + 1));
                          } }, "다음")
                        ]
                      : [
                          h("button", { type: "button", className: "btn btn-ghost", key: "prev", onClick: () => setSignupStep((v) => Math.max(0, v - 1)) }, "이전"),
                          h("button", { type: "button", className: "btn btn-secondary", key: "send", onClick: () => onSubmitAuth({ mode, uid, nick, email, password, resendOnly: true, setVerificationSent }) }, verificationSent ? "인증 메일 다시 보내기" : "인증 메일 보내기"),
                          verificationSent ? h("button", { type: "button", className: "btn btn-primary", key: "verify", disabled: !currentSignupStep.canNext, onClick: () => onSubmitAuth({ mode, uid, nick, email, password, code, verificationSent, setVerificationSent }) }, "인증 완료하고 가입") : null
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

  function AlarmsView({ session, alarms, feedback, onAcceptAlarm, onRejectAlarm, onMarkAllRead, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(PermissionNotice, {
              label: "알림 확인은 로그인 사용자만 가능합니다.",
              detail: "권한 관리 요청과 개인 알림을 한곳에서 확인합니다."
            }),
            h(PermissionMatrix, { items: [
              { action: "알림 목록 확인", required: "로그인 사용자", available: !!session?.loggedIn },
              { action: "매니저/부매니저 요청 수락", required: "알림 대상 본인", available: !!session?.loggedIn },
              { action: "사이드 보드 요청 승인/거절", required: "관리자 또는 운영자", available: !!session?.loggedIn, note: "서버에서 관리자 권한을 다시 확인합니다." }
            ] }),
            h("div", { className: "section-head" },
              h("div", null, h("span", { className: "eyebrow" }, "Inbox"), h("h2", { className: "section-title" }, "알림")),
              session?.loggedIn ? h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: onMarkAllRead }, "모두 읽음") : null
            ),
            !session?.loggedIn
              ? h("article", { className: "card auth-card" }, h("p", { className: "muted" }, "로그인해야 알림을 확인할 수 있습니다."))
              : h("div", { className: "stack" },
                  h(Feedback, { feedback }),
                  alarms.length
                    ? alarms.map((alarm) => h("article", { className: "card", key: alarm.alarm_id },
                        h("div", { className: "section-head" },
                          h("div", null, h("span", { className: "eyebrow" }, alarm.alarm_type || "alarm"), h("h2", { className: "section-title", style: { fontSize: "1.4rem" } }, alarm.title || "알림")),
                          h("span", { className: "chip" }, formatDate(alarm.created_at))
                        ),
                        h("p", { className: "muted" }, alarm.content || ""),
                        alarm.actionable ? h("div", { className: "inline-actions" },
                          h("button", { type: "button", className: "btn btn-primary", onClick: () => onAcceptAlarm(alarm.alarm_id) }, "수락"),
                          h("button", { type: "button", className: "btn btn-ghost", onClick: () => onRejectAlarm(alarm.alarm_id) }, "거절")
                        ) : null
                      ))
                    : h("div", { className: "empty-box" }, "받은 알림이 없습니다.")
                )
          )
        )
      )
    );
  }

  function ProfileView({ session, profileData, feedback, onSaveProfile, onFollowProfile, onUnfollowProfile, onLogout, alarmCount }) {
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
      return h(React.Fragment, null, h(Topbar, { session, onLogout, alarmCount }), h("main", { className: "shell" }, h("div", { className: "frame" }, h("section", { className: "section-stack" }, h("div", { className: "error-box" }, "프로필을 불러오지 못했습니다.")))));
    }

    const stats = profileData.stats || {};
    const accentStyle = profileData.accentColor ? { borderTop: `4px solid ${profileData.accentColor}` } : null;

    return h(React.Fragment, null,
      h(Topbar, { session, onLogout, alarmCount }),
      h("main", { className: "shell" },
        h("div", { className: "frame" },
          h("section", { className: "section-stack" },
            h(PermissionNotice, {
              label: profileData.ownerView ? "내 프로필 수정은 로그인한 본인만 가능합니다." : "공개 프로필은 누구나 볼 수 있습니다.",
              detail: "비공개 설정 항목은 다른 사용자에게 노출되지 않습니다."
            }),
            h(PermissionMatrix, { items: [
              { action: "프로필 보기", required: "비회원 포함 전체 사용자", available: true },
              { action: "프로필 설정 저장", required: "로그인한 프로필 소유자", available: !!profileData.canEdit },
              { action: "작성 글/댓글 보기", required: "공개 설정 허용 또는 본인", available: !profileData.postsHidden || !!profileData.ownerView, note: "비공개 항목은 다른 사용자에게 숨겨집니다." }
            ] }),
            h("article", { className: "card profile-hero-card", style: accentStyle },
              h("div", { className: "profile-hero-head" },
                h("div", { className: "stack", style: { gap: "8px" } },
                  h("span", { className: "eyebrow" }, profileData.ownerView ? "My Profile" : "Profile"),
                  h("h1", { className: "section-title", style: { margin: 0 } }, profileData.nick || profileData.uid),
                  h("div", { className: "muted" }, `@${profileData.uid}`),
                  profileData.statusMessage ? h("div", { className: "profile-status-text" }, profileData.statusMessage) : null
                ),
                h("div", { className: "profile-stat-grid" },
                  h("div", { className: "profile-stat-card" }, h("strong", null, stats.postCount ?? 0), h("span", null, "글")),
                  h("div", { className: "profile-stat-card" }, h("strong", null, stats.commentCount ?? 0), h("span", null, "댓글")),
                  h("div", { className: "profile-stat-card" }, h("strong", null, stats.managedBoardCount ?? 0), h("span", null, "관리 보드")),
                  h("div", { className: "profile-stat-card" }, h("strong", null, stats.submanagerBoardCount ?? 0), h("span", null, "부관리 보드"))
                )
              ),
              profileData.bio ? h("div", { className: "profile-bio-box" }, profileData.bio) : null,
              h("div", { className: "inline-actions" },
                profileData.email ? h("span", { className: "chip" }, profileData.email) : null,
                !profileData.ownerView && session?.loggedIn
                  ? profileData.follow?.isFollowing
                    ? h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: () => onUnfollowProfile(profileData.uid) }, "언팔로우")
                    : h("button", { type: "button", className: "btn btn-primary btn-compact", onClick: () => onFollowProfile(profileData.uid) }, "팔로우")
                  : null
              )
            ),
            profileData.canEdit
              ? h("article", { className: "card profile-settings-card" },
                  h(SectionHead, { eyebrow: "Customize", title: "프로필 설정" }),
                  h("div", { className: "stack" },
                    h("div", { className: "field" }, h("label", { htmlFor: "profile-status-message" }, "상태 메시지"), h("input", { id: "profile-status-message", type: "text", maxLength: 160, value: statusMessage, onChange: (event) => setStatusMessage(event.target.value) })),
                    h("div", { className: "field" }, h("label", { htmlFor: "profile-bio" }, "소개"), h("textarea", { id: "profile-bio", rows: 5, value: bio, onChange: (event) => setBio(event.target.value) })),
                    h("div", { className: "field profile-color-field" }, h("label", { htmlFor: "profile-color" }, "테마 색상"), h("input", { id: "profile-color", type: "color", value: accentColor, onChange: (event) => setAccentColor(event.target.value || "#ff8fab") })),
                    h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: showPosts, onChange: (event) => setShowPosts(event.target.checked) }), h("span", null, "작성 글 공개")),
                    h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: showComments, onChange: (event) => setShowComments(event.target.checked) }), h("span", null, "작성 댓글 공개")),
                    h(Feedback, { feedback }),
                    h("div", { className: "inline-actions" }, h("button", { type: "button", className: "btn btn-primary", onClick: () => onSaveProfile({ statusMessage, bio, accentColor, showPosts, showComments }) }, "프로필 저장"))
                  )
                )
              : null,
            h("article", { className: "card profile-list-card" },
              h(SectionHead, { eyebrow: "Posts", title: "작성 글" }),
              profileData.postsHidden ? h("div", { className: "empty-box" }, "이 사용자는 작성 글을 비공개로 설정했습니다.")
                : profileData.posts?.length ? h("div", { className: "compact-stack" }, profileData.posts.map((post) =>
                    h(Link, { href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, reload: true, className: "mini-link-card", key: `${post.gall_id}-${post.post_no}` },
                      h("div", { className: "board-title", style: { fontSize: "1rem" } }, post.title || "제목 없음"),
                      h("div", { className: "muted" }, `${post.gall_name || post.gall_id} · ${formatDate(post.writed_at)} · 조회 ${post.view_count ?? 0} · 댓글 ${post.comment_count ?? 0}`)
                    ))) : h("div", { className: "empty-box" }, "작성한 글이 없습니다.")
            ),
            h("article", { className: "card profile-list-card" },
              h(SectionHead, { eyebrow: "Comments", title: "작성 댓글" }),
              profileData.commentsHidden ? h("div", { className: "empty-box" }, "이 사용자는 작성 댓글을 비공개로 설정했습니다.")
                : profileData.comments?.length ? h("div", { className: "compact-stack" }, profileData.comments.map((comment) =>
                    h(Link, { href: `/board/${encodeURIComponent(comment.gall_id)}/${comment.post_no}`, reload: true, className: "mini-link-card", key: `${comment.id}` },
                      h("div", { className: "board-title", style: { fontSize: "1rem" } }, comment.post_title || "삭제된 글"),
                      h("div", { className: "muted" }, `${comment.gall_name || comment.gall_id} · ${formatDate(comment.writed_at)}`),
                      h("div", { className: "muted profile-comment-preview" }, comment.content || "")
                    ))) : h("div", { className: "empty-box" }, "작성한 댓글이 없습니다.")
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
    const [boardRequestFeedback, setBoardRequestFeedback] = useState(null);

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
        .then((result) => {
          const data = result?.success ? result.data : null;
          if (route.name === "boardManage" && (!data || !data?.permissions?.canManage)) {
            setSettingsFeedback({ type: "error", message: result?.message || "보드 관리 권한이 없습니다." });
            navigate(`/board/${encodeURIComponent(gid)}`, true);
            setBoardManageData(null);
            return;
          }
          setBoardManageData(data);
        })
        .catch(() => {
          if (route.name === "boardManage") {
            setSettingsFeedback({ type: "error", message: "보드 관리 권한이 없습니다." });
            navigate(`/board/${encodeURIComponent(gid)}`, true);
          }
          setBoardManageData(null);
        });
    }

    function refreshProfile(uid) {
      if (!uid) {
        setProfileData(null);
        return Promise.resolve();
      }
      const endpoint = route.params.uid ? `/api/profile/${encodeURIComponent(uid)}` : "/api/profile/me";
      return api(endpoint).then((result) => setProfileData(result?.success ? result.data : null)).catch(() => setProfileData(null));
    }

    function refreshPostDetail(gid, postNo) {
      return api(`/api/posts/get/${encodeURIComponent(gid)}/${encodeURIComponent(postNo)}`).then((result) => setPostData({
        post: result?.success ? result.post : null,
        comments: result?.success && Array.isArray(result.comments) ? result.comments : [],
        voteState: result?.success && result.voteState ? result.voteState : { canVote: true, voteType: "" }
      })).catch(() => setPostData({ post: null, comments: [], voteState: { canVote: true, voteType: "" } }));
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
        refreshBoardPosts(route.params.gid, page);
        refreshBoardManage(route.params.gid);
      }
      if (route.name === "boardManage") refreshBoardManage(route.params.gid);
      if (route.name === "write") refreshBoardManage(route.params.gid);
      if (route.name === "post") {
        refreshPostDetail(route.params.gid, route.params.postNo);
        refreshBoardManage(route.params.gid);
      }
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
        api("/login", { method: "POST", body: JSON.stringify({ userID: payload.uid.trim(), password: payload.password }) })
          .then((result) => {
            if (!result.success) {
              setAuthFeedback({ type: "error", message: result.message || "로그인에 실패했습니다." });
              return;
            }
            refreshSession().then(() => navigate("/", true));
          })
          .catch((error) => setAuthFeedback({ type: "error", message: error.message || "로그인 요청 중 오류가 발생했습니다." }));
        return;
      }

      if (!payload.uid?.trim() || !payload.nick?.trim() || !payload.email?.trim() || (payload.password || "").length < 8) {
        setAuthFeedback({ type: "error", message: "입력값을 확인해주세요." });
        return;
      }

      if (!payload.verificationSent || payload.resendOnly) {
        api("/api/signup/request", {
          method: "POST",
          body: JSON.stringify({ userID: payload.uid.trim(), username: payload.nick.trim(), email: payload.email.trim(), password: payload.password })
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
        body: JSON.stringify({ userID: payload.uid.trim(), email: payload.email.trim(), code: payload.code.trim() })
      }).then((result) => {
        if (!result.success) {
          setAuthFeedback({ type: "error", message: result.message || "이메일 인증 확인에 실패했습니다." });
          return;
        }
        setAuthFeedback({ type: "success", message: result.message || "회원가입이 완료되었습니다." });
        setTimeout(() => navigate("/signin"), 500);
      }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "이메일 인증 확인 중 오류가 발생했습니다." }));
    }

    function submitPost(payload, reset) {
      const settings = boardManageData?.settings || null;
      if (!session?.loggedIn && !flagEnabled(settings?.allow_guest_post)) {
        setWriteFeedback({ type: "error", message: "이 보드는 로그인 사용자만 글을 작성할 수 있습니다." });
        return;
      }
      if (!payload.title?.trim()) {
        setWriteFeedback({ type: "error", message: "제목을 입력해주세요." });
        return;
      }
      if (!payload.content?.trim()) {
        setWriteFeedback({ type: "error", message: "본문을 입력해주세요." });
        return;
      }
      const categoryOptions = categoryOptionsFromSettings(settings);
      if (categoryOptions.length && !categoryOptions.includes(payload.category)) {
        setWriteFeedback({ type: "error", message: "사용할 수 없는 말머리입니다." });
        return;
      }
      if (!session?.loggedIn && (!payload.name?.trim() || !payload.password)) {
        setWriteFeedback({ type: "error", message: "비회원은 이름과 비밀번호를 입력해야 합니다." });
        return;
      }
      api("/api/posts/write", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result.success) {
            setWriteFeedback({ type: "error", message: result.message || "글 작성에 실패했습니다." });
            return;
          }
          reset?.();
          setWriteFeedback({ type: "success", message: "게시글이 등록되었습니다." });
          refreshBoards();
          refreshFeed();
          navigate(`/board/${encodeURIComponent(payload.gid)}`, true);
        })
        .catch((error) => setWriteFeedback({ type: "error", message: error.message || "글 작성 중 오류가 발생했습니다." }));
    }

    function submitComment(payload, reset) {
      const settings = boardManageData?.settings || null;
      if (!session?.loggedIn && !flagEnabled(settings?.allow_guest_comment)) {
        setCommentFeedback({ type: "error", message: "이 보드는 로그인 사용자만 댓글을 작성할 수 있습니다." });
        return;
      }
      if (!payload.content?.trim()) {
        setCommentFeedback({ type: "error", message: "댓글 내용을 입력해주세요." });
        return;
      }
      if (!session?.loggedIn && (!payload.name?.trim() || !payload.password)) {
        setCommentFeedback({ type: "error", message: "비회원은 이름과 비밀번호를 입력해야 합니다." });
        return;
      }
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
            setDeleteFeedback({ type: "error", message: result?.message || "게시글 삭제에 실패했습니다." });
            return;
          }
          reset?.();
          setDeleteFeedback({ type: "success", message: "게시글을 삭제했습니다." });
          navigate(`/board/${encodeURIComponent(payload.gid)}`, true);
        })
        .catch((error) => setDeleteFeedback({ type: "error", message: error.message || "게시글 삭제에 실패했습니다." }));
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
            setVoteFeedback({ type: "error", message: result?.message || "투표에 실패했습니다." });
            return;
          }
          setPostData((current) => ({
            ...current,
            post: current.post ? { ...current.post, ...(result.post || {}) } : current.post,
            voteState: result.voteState || current.voteState
          }));
          refreshFeed();
          setVoteFeedback({ type: "success", message: result?.message || "투표를 반영했습니다." });
        })
        .catch((error) => setVoteFeedback({ type: "error", message: error.message || "투표에 실패했습니다." }));
    }

    function refreshCurrentPost() {
      if (route.name !== "post") return;
      api(`/api/posts/get/${encodeURIComponent(route.params.gid)}/${encodeURIComponent(route.params.postNo)}`)
        .then((result) => {
          if (result?.success) {
            setPostData({ post: result.post, comments: Array.isArray(result.comments) ? result.comments : [], voteState: result.voteState || {} });
          }
        })
        .catch(() => {});
    }

    function scrapPost(post) {
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/scrap`, { method: "POST" })
        .then((result) => setVoteFeedback({ type: result?.success ? "success" : "error", message: result?.message || (result?.scrapped ? "스크랩했습니다." : "스크랩을 취소했습니다.") }))
        .catch((error) => setVoteFeedback({ type: "error", message: error.message || "스크랩에 실패했습니다." }));
    }

    function reportPost(post) {
      const reason = window.prompt("신고 사유를 입력해주세요.") || "";
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/report`, { method: "POST", body: JSON.stringify({ reason }) })
        .then((result) => setVoteFeedback({ type: result?.success ? "success" : "error", message: result?.message || "신고를 접수했습니다." }))
        .catch((error) => setVoteFeedback({ type: "error", message: error.message || "신고에 실패했습니다." }));
    }

    function likeComment(comment) {
      const commentId = comment.id || comment.comment_id;
      api(`/api/features/comments/${encodeURIComponent(commentId)}/like`, { method: "POST" })
        .then((result) => {
          setCommentFeedback({ type: result?.success ? "success" : "error", message: result?.message || "댓글 공감을 반영했습니다." });
          refreshCurrentPost();
        })
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 공감에 실패했습니다." }));
    }

    function reportComment(comment) {
      const commentId = comment.id || comment.comment_id;
      const reason = window.prompt("댓글 신고 사유를 입력해주세요.") || "";
      api(`/api/features/comments/${encodeURIComponent(commentId)}/report`, { method: "POST", body: JSON.stringify({ reason }) })
        .then((result) => setCommentFeedback({ type: result?.success ? "success" : "error", message: result?.message || "댓글 신고를 접수했습니다." }))
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 신고에 실패했습니다." }));
    }

    function cancelConcept(post) {
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/concept/cancel`, { method: "POST" })
        .then((result) => {
          setVoteFeedback({ type: result?.success ? "success" : "error", message: result?.message || "개념글을 취소했습니다." });
          refreshCurrentPost();
        })
        .catch((error) => setVoteFeedback({ type: "error", message: error.message || "개념글 취소에 실패했습니다." }));
    }

    function submitBoardSettings(payload) {
      if (!boardManageData?.permissions?.canManage) {
        setSettingsFeedback({ type: "error", message: "보드 설정을 변경할 권한이 없습니다." });
        return;
      }
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/settings`, {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((result) => {
        if (!result?.success) {
          setSettingsFeedback({ type: "error", message: result?.message || "설정 저장에 실패했습니다." });
          return;
        }
        setBoardManageData((current) => current ? { ...current, settings: result.data } : { settings: result.data, permissions: {} });
        setSettingsFeedback({ type: "success", message: "설정을 저장했습니다." });
      }).catch((error) => setSettingsFeedback({ type: "error", message: error.message || "설정 저장에 실패했습니다." }));
    }

    function submitProfileSettings(payload) {
      if (!profileData?.canEdit) {
        setProfileFeedback({ type: "error", message: "프로필 설정을 변경할 권한이 없습니다." });
        return;
      }
      api("/api/profile/me/settings", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result?.success) {
            setProfileFeedback({ type: "error", message: result?.message || "프로필 설정 저장에 실패했습니다." });
            return;
          }
          setProfileData(result.data || null);
          setProfileFeedback({ type: "success", message: "프로필을 저장했습니다." });
        })
        .catch((error) => setProfileFeedback({ type: "error", message: error.message || "프로필 설정 저장에 실패했습니다." }));
    }

    function followProfile(targetUid) {
      if (!session?.loggedIn) {
        setProfileFeedback({ type: "error", message: "로그인 후 팔로우할 수 있습니다." });
        return;
      }
      api(`/api/profile/${encodeURIComponent(targetUid)}/follow`, { method: "POST" })
        .then((result) => {
          if (!result?.success) {
            setProfileFeedback({ type: "error", message: result?.message || "팔로우에 실패했습니다." });
            return;
          }
          setProfileData(result.data || null);
          setProfileFeedback({ type: "success", message: "팔로우했습니다." });
        })
        .catch((error) => setProfileFeedback({ type: "error", message: error.message || "팔로우에 실패했습니다." }));
    }

    function unfollowProfile(targetUid) {
      api(`/api/profile/${encodeURIComponent(targetUid)}/unfollow`, { method: "POST" })
        .then((result) => {
          if (!result?.success) {
            setProfileFeedback({ type: "error", message: result?.message || "언팔로우에 실패했습니다." });
            return;
          }
          setProfileData(result.data || null);
          setProfileFeedback({ type: "success", message: "언팔로우했습니다." });
        })
        .catch((error) => setProfileFeedback({ type: "error", message: error.message || "언팔로우에 실패했습니다." }));
    }

    function submitSideBoardRequest(payload, reset) {
      if (!session?.loggedIn) {
        setBoardRequestFeedback({ type: "error", message: "로그인 후 요청할 수 있습니다." });
        return;
      }
      if (!payload.gallId?.trim() || !payload.gallName?.trim() || !payload.reason?.trim()) {
        setBoardRequestFeedback({ type: "error", message: "보드 ID, 이름, 요청 사유를 모두 입력해주세요." });
        return;
      }
      api("/api/board/request/side-board", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result?.success) {
            setBoardRequestFeedback({ type: "error", message: result?.message || "사이드 보드 요청에 실패했습니다." });
            return;
          }
          reset?.();
          setBoardRequestFeedback({ type: "success", message: result?.message || "사이드 보드 개설 요청을 보냈습니다." });
          if (session?.loggedIn) refreshAlarms();
        })
        .catch((error) => setBoardRequestFeedback({ type: "error", message: error.message || "사이드 보드 요청에 실패했습니다." }));
    }

    function acceptAlarm(alarmId) {
      if (!session?.loggedIn) {
        setAlarmFeedback({ type: "error", message: "로그인 후 알림을 처리할 수 있습니다." });
        return;
      }
      api(`/api/alarms/${encodeURIComponent(alarmId)}/accept`, { method: "POST" })
        .then((result) => {
          if (!result.success) {
            setAlarmFeedback({ type: "error", message: result.message || "알림 수락에 실패했습니다." });
            return;
          }
          setAlarmFeedback({ type: "success", message: "알림을 수락했습니다." });
          refreshAlarms();
          refreshBoards();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 수락 중 오류가 발생했습니다." }));
    }

    function rejectAlarm(alarmId) {
      if (!session?.loggedIn) {
        setAlarmFeedback({ type: "error", message: "로그인 후 알림을 처리할 수 있습니다." });
        return;
      }
      api(`/api/alarms/${encodeURIComponent(alarmId)}/reject`, { method: "POST" })
        .then((result) => {
          if (!result.success) {
            setAlarmFeedback({ type: "error", message: result.message || "알림 거절에 실패했습니다." });
            return;
          }
          setAlarmFeedback({ type: "success", message: "알림을 거절했습니다." });
          refreshAlarms();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 거절 중 오류가 발생했습니다." }));
    }

    function markAllAlarmsRead() {
      api("/api/features/notifications/read-all", { method: "POST" })
        .then((result) => {
          setAlarmFeedback({ type: result?.success ? "success" : "error", message: result?.message || "모든 알림을 읽음 처리했습니다." });
          refreshAlarms();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 읽음 처리에 실패했습니다." }));
    }

    if (route.name === "home") return h(HomeView, { session, boards, feed, onLogout: handleLogout, alarmCount });
    if (route.name === "boards") return h(BoardsView, { session, boards, query, onQueryChange: setQuery, onSubmitSideBoardRequest: submitSideBoardRequest, requestFeedback: boardRequestFeedback, onLogout: handleLogout, alarmCount });
    if (route.name === "board") return h(BoardView, { session, gid: route.params.gid, board: currentBoard, posts: boardPosts, page, manageData: boardManageData, settingsFeedback, onPrevPage: () => navigate(`/board/${encodeURIComponent(route.params.gid)}?page=${Math.max(1, page - 1)}`), onNextPage: () => navigate(`/board/${encodeURIComponent(route.params.gid)}?page=${page + 1}`), onLogout: handleLogout, alarmCount });
    if (route.name === "boardManage") return h(BoardManageView, { session, gid: route.params.gid, board: currentBoard, manageData: boardManageData, feedback: settingsFeedback, onSaveSettings: submitBoardSettings, onLogout: handleLogout, alarmCount });
    if (route.name === "post") return h(PostView, { session, gid: route.params.gid, post: postData.post, comments: postData.comments, feedback: commentFeedback, deleteFeedback, voteFeedback, voteState: postData.voteState, manageData: boardManageData, onSubmitComment: submitComment, onDeletePost: submitDeletePost, onDeleteComment: submitDeleteComment, onVote: submitVote, onScrapPost: scrapPost, onReportPost: reportPost, onLikeComment: likeComment, onReportComment: reportComment, onCancelConcept: cancelConcept, onLogout: handleLogout, alarmCount });
    if (route.name === "profile") return h(ProfileView, { session, profileData, feedback: profileFeedback, onSaveProfile: submitProfileSettings, onFollowProfile: followProfile, onUnfollowProfile: unfollowProfile, onLogout: handleLogout, alarmCount });
    if (route.name === "write") return h(WriteView, { session, gid: route.params.gid, feedback: writeFeedback, manageData: boardManageData, onSubmitPost: submitPost, onLogout: handleLogout, alarmCount });
    if (route.name === "login") return h(AuthView, { mode: "login", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    if (route.name === "signup") return h(AuthView, { mode: "signup", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    if (route.name === "alarms") return h(AlarmsView, { session, alarms, feedback: alarmFeedback, onAcceptAlarm: acceptAlarm, onRejectAlarm: rejectAlarm, onMarkAllRead: markAllAlarmsRead, onLogout: handleLogout, alarmCount });
    return h(NotFoundView, { session, onLogout: handleLogout, alarmCount });
  }

  const mount = document.getElementById("app") || document.getElementById("root");
  if (ReactDOM.createRoot) {
    ReactDOM.createRoot(mount).render(h(App));
  } else {
    ReactDOM.render(h(App), mount);
  }
})();
