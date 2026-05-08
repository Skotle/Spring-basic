(() => {
  const h = React.createElement;
  const { useEffect, useMemo, useRef, useState } = React;

  const MAX_IMAGE_UPLOAD_BYTES = 50 * 1024 * 1024;
  const isUnsafeMethod = (method) => ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "GET").toUpperCase());

  const randomRequestId = () => {
    const bytes = new Uint8Array(16);
    if (window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2, 18)}`;
  };

  const sha256Hex = async (text) => {
    const data = new TextEncoder().encode(text || "");
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  };

  const withSecurityEnvelope = async (url, options = {}) => {
    const method = String(options.method || "GET").toUpperCase();
    const multipart = options.body instanceof FormData;
    const headers = multipart
      ? { ...(options.headers || {}) }
      : { "Content-Type": "application/json", ...(options.headers || {}) };
    if (typeof window.secureFetch === "function") {
      return { ...options, method, headers };
    }
    if (!isUnsafeMethod(method) || !(url === "/login" || url.startsWith("/api/"))) {
      return { ...options, method, headers };
    }

    const timestamp = String(Date.now());
    const requestId = randomRequestId();
    const clientPath = `${window.location.pathname}${window.location.search || ""}`;
    const clientOrigin = window.location.origin;
    headers["X-Requested-With"] = "XMLHttpRequest";
    headers["X-Request-Id"] = requestId;
    headers["X-Request-Timestamp"] = timestamp;
    headers["X-Client-Path"] = clientPath;
    headers["X-Client-Origin"] = clientOrigin;
    headers["X-Client-Timezone"] = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    headers["X-Client-Language"] = navigator.language || "";

    if (multipart) {
      return { ...options, method, headers };
    }

    let payload = {};
    if (typeof options.body === "string" && options.body.trim()) {
      payload = JSON.parse(options.body);
    } else if (options.body && typeof options.body === "object") {
      payload = options.body;
    }
    const securedPayload = {
      ...payload,
      __security_request_id: requestId,
      __security_timestamp: timestamp,
      __security_path: clientPath,
      __security_method: method,
      __security_origin: clientOrigin,
      __security_timezone: headers["X-Client-Timezone"],
      __security_language: headers["X-Client-Language"]
    };
    const body = JSON.stringify(securedPayload);
    headers["X-Payload-Hash"] = await sha256Hex(body);
    return { ...options, method, headers, body };
  };

  const api = async (url, options = {}) => {
    const securedOptions = await withSecurityEnvelope(url, options);
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      ...securedOptions
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

  const SUBMANAGER_PERMISSION_FIELDS = [
    ["can_delete_post", "글 삭제"],
    ["can_delete_comment", "댓글 삭제"],
    ["can_manage_write", "글쓰기 관리"],
    ["can_manage_guest_penalty", "비회원 제재"],
    ["can_manage_tags", "말머리 관리"],
    ["can_manage_images", "이미지 관리"],
    ["can_manage_notice", "공지 관리"],
    ["can_manage_categories", "카테고리 관리"],
    ["can_manage_cover", "대문 관리"],
    ["can_ban_user", "사용자 차단"],
    ["can_manage_forbidden_word", "금칙어 관리"],
    ["can_bump_post", "글 끌올"],
    ["can_manage_concept", "개념글 관리"],
    ["can_manage_concept_cut", "개념컷 관리"],
    ["can_manage_submanager", "부매니저 관리"]
  ];
  const getSearchQueryFromLocation = () => (new URLSearchParams(window.location.search).get("q") || "").trim();
  const normalizeNickType = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return ["fixed", "fix", "f", "1", "true", "고정", "고정닉"].includes(normalized) ? "fixed" : "variable";
  };
  const nickTypeLabel = (value) => normalizeNickType(value) === "fixed" ? "고정" : "비고정";
  const normalizeBoardRole = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "manager") return "manager";
    if (normalized === "submanager") return "submanager";
    return "";
  };
  const boardRoleLabel = (value) => value === "manager" ? "M" : value === "submanager" ? "S" : "";
  const importantActionConfirm = (title, lines) => window.confirm(`${title}\n\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}`);

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

  const categoryOptionsFromSettings = (settings) => {
    if (Array.isArray(settings?.category_options_list)) {
      return settings.category_options_list.map((item) => String(item).trim()).filter(Boolean);
    }
    return String(settings?.category_options || "일반")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const flagEnabled = (value) => {
    if (value instanceof Boolean) return value.valueOf();
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (value == null) return true;
    const text = String(value).trim().toLowerCase();
    return text === "1" || text === "true" || text === "yes" || text === "on";
  };

  const boardWriteAccess = (session, settings, manageData) => {
    if (!manageData) {
      return {
        canWritePost: false,
        joinRequired: false,
        canParticipateBoard: false,
        label: "[잠김]"
      };
    }
    const permissions = manageData?.permissions || {};
    if (typeof permissions.canWritePost === "boolean") {
      return {
        canWritePost: permissions.canWritePost,
        joinRequired: !!permissions.joinRequired,
        canParticipateBoard: permissions.canParticipateBoard !== false,
        label: permissions.canWritePost ? (permissions.writePermissionLabel || "글쓰기 가능") : "[잠김]"
      };
    }
    const visibility = String(settings?.visibility || "public").trim().toLowerCase();
    const canParticipateBoard = visibility === "public" || !!permissions.isAdmin || !!permissions.isManager || !!permissions.isSubmanager;
    const joinRequired = visibility === "members" && !canParticipateBoard;
    const guestAllowed = flagEnabled(settings?.allow_guest_post);
    const canWritePost = canParticipateBoard && (!!session?.loggedIn || guestAllowed);
    const label = joinRequired
      ? "[잠김]"
      : !canParticipateBoard
        ? "[잠김]"
        : visibility === "members"
          ? "글쓰기: 보드 멤버만 가능"
          : guestAllowed
            ? "글쓰기: 비회원 포함 누구나 가능"
            : session?.loggedIn
              ? "글쓰기: 로그인 사용자 가능"
              : "[잠김]";
    return { canWritePost, joinRequired, canParticipateBoard, label };
  };

  const authorLabel = (item) => {
    if (!item) return "익명";
    if (item.writer_uid) return item.name || item.writer_uid;
    return item.name || "익명";
  };

  const normalizeMobilePathname = (pathname) => {
    const raw = String(pathname || "/m").split("?")[0].replace(/\/+$/, "") || "/m";
    return raw.split("/").map((segment) => segment.split(";")[0]).join("/") || "/m";
  };

  function matchRoute(pathname) {
    pathname = normalizeMobilePathname(pathname);
    if (pathname === "/m") return { name: "home", params: {} };
    if (pathname === "/m/signin") return { name: "login", params: {} };
    if (pathname === "/m/nid") return { name: "signup", params: {} };
    if (pathname === "/m/boards") return { name: "boards", params: {} };
    if (pathname === "/m/board-request") return { name: "boardRequest", params: {} };
    if (pathname === "/m/feed") return { name: "feed", params: {} };
    if (pathname === "/m/search") return { name: "search", params: {} };
    if (pathname === "/m/profile") return { name: "profile", params: {} };
    if (pathname === "/m/alarms") return { name: "alarms", params: {} };

    let match = pathname.match(/^\/m\/profile\/([^/]+)$/);
    if (match) return { name: "profile", params: { uid: decodeURIComponent(match[1]) } };

    match = pathname.match(/^\/m\/board\/([^/]+)\/manage$/);
    if (match) return { name: "boardManage", params: { gid: decodeURIComponent(match[1]) } };

    match = pathname.match(/^\/m\/board\/([^/]+)\/write$/);
    if (match) return { name: "write", params: { gid: decodeURIComponent(match[1]) } };

    match = pathname.match(/^\/m\/board\/([^/]+)\/([^/]+)$/);
    if (match) return { name: "post", params: { gid: decodeURIComponent(match[1]), postNo: decodeURIComponent(match[2]) } };

    match = pathname.match(/^\/m\/board\/([^/]+)$/);
    if (match) return { name: "board", params: { gid: decodeURIComponent(match[1]) } };

    return { name: "notFound", params: {} };
  }

  function navigate(path, replace = false) {
    if (isMobileServerRenderedPath(path)) {
      if (replace) window.location.replace(path);
      else window.location.assign(path);
      return;
    }
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    window.dispatchEvent(new Event("mobile:navigate"));
  }

  function isMobileServerRenderedPath(path) {
    const clean = String(path || "").split("#")[0];
    return clean === "/m/boards" || clean.startsWith("/m/boards?");
  }

  function MLink({ href, className, children }) {
    return h("a", {
      href,
      className,
      onClick(event) {
        if (!href.startsWith("/m") || isMobileServerRenderedPath(href)) return;
        event.preventDefault();
        navigate(href);
      }
    }, children);
  }

  function MFeedback({ feedback }) {
    if (!feedback) return null;
    return h("div", { className: feedback.type === "error" ? "m-feedback-error" : "m-feedback-success" }, feedback.message);
  }

  function MNickTypeBadge({ nickType, uid }) {
    const normalized = normalizeNickType(nickType);
    const className = `m-nick-type ${normalized === "fixed" ? "is-fixed" : "is-variable"}`;
    const label = nickTypeLabel(normalized);
    return uid
      ? h(MLink, { href: `/m/profile/${encodeURIComponent(uid)}`, className, title: `${uid} 프로필` }, label)
      : h("span", { className }, label);
  }

  function MRoleBadge({ role }) {
    const normalized = normalizeBoardRole(role);
    if (!normalized) return null;
    return h("span", {
      className: `m-board-role-icon is-${normalized}`,
      title: normalized === "manager" ? "매니저" : "부매니저"
    }, boardRoleLabel(normalized));
  }

  function MMemberIdentity({ item, name, uid, nickType, className = "m-member-identity" }) {
    const resolvedName = name || authorLabel(item) || uid || "익명";
    const resolvedUid = uid || item?.writer_uid || "";
    const resolvedNickType = nickType || item?.nick_type || item?.nickType || "variable";
    const resolvedRole = item?.author_board_role || item?.board_role || item?.role || "";
    return h("span", { className },
      h("span", { className: "m-member-name" }, resolvedName),
      resolvedRole ? h(MRoleBadge, { role: resolvedRole }) : (resolvedUid ? h(MNickTypeBadge, { nickType: resolvedNickType, uid: resolvedUid }) : null)
    );
  }

  function MSectionHead({ eyebrow, title, action }) {
    return h("div", { className: "m-section-head" },
      h("div", null,
        h("span", { className: "m-eyebrow" }, eyebrow),
        h("h2", { className: "m-section-title" }, title)
      ),
      action || null
    );
  }

  function MGuestFields({ name, password, setName, setPassword, prefix }) {
    return [
      h("div", { className: "m-field", key: `${prefix}-name` },
        h("label", { htmlFor: `${prefix}-name` }, "닉네임"),
        h("input", { id: `${prefix}-name`, type: "text", value: name, onChange: (event) => setName(event.target.value) })
      ),
      h("div", { className: "m-field", key: `${prefix}-pw` },
        h("label", { htmlFor: `${prefix}-pw` }, "비밀번호"),
        h("input", { id: `${prefix}-pw`, type: "password", value: password, onChange: (event) => setPassword(event.target.value) })
      )
    ];
  }

  function MEditorToolbar() {
    const tools = [
      { label: "굵게", command: "bold" },
      { label: "기울임", command: "italic" },
      { label: "제목", command: "formatBlock", value: "h2" },
      { label: "본문", command: "formatBlock", value: "p" },
      { label: "인용", command: "formatBlock", value: "blockquote" },
      { label: "목록", command: "insertUnorderedList" }
    ];
    return h("div", { className: "m-editor-toolbar" },
      tools.map((tool) =>
        h("button", {
          key: tool.label,
          type: "button",
          className: "m-tool-btn",
          onClick() {
            document.execCommand(tool.command, false, tool.value || null);
          }
        }, tool.label)
      )
    );
  }

  async function uploadImageFile(file, gallId = "") {
    if (!file) {
      throw new Error("업로드할 파일이 없습니다.");
    }
    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      throw new Error("이미지는 최대 50MB까지 업로드할 수 있습니다.");
    }
    const formData = new FormData();
    formData.append("file", file);
    if (gallId) {
      formData.append("gallId", gallId);
    }
    const result = await api("/api/upload/image", { method: "POST", body: formData });
    if (!result?.success || !result?.url) {
      throw new Error(result?.message || "이미지 업로드에 실패했습니다.");
    }
    return result.url;
  }

  function MHtmlEditor({ id, value, onChange, placeholder, gallId, canUploadImage = window.__mobileWriteCanUploadImage !== false }) {
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadFeedback, setUploadFeedback] = useState(null);
    const [imageUploading, setImageUploading] = useState(false);
    const resolvedGallId = gallId || window.location.pathname.split("/")[3] || "";

    useEffect(() => {
      if (editorRef.current && editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }, [value]);

    function insertImage(url) {
      if (!editorRef.current) return;

      const imageHtml = `<p><img src="${url}" alt="" /></p>`;

      editorRef.current.innerHTML =
          (editorRef.current.innerHTML || "") + imageHtml;

      onChange(editorRef.current.innerHTML);
    }

    async function uploadEditorImage(file) {
      if (!file) return;
      setUploadFeedback(null);
      if (!canUploadImage) {
        setUploadFeedback({ type: "error", message: "현재 권한에서는 이미지 첨부를 사용할 수 없습니다." });
        return;
      }
      setImageUploading(true);
      try {
        const imageUrl = await uploadImageFile(file, resolvedGallId);
        insertImage(imageUrl);
        setUploadFeedback({ type: "success", message: "이미지를 업로드했습니다." });
      } catch (error) {
        setUploadFeedback({ type: "error", message: error.message || "이미지 업로드에 실패했습니다." });
      } finally {
        setImageUploading(false);
      }
    }

    async function handleFileChange(event) {
      const file = event.target.files?.[0];
      try {
        await uploadEditorImage(file);
      } finally {
        event.target.value = "";
      }
    }

    async function handlePaste(event) {
      const items = Array.from(event.clipboardData?.items || []);
      const imageItem = items.find((item) => item.kind === "file" && String(item.type || "").startsWith("image/"));
      const file = imageItem?.getAsFile();
      if (!file) return;
      event.preventDefault();
      await uploadEditorImage(file);
    }

    return h("div", { className: "m-editor-shell" },
      h(MEditorToolbar),
      !canUploadImage ? h("div", { className: "m-feedback-error" }, "이미지 업로드 권한이 비활성화되어 있습니다.") : null,
      h(MFeedback, { feedback: uploadFeedback }),
      h("div", { className: canUploadImage ? "m-inline-actions" : "m-inline-actions is-upload-disabled" },
        h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => fileInputRef.current?.click(), disabled: imageUploading }, imageUploading ? "업로드 중" : "이미지")
      ),
      h("input", { ref: fileInputRef, type: "file", accept: "image/*", hidden: true, disabled: !canUploadImage, onChange: handleFileChange }),
      h("div", {
        id,
        ref: editorRef,
        className: "m-html-editor",
        contentEditable: true,
        suppressContentEditableWarning: true,
        "data-placeholder": placeholder,
        onInput(event) {
          onChange(event.currentTarget.innerHTML);
        },
        onPaste: handlePaste
      }),
      h("div", { className: "m-muted", style: { fontSize: "0.86rem" } }, "작성한 내용은 HTML 형식으로 저장됩니다.")
    );
  }

  function MobileTopbar({ session, onLogout, alarmCount = 0 }) {
    const [searchText, setSearchText] = useState(getSearchQueryFromLocation());
    const currentPath = normalizeMobilePathname(window.location.pathname);
    const lastBoardPath = window.sessionStorage.getItem("irisen:lastMobileBoard") || "/m/boards";
    const navItems = [
      { label: "홈", href: "/m", active: currentPath === "/m" },
      { label: "보드", href: "/m/boards", active: currentPath === "/m/boards" || currentPath.startsWith("/m/board/") },
      { label: "피드", href: "/m/feed", active: currentPath === "/m/feed" },
      { label: session?.loggedIn ? "프로필" : "로그인", href: session?.loggedIn ? "/m/profile" : "/m/signin", active: currentPath === "/m/profile" || currentPath.startsWith("/m/profile/") || currentPath === "/m/signin" },
      { label: session?.loggedIn ? (alarmCount > 0 ? `알림 ${alarmCount}` : "알림") : "가입", href: session?.loggedIn ? "/m/alarms" : "/m/nid", active: currentPath === "/m/alarms" || currentPath === "/m/nid" }
    ];

    useEffect(() => {
      setSearchText(getSearchQueryFromLocation());
    }, [window.location.pathname, window.location.search]);

    return h("header", { className: "m-topbar" },
      h("form", {
        className: "m-top-searchbar",
        onSubmit(event) {
          event.preventDefault();
          const q = searchText.trim();
          navigate(q ? `/m/search?q=${encodeURIComponent(q)}` : "/m/boards");
        }
      },
      h(MLink, { href: "/m", className: "m-mobile-logo", "aria-label": "모바일 홈" }, "Irisen"),
      h("div", { className: "m-search-panel" },
        h("button", { type: "button", className: "m-menu-btn", "aria-label": "보드 목록", onClick: () => navigate("/m/boards") }, h("span"), h("span"), h("span")),
        h("input", {
          className: "m-search-input",
          type: "search",
          value: searchText,
          placeholder: "보드와 게시글 검색",
          onChange: (event) => setSearchText(event.target.value)
        }),
        h("button", { type: "submit", className: "m-search-submit", "aria-label": "검색" }, h("span", { className: "m-search-symbol", "aria-hidden": "true" })),
        h(MLink, { href: session?.loggedIn ? lastBoardPath : "/m/signin", className: "m-recent-visit" }, session?.loggedIn ? "최근 보드" : "로그인")
      )),
      h("nav", { className: "m-primary-tabs", "aria-label": "모바일 주요 메뉴" },
        navItems.map((item) => h(MLink, { key: item.label, href: item.href, className: item.active ? "is-active" : "" }, item.label))
      ),
      h("div", { className: "m-session-strip" },
        session?.loggedIn
          ? [
              h("span", { className: "m-session-name", key: "nick" }, h(MMemberIdentity, { name: session.nick || session.uid, uid: session.uid, nickType: session.nickType })),
              h("button", { type: "button", className: "m-session-link", key: "logout", onClick: onLogout }, "로그아웃")
            ]
          : [
              h(MLink, { href: "/m/signin", className: "m-session-link", key: "login" }, "로그인"),
              h(MLink, { href: "/m/nid", className: "m-session-link", key: "signup" }, "가입")
            ]
      )
    );
  }

  function HomeView({ session, boards, feed, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack" },
        h("section", { className: "m-hero m-card" },
          h("span", { className: "m-eyebrow" }, "Mobile"),
          h("h3", { className: "m-title" }, "irisen.com", h("br"), h("span", null, "pink archive"), h("br"), "since 2025"),
          h("p", { className: "m-copy" }, "Arcte stringe et fruere."),
          h("div", { className: "m-inline", style: { marginTop: "16px" } },
            h(MLink, { href: "/m/boards", className: "m-btn m-btn-primary" }, "보드 보기"),
            h(MLink, { href: "/m/feed", className: "m-btn m-btn-secondary" }, "피드 보기")
          ),
          h("div", { className: "m-stats" },
            h("div", { className: "m-stat" }, h("strong", null, boards.length), h("span", { className: "m-muted" }, "boards")),
            h("div", { className: "m-stat" }, h("strong", null, feed.length), h("span", { className: "m-muted" }, "recent")),
            h("div", { className: "m-stat" }, h("strong", null, session?.loggedIn ? "MEMBER" : "GUEST"), h("span", { className: "m-muted" }, "mode"))
          )
        ),
        h("section", { className: "m-panel m-stack" },
          h(MSectionHead, { eyebrow: "Feed", title: "최근 글" }),
          feed.length
            ? feed.slice(0, 8).map((post) =>
                h(MLink, { href: `/m/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, className: "m-feed-card", key: `${post.gall_id}-${post.post_no}` },
                  h("div", { className: "m-meta m-muted" }, h("span", null, post.gall_name || post.gall_id), h("span", null, formatDate(post.writed_at || post.created_at))),
                  h("div", { className: "m-feed-title" }, post.title || "제목 없음"),
                  h("div", { className: "m-meta m-muted" }, h(MMemberIdentity, { item: post }))
                )
              )
            : h("div", { className: "m-empty" }, "최근 글이 없습니다.")
        )
      )
    );
  }

  function FeedView({ session, feed, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack" },
        h("section", { className: "m-panel m-stack" },
          h(MSectionHead, { eyebrow: "Feed", title: "피드" }),
          feed.length
            ? feed.map((post) =>
                h(MLink, { href: `/m/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, className: "m-feed-card", key: `${post.gall_id}-${post.post_no}` },
                  h("div", { className: "m-meta m-muted" }, h("span", { className: "m-chip" }, post.gall_name || post.gall_id), h("span", null, formatDate(post.writed_at || post.created_at))),
                  h("div", { className: "m-feed-title" }, post.title || "제목 없음"),
                  h("div", { className: "m-meta m-muted" }, h(MMemberIdentity, { item: post }))
                )
              )
            : h("div", { className: "m-empty" }, "표시할 피드가 없습니다.")
        )
      )
    );
  }

  function SearchView({ session, boards, posts, searchQuery, onLogout, alarmCount }) {
    const q = (searchQuery || "").trim().toLowerCase();
    const boardMatches = q
      ? boards.filter((board) =>
          String(board?.gall_id || "").toLowerCase().includes(q) ||
          String(board?.gall_name || "").toLowerCase().includes(q)
        ).slice(0, 10)
      : [];

    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack" },
        h("section", { className: "m-panel m-stack" },
          h(MSectionHead, { eyebrow: "Search", title: q ? `검색: ${searchQuery}` : "통합 검색" }),
          !q ? h("div", { className: "m-empty" }, "검색어를 입력해 주세요.") : null,
          q && boardMatches.length
            ? h("div", { className: "m-stack" },
                boardMatches.map((board) =>
                  h(MLink, { href: `/m/board/${encodeURIComponent(board.gall_id)}`, className: "m-board-card", key: `search-board-${board.gall_id}` },
                    h("div", { className: "m-board-title" }, board.gall_name || board.gall_id),
                    h("div", { className: "m-meta m-muted" }, h("span", null, board.gall_id), h("span", null, `${board.post_count ?? 0} posts`))
                  )
                )
              )
            : q ? h("div", { className: "m-empty" }, "일치하는 보드가 없습니다.") : null,
          q && posts.length
            ? h("div", { className: "m-stack" },
                posts.map((post) =>
                  h(MLink, { href: `/m/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, className: "m-post-row", key: `search-post-${post.gall_id}-${post.post_no}` },
                    h("div", { className: "m-post-title" }, post.title || "제목 없음"),
                    h("div", { className: "m-meta m-muted" },
                      h("span", null, post.gall_name || post.gall_id),
                      h(MMemberIdentity, { item: post }),
                      h("span", null, formatDate(post.writed_at || post.created_at))
                    )
                  )
                )
              )
            : q ? h("div", { className: "m-empty" }, "일치하는 게시글이 없습니다.") : null
        )
      )
    );
  }

  function BoardsView({ session, boards, query, onChangeQuery, onLogout, alarmCount }) {
    const [boardType, setBoardType] = useState("all");
    const mainBoards = boards.filter((board) => String(board.gall_type || "").toLowerCase() === "main");
    const sideBoards = boards.filter((board) => String(board.gall_type || "").toLowerCase() === "m");
    const visibleSource = boardType === "main" ? mainBoards : boardType === "side" ? sideBoards : boards;
    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      return visibleSource.filter((board) => {
        const haystack = [
          board.gall_id,
          board.gall_name,
          board.topic_id,
          board.topic_name,
          board.board_tags
        ].map((value) => String(value || "").toLowerCase()).join(" ");
        return !q || haystack.includes(q);
      });
    }, [visibleSource, query]);
    const topicGroups = filtered.reduce((groups, board) => {
      const topicId = String(board.topic_id || "other");
      const topicName = String(board.topic_name || board.topic_id || "기타");
      let group = groups.find((item) => item.topicId === topicId);
      if (!group) {
        group = { topicId, topicName, boards: [] };
        groups.push(group);
      }
      group.boards.push(board);
      return groups;
    }, []);
    const boardLink = (board) => `/m/board/${encodeURIComponent(board.gall_id)}`;

    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-category-page" },
        h("section", { className: "m-category-intro" },
          h(MLink, { href: "/m/boards", className: "m-under-link" }, "Irisen 보드"),
          h(MLink, { href: session?.loggedIn ? "/m/board-request" : "/m/signin", className: "m-create-board-btn" }, "개설 신청")
        ),
        h("section", { className: "m-running-board" }, h("strong", null, "운영 중 보드 "), h("span", null, `(${boards.length})`)),
        session?.loggedIn
          ? h("section", { className: "m-category-note" }, h(MMemberIdentity, { name: session.nick || session.uid, uid: session.uid, nickType: session.nickType }), " 계정으로 이용 중입니다.")
          : h("section", { className: "m-category-note" }, h(MLink, { href: "/m/signin" }, "로그인 후 이용 가능합니다.")),
        h("section", { className: "m-board-promo" },
          h("strong", null, "모바일 보드 탐색"),
          h("p", null, "메인 보드와 사이드 보드를 빠르게 나눠 볼 수 있습니다.")
        ),
        h("section", { className: "m-board-directory" },
          h("div", { className: "m-directory-head" },
            h("strong", null, "통합 보드"),
            h("button", { type: "button", className: boardType === "all" ? "m-mini-more is-active" : "m-mini-more", onClick: () => setBoardType("all") }, "전체"),
            h("button", { type: "button", className: boardType === "main" ? "m-mini-more is-active" : "m-mini-more", onClick: () => setBoardType("main") }, "메인"),
            h("button", { type: "button", className: boardType === "side" ? "m-mini-more is-active" : "m-mini-more", onClick: () => setBoardType("side") }, "사이드")
          ),
          h("input", { className: "m-directory-search", type: "search", value: query, placeholder: "보드 이름 또는 ID", onChange: (event) => onChangeQuery(event.target.value) }),
          filtered.length
            ? h("div", { className: "m-board-topic-groups" },
                topicGroups.map((group) =>
                  h("section", { className: "m-board-topic-group", key: group.topicId },
                    h("div", { className: "m-board-topic-head" },
                      h("strong", null, group.topicName),
                      h("span", null, `${group.boards.length}개`)
                    ),
                    h("div", { className: "m-board-topic-links" },
                      group.boards.map((board) =>
                        h(MLink, {
                          href: boardLink(board),
                          className: "m-board-line",
                          key: board.gall_id,
                          title: `${board.gall_id} · ${board.post_count ?? 0} posts`
                        }, h("strong", null, board.gall_name || board.gall_id))
                      )
                    )
                  )
                )
              )
            : h("div", { className: "m-empty" }, "검색 결과가 없습니다.")
        )
      )
    );
  }

  function BoardRequestView({ session, feedback, boardDashboard, onSubmitRequest, onLogout, alarmCount }) {
    const [gallId, setGallId] = useState("");
    const [gallName, setGallName] = useState("");
    const [topicId, setTopicId] = useState("");
    const [boardTopics, setBoardTopics] = useState([]);
    const [reason, setReason] = useState("");
    const normalizedGallId = gallId.trim().toLowerCase();
    const canSubmit = !!session?.loggedIn && /^[a-z0-9_-]{3,50}$/.test(normalizedGallId) && gallName.trim().length >= 2 && !!topicId && reason.trim().length >= 10;
    const requestedBoards = Array.isArray(boardDashboard?.requestedBoards) ? boardDashboard.requestedBoards : [];
    const managedBoards = Array.isArray(boardDashboard?.managedBoards) ? boardDashboard.managedBoards : [];
    const statusLabel = (status) => {
      const normalized = String(status || "").toLowerCase();
      if (normalized === "approved") return "승인";
      if (normalized === "rejected") return "반려";
      if (normalized === "pending") return "대기";
      return status || "상태 없음";
    };
    const roleLabel = (role) => String(role || "").toLowerCase() === "manager" ? "매니저" : "부매니저";

    useEffect(() => {
      let active = true;
      api("/api/board/topics")
        .then((result) => {
          if (!active) return;
          const topics = result?.success && Array.isArray(result.topics) ? result.topics : [];
          setBoardTopics(topics);
          setTopicId((current) => current || topics[0]?.topic_id || "");
        })
        .catch(() => {
          if (active) setBoardTopics([]);
        });
      return () => {
        active = false;
      };
    }, []);

    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-request-page" },
        h("section", { className: "m-request-head" },
          h("span", { className: "m-eyebrow" }, "Board Request"),
          h("h1", null, "사이드 보드 개설 신청"),
          h("p", null, "보드 ID, 이름, 목적을 입력하면 운영 검토 요청이 전달됩니다.")
        ),
        h("section", { className: "m-request-spec" },
          h("strong", null, "요청 규칙"),
          h("ul", null,
            h("li", null, "보드 ID: 3~50자의 영소문자, 숫자, _, -"),
            h("li", null, "보드 이름: 2자 이상"),
            h("li", null, "요청 사유: 10자 이상"),
            h("li", null, "로그인한 사용자만 요청 가능")
          )
        ),
        session?.loggedIn ? h("section", { className: "m-request-form m-stack" },
          h("strong", null, "내 보드 현황"),
          h("div", { className: "m-stack" },
            h("div", { className: "m-eyebrow" }, "요청 중"),
            requestedBoards.length
              ? requestedBoards.map((board) => h("div", { className: "m-card", key: `requested-${board.request_id}` },
                  h("strong", null, board.gall_name || board.gall_id),
                  h("p", null, `${board.gall_id || "-"} · ${board.topic_name || board.topic_id || "주제 없음"}`),
                  h("span", { className: "m-chip" }, statusLabel(board.status))
                ))
              : h("div", { className: "m-empty" }, "요청 중인 보드가 없습니다."),
            h("div", { className: "m-eyebrow" }, "관리 중"),
            managedBoards.length
              ? managedBoards.map((board) => h(MLink, { href: `/m/board/${encodeURIComponent(board.gall_id)}/manage`, className: "m-card", key: `managed-${board.board_role}-${board.gall_id}` },
                  h("strong", null, board.gall_name || board.gall_id),
                  h("p", null, `${board.gall_id || "-"} · ${board.topic_name || board.topic_id || "주제 없음"}`),
                  h("span", { className: "m-chip" }, roleLabel(board.board_role))
                ))
              : h("div", { className: "m-empty" }, "관리 중인 보드가 없습니다.")
          )
        ) : null,
        !session?.loggedIn
          ? h("section", { className: "m-feedback-error" }, "로그인해야 보드 개설 요청을 보낼 수 있습니다.")
          : h("section", { className: "m-request-form m-stack" },
              h("div", { className: "m-field" }, h("label", { htmlFor: "m-request-gall-id" }, "보드 ID"), h("input", { id: "m-request-gall-id", type: "text", value: gallId, onChange: (event) => setGallId(event.target.value.toLowerCase()) })),
              h("div", { className: "m-field" }, h("label", { htmlFor: "m-request-gall-name" }, "보드 이름"), h("input", { id: "m-request-gall-name", type: "text", value: gallName, onChange: (event) => setGallName(event.target.value) })),
              h("div", { className: "m-field" },
                h("label", { htmlFor: "m-request-topic" }, "주제"),
                h("select", { id: "m-request-topic", value: topicId, onChange: (event) => setTopicId(event.target.value) },
                  h("option", { value: "" }, "주제를 선택하세요"),
                  boardTopics.map((topic) => h("option", { key: topic.topic_id, value: topic.topic_id }, topic.topic_name || topic.topic_id))
                ),
                h("small", null, "개설 이후 변경할 수 없습니다.")
              ),
              h("div", { className: "m-field" }, h("label", { htmlFor: "m-request-reason" }, "요청 사유"), h("textarea", { id: "m-request-reason", rows: 7, value: reason, onChange: (event) => setReason(event.target.value) })),
              h(MFeedback, { feedback }),
              h("button", {
                type: "button",
                className: canSubmit ? "m-btn m-btn-primary" : "m-btn m-btn-secondary",
                disabled: !canSubmit,
                onClick() {
                  onSubmitRequest({ gallId: normalizedGallId, gallName: gallName.trim(), topicId, reason: reason.trim() }, () => {
                    setGallId("");
                    setGallName("");
                    setTopicId(boardTopics[0]?.topic_id || "");
                    setReason("");
                  });
                }
              }, "개설 신청 보내기")
            ),
        h(MLink, { href: "/m/boards", className: "m-btn m-btn-secondary" }, "보드 목록으로")
      )
    );
  }

  function BoardView({ session, gid, board, posts, page, settings, manageData, listFeedback, onPrev, onNext, onLogout, alarmCount }) {
    const [selectedCategory, setSelectedCategory] = useState("전체");
    const [listMode, setListMode] = useState("all");
    const configuredCategories = categoryOptionsFromSettings(settings);
    const postCategories = posts.map((post) => String(post.category || "").trim()).filter(Boolean);
    const categories = ["전체", ...Array.from(new Set([...configuredCategories, ...postCategories]))];
    const parsedConceptThreshold = Number(settings?.concept_recommend_threshold || settings?.concept_threshold);
    const conceptThreshold = Number.isFinite(parsedConceptThreshold) && parsedConceptThreshold > 0 ? parsedConceptThreshold : 10;
    const isConceptPost = (post) => Number(post.is_concept || post.concept || 0) === 1;
    const isNoticePost = (post) => Number(post.notice || post.is_notice || 0) === 1;
    const filteredPosts = posts.filter((post) => {
      const matchesCategory = selectedCategory === "전체" || String(post.category || "일반") === selectedCategory;
      const matchesMode = listMode === "all" || (listMode === "concept" && isConceptPost(post)) || (listMode === "notice" && isNoticePost(post));
      return matchesCategory && matchesMode;
    });
    const visiblePosts = filteredPosts.slice(0, 15);
    const boardName = board ? board.gall_name : gid;
    const boardInitial = String(board?.gall_name || gid || "I").trim().charAt(0).toUpperCase();
    const permissions = manageData?.permissions || {};
    const manager = manageData?.manager || null;
    const submanagers = Array.isArray(manageData?.submanagers) ? manageData.submanagers : [];
    const writeAccess = boardWriteAccess(session, settings, manageData);
    const isMainBoard = String(board?.gall_type || "").trim().toLowerCase() === "main";
    const boardIntro = settings?.welcome_message || `${boardName} 모바일 게시판입니다.`;
    const boardHeadline = settings?.board_notice || boardIntro;
    const boardSubcopy = settings?.board_notice && settings?.welcome_message
      ? settings.welcome_message
      : "말머리를 선택해서 원하는 글만 빠르게 볼 수 있습니다.";
    const staffSummaryLines = isMainBoard
      ? [settings?.board_notice || settings?.welcome_message || "등록된 보드 정보가 없습니다."]
      : [
          settings?.board_notice || settings?.welcome_message || "등록된 보드 정보가 없습니다.",
          "",
          manager
            ? `매니저: ${manager.nick && manager.nick !== manager.uid ? `${manager.nick} (${manager.uid})` : (manager.uid || manager.nick)}`
            : "매니저: 미지정",
          submanagers.length
            ? `부매니저: ${submanagers.map((user) => user.nick && user.nick !== user.uid ? `${user.nick} (${user.uid})` : (user.uid || user.nick)).join(", ")}`
            : "부매니저: 없음"
        ].filter((line, index, array) => line || (index > 0 && array[index - 1]));

    useEffect(() => {
      if (!categories.includes(selectedCategory)) setSelectedCategory("전체");
    }, [gid, categories.join("|")]);

    useEffect(() => {
      window.sessionStorage.setItem("irisen:lastMobileBoard", `/m/board/${encodeURIComponent(gid)}`);
    }, [gid]);

    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-board-screen" },
        h(MFeedback, { feedback: listFeedback }),
        h("section", { className: "m-board-titlebar" },
          h("div", { className: "m-board-title-main" },
            h("h1", { className: "m-board-name" }, boardName),
            h("span", { className: "m-board-type" }, String(board?.gall_type || "m").toUpperCase()),
            h("span", { className: "m-board-count" }, `(${posts.length.toLocaleString("ko-KR")})`)
          ),
          h("div", { className: "m-board-title-actions" },
            h("button", { type: "button", className: "m-info-dot", onClick: () => window.alert(staffSummaryLines.join("\n")) }, "i"),
            permissions.canManage && (!isMainBoard || permissions.isAdmin) ? h(MLink, { href: `/m/board/${encodeURIComponent(gid)}/manage`, className: "m-manage-outline" }, "관리") : null,
            writeAccess.canWritePost
              ? h(MLink, { href: `/m/board/${encodeURIComponent(gid)}/write`, className: "m-write-outline" }, "글쓰기")
              : h("button", { type: "button", className: "m-write-outline is-disabled", disabled: true, title: writeAccess.label }, "글쓰기")
          )
        ),
        !writeAccess.canWritePost
          ? h("section", { className: writeAccess.joinRequired ? "m-feedback-error" : "m-muted", style: { marginTop: "10px" } },
              writeAccess.label,
              writeAccess.joinRequired && session?.loggedIn
                ? h(MLink, { href: `/board/${encodeURIComponent(gid)}/join`, className: "m-btn m-btn-secondary", style: { marginLeft: "8px" } }, "가입")
                : null
            )
          : null,
        h("section", { className: `m-board-hero${settings?.cover_image_url ? " has-cover" : ""}` },
          settings?.cover_image_url ? h("img", { className: "m-board-hero-image", src: settings.cover_image_url, alt: `${boardName} cover` }) : null,
          h("div", { className: "m-board-hero-overlay" }),
          h("div", { className: "m-board-hero-content" },
            h("div", { className: "m-board-hero-badge" }, boardInitial),
            h("div", { className: "m-board-hero-copy" },
              h("span", { className: "m-board-hero-kicker" }, `${String(board?.gall_type || "m").toUpperCase()} BOARD`),
              h("strong", { className: "m-board-hero-title" }, boardName),
              h("p", { className: "m-board-hero-headline" }, boardHeadline),
              h("p", { className: "m-board-hero-subcopy" }, boardSubcopy)
            )
          )
        ),
        h("section", { className: "m-board-notice-card" },
          settings?.cover_image_url
            ? h("img", { className: "m-board-cover-image", src: settings.cover_image_url, alt: `${boardName} cover` })
            : h("div", { className: "m-board-notice-logo" }, boardInitial),
          h("div", null,
            h("strong", null, settings?.board_notice || settings?.welcome_message || `${board ? board.gall_name : gid} 모바일 게시판입니다.`),
            h("span", null, settings?.welcome_message && settings?.board_notice ? settings.welcome_message : "말머리를 선택해서 원하는 글만 빠르게 볼 수 있습니다.")
          ),
          h("button", { type: "button", className: "m-info-float", onClick: () => window.alert(staffSummaryLines.join("\n")) }, "i")
        ),
        h("section", { className: "m-board-tabs", "aria-label": "글 목록 종류" },
          h("button", { type: "button", className: listMode === "all" ? "is-active" : "", onClick: () => setListMode("all") }, "전체"),
          h("button", { type: "button", className: listMode === "concept" ? "is-active" : "", onClick: () => setListMode("concept") }, "개념글"),
          h("button", { type: "button", className: listMode === "notice" ? "is-active" : "", onClick: () => setListMode("notice") }, "공지"),
          h("button", { type: "button", className: "m-tab-count", onClick: () => setListMode("all") }, `${filteredPosts.length}개`)
        ),
        h("section", { className: "m-category-strip", "aria-label": "말머리 목록" },
          categories.map((category) =>
            h("button", {
              key: category,
              type: "button",
              className: selectedCategory === category ? "is-active" : "",
              onClick: () => setSelectedCategory(category)
            }, category)
          )
        ),
        h("section", { className: "m-compact-list" },
          visiblePosts.length
            ? visiblePosts.map((post) =>
                h(MLink, { href: `/m/board/${encodeURIComponent(gid)}/${post.post_no}`, className: "m-compact-post", key: `${gid}-${post.post_no}` },
                  h("div", { className: "m-compact-main" },
                    h("span", { className: "m-compact-no" }, post.post_no),
                    h("span", { className: "m-compact-category" }, post.category || "일반"),
                    h("strong", { className: "m-compact-title" }, post.title || "제목 없음"),
                    Number(post.comment_count || 0) > 0 ? h("span", { className: "m-compact-comments" }, post.comment_count) : null
                  ),
                  h("div", { className: "m-compact-meta" },
                    h(MMemberIdentity, { item: post }),
                    h("span", null, formatDate(post.writed_at || post.created_at || post.reg_date)),
                    isConceptPost(post) ? h("span", { className: "m-concept-mark" }, "개념") : null
                  )
                )
              )
            : h("div", { className: "m-empty" }, listMode === "concept" ? "조건에 맞는 개념글이 없습니다." : "게시글이 없습니다."),
          filteredPosts.length > 15 ? h("div", { className: "m-list-note" }, "모바일 화면에는 현재 페이지에서 15개까지 표시합니다.") : null
        ),
        h("section", { className: "m-board-bottom" },
          h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: onPrev }, "이전"),
          h("span", { className: "m-chip" }, `page ${page}`),
          h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: onNext }, "다음")
        )
      )
    );
  }

  function MPendingStaffRequestList({ requests = [] }) {
    return h("section", { className: "m-panel m-stack" },
      h(MSectionHead, { eyebrow: "Pending", title: "임명 대기 목록" }),
      requests.length
        ? requests.map((request) =>
            h("article", { className: "m-panel m-stack m-staff-card", key: `pending-${request.alarm_id}` },
              h("strong", null, request.role === "manager" ? "매니저 위임 요청" : "부매니저 임명 요청"),
              h("div", { className: "m-muted" }, request.display_name || request.target_nick || request.target_uid || "대상 미지정"),
              h("div", { className: "m-muted" }, `요청자 ${request.requester_nick && request.requester_nick !== request.requester_uid ? `${request.requester_nick} (${request.requester_uid})` : (request.requester_uid || request.requester_nick || "정보 없음")}`),
              h("div", { className: "m-muted" }, formatDate(request.created_at))
            )
          )
        : h("div", { className: "m-empty" }, "현재 대기 중인 임명 요청이 없습니다.")
    );
  }

  function MSubmanagerPermissionPanel({ submanagers = [], permissions = {}, feedback, onSave, onAppoint, onRevoke, onTransfer }) {
    const [drafts, setDrafts] = useState({});
    const [appointUid, setAppointUid] = useState("");
    const [transferUid, setTransferUid] = useState("");
    const canAssign = !!permissions.canAssignSubmanager || !!permissions.isAdmin;
    const canEdit = canAssign || !!permissions.canManageSubmanager;
    const canTransfer = !!permissions.canTransferManager || !!permissions.isAdmin;

    useEffect(() => {
      const nextDrafts = {};
      submanagers.forEach((sub) => {
        nextDrafts[sub.uid] = Object.fromEntries(SUBMANAGER_PERMISSION_FIELDS.map(([key]) => [key, flagEnabled(sub[key])]));
      });
      setDrafts(nextDrafts);
    }, [submanagers.map((sub) => `${sub.uid}:${SUBMANAGER_PERMISSION_FIELDS.map(([key]) => sub[key]).join(",")}`).join("|")]);

    return h("section", { className: "m-panel m-stack" },
      h(MSectionHead, { eyebrow: "Staff", title: "운영진 관리" }),
      canAssign ? h("div", { className: "m-field" },
        h("label", { htmlFor: "m-staff-appoint-uid" }, "부매니저 임명 UID"),
        h("div", { className: "m-inline" },
          h("input", { id: "m-staff-appoint-uid", type: "text", value: appointUid, onChange: (event) => setAppointUid(event.target.value) }),
          h("button", { type: "button", className: "m-btn m-btn-primary", onClick: () => appointUid.trim() && onAppoint(appointUid.trim(), () => setAppointUid("")) }, "임명 요청")
        )
      ) : null,
      canTransfer ? h("div", { className: "m-field" },
        h("label", { htmlFor: "m-staff-transfer-uid" }, "매니저 위임 UID"),
        h("div", { className: "m-inline" },
          h("input", { id: "m-staff-transfer-uid", type: "text", value: transferUid, onChange: (event) => setTransferUid(event.target.value) }),
          h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => transferUid.trim() && onTransfer(transferUid.trim(), () => setTransferUid("")) }, "위임 요청")
        )
      ) : null,
      submanagers.length
        ? submanagers.map((sub) =>
            h("article", { className: "m-panel m-stack m-staff-card", key: sub.uid },
              h("strong", null, sub.nick && sub.nick !== sub.uid ? `${sub.nick} (${sub.uid})` : (sub.uid || sub.nick)),
              h("div", { className: "m-staff-permission-grid" },
                SUBMANAGER_PERMISSION_FIELDS.map(([key, label]) =>
                  h("label", { className: "m-check-row", key: `${sub.uid}-${key}` },
                    h("input", {
                      type: "checkbox",
                      disabled: !canEdit,
                      checked: !!drafts[sub.uid]?.[key],
                      onChange: (event) => setDrafts((current) => ({
                        ...current,
                        [sub.uid]: { ...(current[sub.uid] || {}), [key]: event.target.checked }
                      }))
                    }),
                    h("span", null, label)
                  )
                )
              ),
              h("div", { className: "m-inline" },
                canEdit ? h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => onSave(sub.uid, drafts[sub.uid] || {}) }, "권한 저장") : null,
                canAssign ? h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => onRevoke(sub.uid) }, "해임") : null
              )
            )
          )
        : h("div", { className: "m-empty" }, "등록된 부매니저가 없습니다."),
      h(MFeedback, { feedback })
    );
  }

  function MBoardManageView({ session, gid, board, manageData, feedback, onSaveSubmanagerPermissions, onAppointSubmanager, onRevokeSubmanager, onTransferManager, onLogout, alarmCount }) {
    const permissions = manageData?.permissions || {};
    const pendingRequests = Array.isArray(manageData?.pendingStaffRequests) ? manageData.pendingStaffRequests : [];
    const submanagers = Array.isArray(manageData?.submanagers) ? manageData.submanagers : [];
    const canOpen = !!permissions.canAssignSubmanager || !!permissions.canManageSubmanager || !!permissions.isAdmin;
    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack" },
        h("section", { className: "m-card m-stack" },
          h(MSectionHead, { eyebrow: "Manage", title: `${board?.gall_name || gid} 관리`, action: h(MLink, { href: `/m/board/${encodeURIComponent(gid)}`, className: "m-btn m-btn-secondary" }, "보드") }),
          canOpen
            ? h(React.Fragment, null,
              h(MPendingStaffRequestList, { requests: pendingRequests }),
              h(MSubmanagerPermissionPanel, {
                submanagers,
                permissions,
                feedback,
                onSave: onSaveSubmanagerPermissions,
                onAppoint: onAppointSubmanager,
                onRevoke: onRevokeSubmanager,
                onTransfer: onTransferManager
              })
            )
            : h("div", { className: "m-feedback-error" }, "운영진을 관리할 권한이 없습니다.")
        )
      )
    );
  }

  function PostView({ session, gid, postNo, post, comments, feedback, voteFeedback, voteState, settings, manageData, onSubmitComment, onDeletePost, onDeleteComment, onVote, onScrapPost, onReportPost, onLikeComment, onReportComment, onLogout, alarmCount }) {
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    const [replyTarget, setReplyTarget] = useState(null);
    const writeAccess = boardWriteAccess(session, settings, manageData);
    const canParticipate = writeAccess.canParticipateBoard !== false;
    const canUpvote = canParticipate && voteState?.canUpvote !== false;
    const canDownvote = canParticipate && voteState?.canDownvote !== false;
    const voteStatus = !canUpvote && !canDownvote
      ? "오늘 추천과 비추천을 모두 사용했습니다."
      : !canUpvote
        ? "오늘 추천은 이미 사용했습니다. 비추천은 가능합니다."
        : !canDownvote
          ? "오늘 비추천은 이미 사용했습니다. 추천은 가능합니다."
          : "추천과 비추천은 각각 하루 1회 가능합니다.";
    const participationStatus = canParticipate ? voteStatus : writeAccess.label;
    const isDeletedComment = (item) => Number(item?.is_deleted || 0) === 1;
    const commentDepth = (item) => Math.max(0, Math.min(2, Number(item?.reply_depth || (item?.parent_id ? 1 : 0)) || 0));
    const isReplyComment = (item) => commentDepth(item) > 0 || !!item?.parent_id;

    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack m-post-detail-page" },
        h("article", { className: "m-post-detail" },
          post
            ? [
                h("div", { className: "m-meta m-muted", key: "meta" },
                  h("span", { className: "m-chip m-mono" }, `${gid}/${postNo}`),
                  post.category ? h("span", { className: "m-chip" }, `[${post.category}]`) : null,
                  h("span", null, formatDate(post.writed_at || post.created_at || post.reg_date))
                ),
                h("h1", { className: "m-post-heading", key: "title" }, post.title || "제목 없음"),
                h("div", { className: "m-post-meta m-muted", key: "author" }, h(MMemberIdentity, { item: post }), h("span", null, `${post.comment_count ?? comments.length} comments`)),
                h("div", { className: "m-post-body", key: "body", dangerouslySetInnerHTML: { __html: post.content || "" } }),
                h("section", { className: "m-panel m-stack m-vote-panel", key: "votes" },
                  h("div", { className: "m-inline m-vote-summary" },
                    h("span", { className: "m-chip" }, `추천 ${post.recommend_count ?? 0}`),
                    h("span", { className: "m-chip" }, `비추천 ${post.unrecommend_count ?? 0}`)
                  ),
                  h("div", { className: "m-inline m-vote-actions" },
                    h("button", { type: "button", className: "m-btn m-btn-primary", disabled: !canUpvote, onClick: () => onVote({ gid, postNo, voteType: "up" }) }, "추천"),
                    h("button", { type: "button", className: "m-btn m-btn-secondary", disabled: !canDownvote, onClick: () => onVote({ gid, postNo, voteType: "down" }) }, "비추천")
                  ),
                  h("div", { className: "m-muted" }, participationStatus),
                  h(MFeedback, { feedback: voteFeedback })
                ),
                h("div", { className: "m-inline", style: { marginTop: "14px" }, key: "actions" },
                  h(MLink, { href: `/m/board/${encodeURIComponent(gid)}`, className: "m-btn m-btn-secondary" }, "목록"),
                  writeAccess.canWritePost
                    ? h(MLink, { href: `/m/board/${encodeURIComponent(gid)}/write`, className: "m-btn m-btn-primary" }, "글쓰기")
                    : h("button", { type: "button", className: "m-btn m-btn-secondary", disabled: true, title: writeAccess.label }, writeAccess.label),
                  session?.loggedIn ? h("button", { type: "button", className: "m-btn m-btn-secondary", disabled: !canParticipate, onClick: () => canParticipate && onScrapPost(post) }, "스크랩") : null,
                  h("button", { type: "button", className: "m-btn m-btn-secondary", disabled: !canParticipate, onClick: () => canParticipate && onReportPost(post) }, "신고"),
                  h("button", { type: "button", className: "m-btn m-btn-danger", onClick: () => onDeletePost(post) }, "삭제")
                ),
                h("section", { className: "m-panel m-stack", style: { marginTop: "14px" }, key: "comment-list" },
                  h(MSectionHead, { eyebrow: "Comments", title: "댓글" }),
                  comments.length
                    ? comments.map((comment) =>
                        h("div", { className: ["m-post-row", "m-comment-row", `depth-${commentDepth(comment)}`, isDeletedComment(comment) ? "is-deleted" : "", isReplyComment(comment) ? "is-reply" : ""].filter(Boolean).join(" "), key: comment.id || comment.comment_id },
                          isDeletedComment(comment)
                            ? h("div", { className: "m-meta m-muted m-deleted-comment-label" }, "삭제된 댓글")
                            : h("div", { className: "m-meta m-muted" }, h(MMemberIdentity, { item: comment }), h("span", null, formatDate(comment.writed_at || comment.created_at))),
                          isDeletedComment(comment) ? null : h("div", { className: "m-post-title", style: { fontSize: "0.98rem" }, dangerouslySetInnerHTML: { __html: comment.content || "" } }),
                          isDeletedComment(comment) ? null : h("div", { className: "m-inline", style: { marginTop: "8px" } },
                            canParticipate && commentDepth(comment) < 2 ? h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => setReplyTarget({ id: comment.id || comment.comment_id, name: authorLabel(comment) }) }, "답글") : null,
                            h("button", { type: "button", className: "m-btn m-btn-secondary", disabled: !canParticipate, onClick: () => canParticipate && onLikeComment(comment) }, `공감 ${comment.like_count ?? 0}`),
                            h("button", { type: "button", className: "m-btn m-btn-secondary", disabled: !canParticipate, onClick: () => canParticipate && onReportComment(comment) }, "신고"),
                            h("button", { type: "button", className: "m-btn m-btn-danger", onClick: () => onDeleteComment(comment) }, "삭제")
                          )
                        )
                      )
                    : h("div", { className: "m-empty" }, "댓글이 없습니다.")
                ),
                h("section", { className: "m-panel m-stack", key: "comment-form" },
                  !canParticipate ? h("div", { className: "m-feedback-error" }, writeAccess.label) : null,
                  canParticipate && replyTarget ? h("div", { className: "m-reply-target" }, h("span", null, `${replyTarget.name}에게 답글 작성 중`), h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => setReplyTarget(null) }, "취소")) : null,
                  canParticipate && !session?.loggedIn ? h(MGuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "m-comment" }) : null,
                  h("div", { className: "m-field" }, h("label", { htmlFor: "m-comment-content" }, "댓글 내용"), h("textarea", { id: "m-comment-content", value: content, disabled: !canParticipate, onChange: (event) => setContent(event.target.value) })),
                  h(MFeedback, { feedback }),
                  h("button", {
                    type: "button",
                    className: "m-btn m-btn-primary",
                    disabled: !canParticipate,
                    onClick() {
                      if (!canParticipate) return;
                      onSubmitComment({
                        gid,
                        postNo,
                        content: content.trim(),
                        name: guestName.trim(),
                        password: guestPassword,
                        parentId: replyTarget?.id || ""
                      }, () => {
                        setContent("");
                        setGuestName("");
                        setGuestPassword("");
                        setReplyTarget(null);
                      });
                    }
                   }, "댓글 등록")
                )
              ]
            : h("div", { className: "m-feedback-error" }, "게시글을 불러오지 못했습니다.")
        )
      )
    );
  }

  function WriteView({ session, gid, feedback, settings, manageData, onSubmitPost, onLogout, alarmCount }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    const canUploadImage = session?.loggedIn ? flagEnabled(settings?.allow_member_image) : flagEnabled(settings?.allow_guest_image);
    window.__mobileWriteCanUploadImage = canUploadImage;
    const categoryOptions = categoryOptionsFromSettings(settings);
    const writeAccess = boardWriteAccess(session, settings, manageData);
    const selectedCategory = category || categoryOptions[0] || "";
    const plainContent = String(content || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    const canSubmit = writeAccess.canWritePost
      && title.trim().length > 0
      && plainContent.length > 0
      && (session?.loggedIn || (guestName.trim().length > 0 && guestPassword.length > 0));

    useEffect(() => {
      if (!category && categoryOptions.length) setCategory(categoryOptions[0]);
      if (category && categoryOptions.length && !categoryOptions.includes(category)) setCategory(categoryOptions[0]);
    }, [settings?.category_options]);

    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack m-write-screen" },
        h("section", { className: "m-write-hero" },
          h("div", null,
            h("span", { className: "m-eyebrow" }, "Write"),
            h("h1", null, "글쓰기"),
            h("p", null, `${gid} 보드에 새 글을 등록합니다.`)
          ),
          h(MLink, { href: `/m/board/${encodeURIComponent(gid)}`, className: "m-btn m-btn-secondary" }, "목록")
        ),
        h("section", { className: "m-write-status" },
          h("span", { className: writeAccess.canWritePost ? "is-ok" : "is-blocked" }, writeAccess.canWritePost ? "작성 가능" : "작성 제한"),
          h("strong", null, session?.loggedIn ? (session.nick || session.uid) : "비회원 작성"),
          h("em", null, session?.loggedIn ? "로그인 계정으로 저장됩니다." : "이름과 비밀번호가 반드시 필요합니다.")
        ),
        h("section", { className: "m-compose m-card m-stack m-write-form" },
          h(MSectionHead, { eyebrow: "Compose", title: `${gid} 글쓰기`, action: h(MLink, { href: `/m/board/${encodeURIComponent(gid)}`, className: "m-btn m-btn-secondary" }, "보드") }),
          !writeAccess.canWritePost
            ? h("div", { className: "m-feedback-error" },
                writeAccess.label,
                writeAccess.joinRequired && session?.loggedIn
                  ? h(MLink, { href: `/board/${encodeURIComponent(gid)}/join`, className: "m-btn m-btn-secondary", style: { marginLeft: "8px" } }, "가입")
                  : null
              )
            : null,
          h("div", { className: session?.loggedIn ? "m-feedback-success" : "m-feedback-error" }, session?.loggedIn ? h(React.Fragment, null, h(MMemberIdentity, { name: session.nick || session.uid, uid: session.uid, nickType: session.nickType }), " 계정으로 작성합니다.") : "비회원은 이름과 비밀번호를 반드시 입력해야 합니다."),
          session?.loggedIn ? null : h(MGuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "m-post" }),
          categoryOptions.length
            ? h("div", { className: "m-category-pills", "aria-label": "말머리 빠른 선택" },
                categoryOptions.map((option) =>
                  h("button", {
                    key: `pill-${option}`,
                    type: "button",
                    className: selectedCategory === option ? "is-active" : "",
                    onClick: () => setCategory(option)
                  }, option)
                )
              )
            : null,
          categoryOptions.length
            ? h("div", { className: "m-field" },
                h("label", { htmlFor: "m-write-category" }, "말머리"),
                h("select", { id: "m-write-category", value: category || categoryOptions[0], onChange: (event) => setCategory(event.target.value) },
                  categoryOptions.map((option) => h("option", { key: option, value: option }, `[${option}]`))
                )
              )
            : null,
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-write-title" }, "제목"), h("input", { id: "m-write-title", type: "text", value: title, onChange: (event) => setTitle(event.target.value) })),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-write-content" }, "본문"), h(MHtmlEditor, { id: "m-write-content", value: content, onChange: setContent, placeholder: "모바일에서도 바로 작성하면 HTML로 저장됩니다." })),
          h("div", { className: "m-write-count" }, `제목 ${title.trim().length}/120 · 본문 ${plainContent.length.toLocaleString("ko-KR")}자`),
          h(MFeedback, { feedback }),
          h("button", {
            type: "button",
            className: "m-btn m-btn-primary",
            disabled: !canSubmit,
            onClick() {
              if (!writeAccess.canWritePost) return;
              onSubmitPost({
                gid,
                category: selectedCategory,
                title: title.trim(),
                content,
                name: guestName.trim(),
                password: guestPassword
              }, () => {
                setTitle("");
                setContent("");
                setCategory(categoryOptions[0] || "");
                setGuestName("");
                setGuestPassword("");
              });
            }
          }, "게시")
        ),
        h("section", { className: "m-preview m-card m-stack" },
          h("span", { className: "m-eyebrow" }, "Saved HTML"),
          h("div", { className: "m-preview-box", dangerouslySetInnerHTML: { __html: content || "<p>아직 작성한 내용이 없습니다.</p>" } })
        )
      )
    );
  }

  function ProfileView({ session, profileData, feedback, onSaveProfile, onDeleteHistory, onFollowProfile, onUnfollowProfile, onLogout, alarmCount }) {
    const [statusMessage, setStatusMessage] = useState(profileData?.statusMessage || "");
    const [bio, setBio] = useState(profileData?.bio || "");
    const [avatarUrl, setAvatarUrl] = useState(profileData?.avatarUrl || "");
    const [bannerUrl, setBannerUrl] = useState(profileData?.bannerUrl || "");
    const [showFollowers, setShowFollowers] = useState(profileData?.showFollowers !== false);
    const [showFollowing, setShowFollowing] = useState(profileData?.showFollowing !== false);
    const [profileUploadFeedback, setProfileUploadFeedback] = useState(null);
    const [profileUploading, setProfileUploading] = useState("");
    const avatarFileRef = useRef(null);
    const bannerFileRef = useRef(null);

    useEffect(() => {
      setStatusMessage(profileData?.statusMessage || "");
      setBio(profileData?.bio || "");
      setAvatarUrl(profileData?.avatarUrl || "");
      setBannerUrl(profileData?.bannerUrl || "");
      setShowFollowers(profileData?.showFollowers !== false);
      setShowFollowing(profileData?.showFollowing !== false);
      setProfileUploadFeedback(null);
      setProfileUploading("");
    }, [profileData]);

    if (!profileData) {
      return h(React.Fragment, null,
        h(MobileTopbar, { session, onLogout, alarmCount }),
        h("main", { className: "m-shell m-stack" }, h("div", { className: "m-feedback-error" }, "프로필을 불러오지 못했습니다."))
      );
    }

    const stats = profileData.stats || {};
    const displayName = profileData.nick || profileData.uid || "Irisen";
    const initial = String(displayName).trim().charAt(0).toUpperCase() || "I";

    async function handleProfileImageUpload(kind, event) {
      const file = event.target.files?.[0];
      if (!file) return;
      setProfileUploadFeedback(null);
      setProfileUploading(kind);
      try {
        const url = await uploadImageFile(file);
        if (kind === "avatar") setAvatarUrl(url);
        else setBannerUrl(url);
        setProfileUploadFeedback({ type: "success", message: kind === "avatar" ? "프로필 사진을 업로드했습니다. 저장을 눌러 적용하세요." : "프로필 배너를 업로드했습니다. 저장을 눌러 적용하세요." });
      } catch (error) {
        setProfileUploadFeedback({ type: "error", message: error.message || "이미지 업로드에 실패했습니다." });
      } finally {
        setProfileUploading("");
        event.target.value = "";
      }
    }

    const renderFollowList = (items = []) => items.map((user) =>
      h(MLink, { href: `/m/profile/${encodeURIComponent(user.uid)}`, className: "m-follow-user", key: user.uid },
        h(MMemberIdentity, { name: user.nick || user.uid, uid: user.uid, nickType: user.nick_type || user.nickType }),
        h("span", { className: "m-muted" }, `@${user.uid}`)
      )
    );

    function renderFollowDetails({ title, count, hidden, items, emptyText }) {
      return h("details", { className: "m-follow-details" },
        h("summary", null,
          h("span", null, title),
          h("strong", null, Number(count || 0).toLocaleString("ko-KR"))
        ),
        hidden
          ? h("div", { className: "m-empty" }, `${title} 목록이 비공개입니다.`)
          : items?.length ? h("div", { className: "m-follow-list" }, renderFollowList(items)) : h("div", { className: "m-empty" }, emptyText)
      );
    }

    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack" },
        h("section", { className: "m-panel m-stack m-profile-card" },
          h("div", { className: "m-profile-banner", style: bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : null }),
          h("div", { className: "m-profile-identity" },
            h("div", { className: "m-profile-avatar" },
              avatarUrl ? h("img", { src: avatarUrl, alt: `${displayName} 프로필 사진` }) : h("span", null, initial)
            ),
            h("div", { className: "m-stack" },
              h("div", { className: "m-meta m-muted" }, h("span", { className: "m-chip" }, profileData.ownerView ? "내 프로필" : "프로필")),
              h("h1", { className: "m-section-title" }, h(MMemberIdentity, { name: displayName, uid: profileData.uid, nickType: profileData.nickType })),
              h("div", { className: "m-muted" }, `@${profileData.uid}`)
            )
          ),
          profileData.statusMessage ? h("div", { className: "m-post-title" }, profileData.statusMessage) : null,
          profileData.bio ? h("div", { className: "m-muted m-profile-bio" }, profileData.bio) : null,
          h("div", { className: "m-inline" },
            h("span", { className: "m-chip" }, `글 ${stats.postCount ?? 0}`),
            h("span", { className: "m-chip" }, `댓글 ${stats.commentCount ?? 0}`),
            h("span", { className: "m-chip" }, `팔로워 ${stats.followerCount ?? 0}`),
            h("span", { className: "m-chip" }, `팔로잉 ${stats.followingCount ?? 0}`),
            h("span", { className: "m-chip" }, `관리 ${stats.managedBoardCount ?? 0}`)
          ),
          !profileData.ownerView && session?.loggedIn
            ? profileData.follow?.isFollowing
              ? h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => onUnfollowProfile(profileData.uid) }, "언팔로우")
              : h("button", { type: "button", className: "m-btn m-btn-primary", onClick: () => onFollowProfile(profileData.uid) }, "팔로우")
            : null
        ),
        profileData.canEdit
          ? h("section", { className: "m-panel m-stack" },
              h(MSectionHead, { eyebrow: "Edit", title: "프로필 설정" }),
              h("div", { className: "m-field" }, h("label", { htmlFor: "m-profile-status" }, "상태 메시지"), h("input", { id: "m-profile-status", type: "text", value: statusMessage, onChange: (event) => setStatusMessage(event.target.value) })),
              h("div", { className: "m-field" }, h("label", { htmlFor: "m-profile-bio" }, "소개"), h("textarea", { id: "m-profile-bio", rows: 5, value: bio, onChange: (event) => setBio(event.target.value) })),
              h("div", { className: "m-profile-upload-grid" },
                h("div", { className: "m-field" },
                  h("label", null, "프로필 사진"),
                  h("button", { type: "button", className: "m-btn m-btn-secondary", disabled: profileUploading === "avatar", onClick: () => avatarFileRef.current?.click() }, profileUploading === "avatar" ? "업로드 중" : "사진 업로드"),
                  avatarUrl ? h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => setAvatarUrl("") }, "삭제") : null,
                  h("input", { ref: avatarFileRef, type: "file", accept: "image/*", hidden: true, onChange: (event) => handleProfileImageUpload("avatar", event) })
                ),
                h("div", { className: "m-field" },
                  h("label", null, "프로필 배너"),
                  h("button", { type: "button", className: "m-btn m-btn-secondary", disabled: profileUploading === "banner", onClick: () => bannerFileRef.current?.click() }, profileUploading === "banner" ? "업로드 중" : "배너 업로드"),
                  bannerUrl ? h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => setBannerUrl("") }, "삭제") : null,
                  h("input", { ref: bannerFileRef, type: "file", accept: "image/*", hidden: true, onChange: (event) => handleProfileImageUpload("banner", event) })
                )
              ),
              h(MFeedback, { feedback: profileUploadFeedback }),
              h("label", { className: "m-check-row" }, h("input", { type: "checkbox", checked: showFollowers, onChange: (event) => setShowFollowers(event.target.checked) }), h("span", null, "팔로워 목록 공개")),
              h("label", { className: "m-check-row" }, h("input", { type: "checkbox", checked: showFollowing, onChange: (event) => setShowFollowing(event.target.checked) }), h("span", null, "팔로잉 목록 공개")),
              h(MFeedback, { feedback }),
              h("button", {
                type: "button",
                className: "m-btn m-btn-primary",
                onClick: () => onSaveProfile({
                  statusMessage: statusMessage.trim(),
                  bio: bio.trim(),
                  avatarUrl: avatarUrl.trim(),
                  bannerUrl: bannerUrl.trim(),
                  showFollowers,
                  showFollowing
                })
              }, "저장하기"),
              h("button", {
                type: "button",
                className: "m-btn m-btn-secondary",
                onClick: () => {
                  const scope = window.prompt("삭제 범위: posts, comments, scraps, follows, blocks, profile, all", "all");
                  if (!scope) return;
                  if (!window.confirm("선택한 기록을 삭제합니다. 계속할까요?")) return;
                  onDeleteHistory?.(scope);
                }
              }, "기록 삭제")
            )
          : h(MFeedback, { feedback }),
        h("section", { className: "m-panel m-stack" },
          h(MSectionHead, { eyebrow: "Follow", title: "팔로우 세부 목록" }),
          renderFollowDetails({ title: "팔로워", count: stats.followerCount, hidden: profileData.followersHidden, items: profileData.followers, emptyText: "팔로워가 없습니다." }),
          renderFollowDetails({ title: "팔로잉", count: stats.followingCount, hidden: profileData.followingHidden, items: profileData.following, emptyText: "팔로잉이 없습니다." })
        )
      )
    );
  }
  function AlarmsView({ session, alarms, feedback, onAcceptAlarm, onRejectAlarm, onMarkAllRead, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack" },
        h("section", { className: "m-panel m-stack" },
          h(MSectionHead, { eyebrow: "Inbox", title: "알림", action: session?.loggedIn ? h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: onMarkAllRead }, "모두 읽음") : null }),
          h(MFeedback, { feedback }),
          !session?.loggedIn
            ? h("div", { className: "m-empty" }, "로그인 후 알림을 확인할 수 있습니다.")
            : alarms.length
              ? alarms.map((alarm) =>
                  h("article", { className: "m-panel m-stack", key: alarm.alarm_id },
                    h("div", { className: "m-meta m-muted" }, h("span", { className: "m-chip" }, alarm.alarm_type || "alarm"), h("span", null, formatDate(alarm.created_at))),
                    h("div", { className: "m-post-title" }, alarm.title || "알림"),
                    h("div", { className: "m-muted" }, alarm.content || ""),
                    alarm.actionable
                      ? h("div", { className: "m-inline" },
                          h("button", { type: "button", className: "m-btn m-btn-primary", onClick: () => onAcceptAlarm(alarm.alarm_id) }, "수락"),
                          h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: () => onRejectAlarm(alarm.alarm_id) }, "거절")
                        )
                      : null
                  )
                )
              : h("div", { className: "m-empty" }, "받은 알림이 없습니다.")
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
    const [nickType, setNickType] = useState("variable");
    const [signupTermsAgreed, setSignupTermsAgreed] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [localFeedback, setLocalFeedback] = useState(null);
    const [uidFeedback, setUidFeedback] = useState(null);
    const [nickFeedback, setNickFeedback] = useState(null);
    const [uidChecking, setUidChecking] = useState(false);
    const [nickChecking, setNickChecking] = useState(false);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [signupLoading, setSignupLoading] = useState(false);
    const [uidChecked, setUidChecked] = useState({ value: "", ok: false });
    const [nickChecked, setNickChecked] = useState({ value: "", type: "variable", ok: false });
    const isLogin = mode === "login";
    const trimmedUid = uid.trim();
    const trimmedNick = nick.trim();
    const requiresFixedNickCheck = nickType === "fixed";
    const uidCheckPassed = uidChecked.ok && uidChecked.value === trimmedUid;
    const nickCheckPassed = !requiresFixedNickCheck || (nickChecked.ok && nickChecked.value === trimmedNick && nickChecked.type === "fixed");

    async function validateSignupFieldRequest(field, value, currentNickType) {
      const params = new URLSearchParams({
        field: String(field || ""),
        value: String(value || "")
      });
      if (currentNickType) params.set("nickType", currentNickType);
      const result = await api(`/api/signup/validate?${params.toString()}`);
      if (!result?.success || !result?.data?.valid) {
        throw new Error(result?.data?.message || "입력값을 다시 확인해 주세요.");
      }
      return result;
    }

    async function checkUidDuplicate() {
      try {
        setUidChecking(true);
        setUidFeedback(null);
        await validateSignupFieldRequest("uid", trimmedUid);
        setUidChecked({ value: trimmedUid, ok: true });
        setUidFeedback({ type: "success", message: "사용 가능한 아이디입니다." });
      } catch (error) {
        setUidChecked({ value: "", ok: false });
        setUidFeedback({ type: "error", message: error.message || "아이디를 다시 확인해 주세요." });
      } finally {
        setUidChecking(false);
      }
    }

    async function checkNickDuplicate() {
      try {
        setNickChecking(true);
        setNickFeedback(null);
        await validateSignupFieldRequest("nick", trimmedNick, "fixed");
        setNickChecked({ value: trimmedNick, type: "fixed", ok: true });
        setNickFeedback({ type: "success", message: "사용 가능한 고정 닉네임입니다." });
      } catch (error) {
        setNickChecked({ value: "", type: "fixed", ok: false });
        setNickFeedback({ type: "error", message: error.message || "닉네임을 다시 확인해 주세요." });
      } finally {
        setNickChecking(false);
      }
    }

    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack" },
        h("section", { className: "m-auth m-card m-stack" },
          h("span", { className: "m-eyebrow" }, isLogin ? "Access" : "Join"),
          h("h1", { className: "m-section-title" }, isLogin ? "로그인" : "회원가입"),
          h("div", { className: "m-muted" }, "회원으로 가입하거나 비회원으로도 참여할 수 있습니다."),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-uid" }, isLogin ? "아이디 또는 이메일" : "아이디"), h("input", { id: "m-auth-uid", type: "text", value: uid, onChange: (event) => { setUid(event.target.value); setUidChecked({ value: "", ok: false }); setUidFeedback(null); } })),
          isLogin ? null : h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: checkUidDuplicate, disabled: uidChecking }, uidChecking ? "확인 중" : (uidCheckPassed ? "아이디 확인 완료" : "아이디 중복확인")),
          isLogin ? null : h(MFeedback, { feedback: uidFeedback }),
          isLogin ? null : h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-nick" }, "닉네임"), h("input", { id: "m-auth-nick", type: "text", value: nick, onChange: (event) => { setNick(event.target.value); setNickChecked({ value: "", type: requiresFixedNickCheck ? "fixed" : "variable", ok: false }); setNickFeedback(null); } })),
          isLogin ? null : h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-nick-type" }, "닉네임 유형"), h("select", { id: "m-auth-nick-type", value: nickType, onChange: (event) => { const nextType = event.target.value; setNickType(nextType); setNickChecked({ value: "", type: nextType, ok: false }); setNickFeedback(null); } }, h("option", { value: "variable" }, "비고정"), h("option", { value: "fixed" }, "고정"))),
          isLogin || !requiresFixedNickCheck ? null : h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: checkNickDuplicate, disabled: nickChecking }, nickChecking ? "확인 중" : (nickCheckPassed ? "고정 닉네임 확인 완료" : "고정 닉네임 중복확인")),
          isLogin || !requiresFixedNickCheck ? null : h(MFeedback, { feedback: nickFeedback }),
          isLogin ? null : h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-email" }, "이메일"), h("input", { id: "m-auth-email", type: "email", value: email, onChange: (event) => setEmail(event.target.value) })),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-pw" }, "비밀번호"), h("input", { id: "m-auth-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value) })),
          isLogin ? null : h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-code" }, "인증 코드"), h("input", { id: "m-auth-code", type: "text", value: code, onChange: (event) => setCode(event.target.value), placeholder: "메일로 받은 인증 코드" })),
          isLogin ? null : h("a", { href: "/policy.html", className: "m-policy-link", target: "_blank", rel: "noreferrer" }, "약관 전문 보기"),
          isLogin ? null : h("label", { className: "m-check" }, h("input", { type: "checkbox", checked: signupTermsAgreed, onChange: (event) => setSignupTermsAgreed(event.target.checked) }), h("span", null, "약관 및 개인정보 수집 이용에 동의합니다.")),
          isLogin ? null : h("div", { className: "m-muted" }, uidCheckPassed ? "아이디 중복확인이 완료되었습니다." : "가입 전에 아이디 중복확인을 완료해 주세요."),
          isLogin || !requiresFixedNickCheck ? null : h("div", { className: "m-muted" }, nickCheckPassed ? "고정 닉네임 중복확인이 완료되었습니다." : "고정 닉네임도 중복확인을 완료해 주세요."),
          h(MFeedback, { feedback }),
          isLogin ? null : h(MFeedback, { feedback: localFeedback }),
          isLogin
            ? h("button", { type: "button", className: "m-btn m-btn-primary", onClick: () => onSubmitAuth({ uid, password }) }, "로그인")
            : h(React.Fragment, null,
                h("button", {
                  type: "button",
                  className: "m-btn m-btn-secondary",
                  disabled: verificationLoading,
                  onClick: async () => {
                    if (!uidCheckPassed) {
                      setLocalFeedback({ type: "error", message: "아이디 중복확인을 완료해 주세요." });
                      return;
                    }
                    if (!nickCheckPassed) {
                      setLocalFeedback({ type: "error", message: "고정 닉네임 중복확인을 완료해 주세요." });
                      return;
                    }
                    try {
                      setVerificationLoading(true);
                      await onSubmitAuth({ uid, nick, email, password, nickType, signupTermsAgreed, resendOnly: true, setVerificationSent });
                    } finally {
                      setVerificationLoading(false);
                    }
                  }
                }, verificationSent ? "인증 메일 다시 보내기" : "인증 메일 보내기"),
                h("button", {
                  type: "button",
                  className: "m-btn m-btn-primary",
                  disabled: !verificationSent || signupLoading,
                  onClick: async () => {
                    if (!uidCheckPassed) {
                      setLocalFeedback({ type: "error", message: "아이디 중복확인을 완료해 주세요." });
                      return;
                    }
                    if (!nickCheckPassed) {
                      setLocalFeedback({ type: "error", message: "고정 닉네임 중복확인을 완료해 주세요." });
                      return;
                    }
                    try {
                      setSignupLoading(true);
                      await onSubmitAuth({ uid, nick, email, password, nickType, code, signupTermsAgreed, verificationSent, setVerificationSent });
                    } finally {
                      setSignupLoading(false);
                    }
                  }
                }, "인증 완료하고 가입")
              ),
          h(MLink, { href: isLogin ? "/m/nid" : "/m/signin", className: "m-btn m-btn-secondary" }, isLogin ? "회원가입" : "로그인으로")
        )
      )
    );
  }

  function NotFoundView({ session, onLogout, alarmCount }) {
    return h(React.Fragment, null,
      h(MobileTopbar, { session, onLogout, alarmCount }),
      h("main", { className: "m-shell m-stack" },
        h("section", { className: "m-auth m-card m-stack" },
          h("span", { className: "m-eyebrow" }, "404"),
          h("h1", { className: "m-section-title" }, "모바일 페이지를 찾을 수 없습니다."),
          h(MLink, { href: "/m", className: "m-btn m-btn-primary" }, "모바일 홈")
        )
      )
    );
  }

  function App() {
    const [route, setRoute] = useState(matchRoute(window.location.pathname));
    const [session, setSession] = useState(null);
    const [boards, setBoards] = useState([]);
    const [feed, setFeed] = useState([]);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [boardPosts, setBoardPosts] = useState([]);
    const [boardSettings, setBoardSettings] = useState(null);
    const [boardManageData, setBoardManageData] = useState(null);
    const [postData, setPostData] = useState({ post: null, comments: [], voteState: { canUpvote: true, canDownvote: true } });
    const [authFeedback, setAuthFeedback] = useState(null);
    const [writeFeedback, setWriteFeedback] = useState(null);
    const [commentFeedback, setCommentFeedback] = useState(null);
    const [boardRequestFeedback, setBoardRequestFeedback] = useState(null);
    const [boardManageFeedback, setBoardManageFeedback] = useState(null);
    const [boardDashboard, setBoardDashboard] = useState({ requestedBoards: [], managedBoards: [] });
    const [boardPostsFeedback, setBoardPostsFeedback] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [alarms, setAlarms] = useState([]);
    const [alarmFeedback, setAlarmFeedback] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [profileFeedback, setProfileFeedback] = useState(null);

    useEffect(() => {
      const syncRoute = () => setRoute(matchRoute(window.location.pathname));
      window.addEventListener("popstate", syncRoute);
      window.addEventListener("mobile:navigate", syncRoute);
      return () => {
        window.removeEventListener("popstate", syncRoute);
        window.removeEventListener("mobile:navigate", syncRoute);
      };
    }, []);

    useEffect(() => {
      document.title = `m:${route.name} | irisen`;
    }, [route]);

    useEffect(() => {
      api("/api/check-login").then(setSession).catch(() => setSession({ loggedIn: false }));
      api("/api/board/list").then(setBoards).catch(() => setBoards([]));
    }, []);

    useEffect(() => {
      if (session?.loggedIn) {
        api("/api/alarms/my").then((result) => setAlarms(result?.success && Array.isArray(result.alarms) ? result.alarms : [])).catch(() => setAlarms([]));
      } else {
        setAlarms([]);
        setBoardDashboard({ requestedBoards: [], managedBoards: [] });
      }
    }, [session?.loggedIn]);

    useEffect(() => {
      if (route.name === "home" || route.name === "feed") {
        api("/api/posts/recommend").then(setFeed).catch(() => setFeed([]));
      }
      if (route.name === "board") {
        setBoardPostsFeedback(null);
        api(`/api/board/posts/${encodeURIComponent(route.params.gid)}?page=${page}`)
          .then((data) => {
            if (Array.isArray(data)) {
              setBoardPosts(data);
              return;
            }
            setBoardPosts([]);
            setBoardPostsFeedback({ type: "error", message: data?.message || "게시글 목록을 불러오지 못했습니다." });
          })
          .catch((error) => {
            setBoardPosts([]);
            setBoardPostsFeedback({ type: "error", message: error.message || "게시글 목록을 불러오지 못했습니다." });
          });
      }
      if (route.name === "post") {
        api(`/api/posts/get/${encodeURIComponent(route.params.gid)}/${encodeURIComponent(route.params.postNo)}`).then((result) => {
          setPostData({
            post: result && result.success ? result.post : null,
            comments: result && result.success && Array.isArray(result.comments) ? result.comments : [],
            voteState: result && result.success && result.voteState ? result.voteState : { canUpvote: true, canDownvote: true }
          });
        }).catch(() => setPostData({ post: null, comments: [], voteState: { canUpvote: true, canDownvote: true } }));
      }
      if (route.name === "board" || route.name === "boardManage" || route.name === "post" || route.name === "write") {
        api(`/api/board/manage/${encodeURIComponent(route.params.gid)}`).then((result) => {
          const nextManageData = result && result.success ? result.data : null;
          setBoardManageData(nextManageData);
          setBoardSettings(nextManageData?.settings || null);
        }).catch(() => setBoardManageData(null));
      }
      if (route.name === "search") {
        const trimmed = getSearchQueryFromLocation();
        if (!trimmed) {
          setSearchResults([]);
        } else {
          api(`/api/features/search?q=${encodeURIComponent(trimmed)}`).then((result) => {
            setSearchResults(result?.success && Array.isArray(result.posts) ? result.posts : []);
          }).catch(() => setSearchResults([]));
        }
      }
      if (route.name === "profile") {
        const endpoint = route.params.uid ? `/api/profile/${encodeURIComponent(route.params.uid)}` : "/api/profile/me";
        api(endpoint).then((result) => setProfileData(result?.success ? result.data : null)).catch(() => setProfileData(null));
      }
      if (route.name === "alarms" && session?.loggedIn) {
        api("/api/alarms/my").then((result) => setAlarms(result?.success && Array.isArray(result.alarms) ? result.alarms : [])).catch(() => setAlarms([]));
      }
      if (route.name === "boardRequest" && session?.loggedIn) {
        api("/api/board/my")
          .then((result) => setBoardDashboard(result?.success && result.data ? result.data : { requestedBoards: [], managedBoards: [] }))
          .catch(() => setBoardDashboard({ requestedBoards: [], managedBoards: [] }));
      }
    }, [route, page, session?.loggedIn]);

    useEffect(() => {
      if (route.name !== "board") setPage(1);
      if (route.name !== "login" && route.name !== "signup") setAuthFeedback(null);
      if (route.name !== "write") setWriteFeedback(null);
      if (route.name !== "write" && route.name !== "board" && route.name !== "boardManage" && route.name !== "post") setBoardSettings(null);
      if (route.name !== "write" && route.name !== "board" && route.name !== "boardManage" && route.name !== "post") setBoardManageData(null);
      if (route.name !== "post") setCommentFeedback(null);
      if (route.name !== "boardRequest") setBoardRequestFeedback(null);
      if (route.name !== "boardManage") setBoardManageFeedback(null);
      if (route.name !== "alarms") setAlarmFeedback(null);
      if (route.name !== "profile") setProfileFeedback(null);
      if (route.name !== "profile") setProfileData(null);
      if (route.name === "boards") {
        const storedQuery = window.sessionStorage.getItem("irisen:mobileBoardQuery");
        if (storedQuery !== null) {
          setQuery(storedQuery);
          window.sessionStorage.removeItem("irisen:mobileBoardQuery");
        }
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    }, [route]);

    const currentBoard = boards.find((board) => board.gall_id === route.params.gid) || null;
    const alarmCount = Array.isArray(alarms) ? alarms.filter((alarm) => !alarm.read_at && !alarm.is_read).length || alarms.length : 0;
    const searchQuery = getSearchQueryFromLocation();

    function refreshCurrentPost(gallId, currentPostNo) {
      return api(`/api/posts/get/${encodeURIComponent(gallId)}/${encodeURIComponent(currentPostNo)}`).then((next) => {
        setPostData({
          post: next && next.success ? next.post : null,
          comments: next && next.success && Array.isArray(next.comments) ? next.comments : [],
          voteState: next && next.success && next.voteState ? next.voteState : { canUpvote: true, canDownvote: true }
        });
      });
    }

    function refreshBoardManage(gallId) {
      return api(`/api/board/manage/${encodeURIComponent(gallId)}`).then((result) => {
        setBoardManageData(result && result.success ? result.data : null);
      }).catch(() => setBoardManageData(null));
    }

    function refreshAlarms() {
      if (!session?.loggedIn) {
        setAlarms([]);
        return Promise.resolve();
      }
      return api("/api/alarms/my").then((result) => setAlarms(result?.success && Array.isArray(result.alarms) ? result.alarms : [])).catch(() => setAlarms([]));
    }

    function handleLogout() {
      fetch("/logout", { method: "POST", credentials: "include" }).finally(() => {
        setSession({ loggedIn: false });
        navigate("/m", true);
      });
    }

    function managerPasswordForStaffAction(actionName) {
      const permissions = boardManageData?.permissions || {};
      if (permissions.isAdmin) {
        return "";
      }
      const password = window.prompt(`${actionName}을(를) 하려면 매니저 비밀번호를 입력해 주세요.`);
      if (password === null) {
        return null;
      }
      if (!password.trim()) {
        setBoardManageFeedback({ type: "error", message: "매니저 비밀번호를 입력해 주세요." });
        return null;
      }
      return password;
    }

    function appointSubmanager(targetUid, reset) {
      if (!boardManageData?.permissions?.canAssignSubmanager) {
        setBoardManageFeedback({ type: "error", message: "부매니저를 임명할 권한이 없습니다." });
        return;
      }
      const password = managerPasswordForStaffAction("부매니저 임명");
      if (password === null) return;
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/submanager`, {
        method: "POST",
        body: JSON.stringify({ targetUid, password })
      }).then((result) => {
        if (!result?.success) {
          setBoardManageFeedback({ type: "error", message: result?.message || "부매니저 임명 요청에 실패했습니다." });
          return;
        }
        if (typeof reset === "function") reset();
        setBoardManageFeedback({ type: "success", message: "부매니저 임명 요청을 보냈습니다." });
        return refreshBoardManage(route.params.gid);
      }).catch((error) => setBoardManageFeedback({ type: "error", message: error.message || "부매니저 임명 요청에 실패했습니다." }));
    }

    function revokeSubmanager(targetUid) {
      if (!boardManageData?.permissions?.canAssignSubmanager) {
        setBoardManageFeedback({ type: "error", message: "부매니저를 해임할 권한이 없습니다." });
        return;
      }
      const password = managerPasswordForStaffAction("부매니저 해임");
      if (password === null) return;
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/submanager/${encodeURIComponent(targetUid)}`, {
        method: "DELETE",
        body: JSON.stringify({ password })
      }).then((result) => {
        if (!result?.success) {
          setBoardManageFeedback({ type: "error", message: result?.message || "부매니저 해임에 실패했습니다." });
          return;
        }
        setBoardManageFeedback({ type: "success", message: "부매니저를 해임했습니다." });
        return refreshBoardManage(route.params.gid);
      }).catch((error) => setBoardManageFeedback({ type: "error", message: error.message || "부매니저 해임에 실패했습니다." }));
    }

    function transferManager(targetUid, reset) {
      if (!boardManageData?.permissions?.canTransferManager) {
        setBoardManageFeedback({ type: "error", message: "매니저를 위임할 권한이 없습니다." });
        return;
      }
      const password = managerPasswordForStaffAction("매니저 위임");
      if (password === null) return;
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/manager`, {
        method: "POST",
        body: JSON.stringify({ targetUid, password })
      }).then((result) => {
        if (!result?.success) {
          setBoardManageFeedback({ type: "error", message: result?.message || "매니저 위임 요청에 실패했습니다." });
          return;
        }
        if (typeof reset === "function") reset();
        setBoardManageFeedback({ type: "success", message: "매니저 위임 요청을 보냈습니다." });
        return refreshBoardManage(route.params.gid);
      }).catch((error) => setBoardManageFeedback({ type: "error", message: error.message || "매니저 위임 요청에 실패했습니다." }));
    }

    function submitSubmanagerPermissions(targetUid, payload) {
      if (!boardManageData?.permissions?.canAssignSubmanager && !boardManageData?.permissions?.canManageSubmanager) {
        setBoardManageFeedback({ type: "error", message: "부매니저 권한을 변경할 권한이 없습니다." });
        return;
      }
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/submanager/${encodeURIComponent(targetUid)}/permissions`, {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((result) => {
        if (!result?.success) {
          setBoardManageFeedback({ type: "error", message: result?.message || "부매니저 권한 저장에 실패했습니다." });
          return;
        }
        setBoardManageData(result.data || boardManageData);
        setBoardManageFeedback({ type: "success", message: "부매니저 권한을 저장했습니다." });
      }).catch((error) => setBoardManageFeedback({ type: "error", message: error.message || "부매니저 권한 저장에 실패했습니다." }));
    }

    function submitAuth(payload) {
      if (route.name === "login") {
        if (!payload.uid.trim() || !payload.password) {
          setAuthFeedback({ type: "error", message: "아이디와 비밀번호를 입력해 주세요." });
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
          setSession({
            loggedIn: true,
            uid: result.uid || payload.uid.trim(),
            nick: result.nick || payload.uid.trim(),
            nickType: result.nickType || "variable",
            nickIconType: result.nickIconType || "default",
            memberDivision: result.memberDivision || "user"
          });
          navigate("/m", true);
          api("/api/check-login").then((nextSession) => {
            setSession(nextSession);
          }).catch(() => {});
        }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "로그인 요청 중 오류가 발생했습니다." }));
        return;
      }

      if (!payload.uid.trim() || !payload.nick.trim() || !payload.email.trim() || payload.password.length < 8) {
        setAuthFeedback({ type: "error", message: "아이디, 닉네임, 이메일, 8자 이상 비밀번호를 입력해 주세요." });
        return;
      }
      if (!payload.signupTermsAgreed) {
        setAuthFeedback({ type: "error", message: "약관 및 개인정보 수집 동의가 필요합니다." });
        return;
      }

      if (!payload.verificationSent || payload.resendOnly) {
        api("/api/signup/request", {
          method: "POST",
          body: JSON.stringify({
            userID: payload.uid.trim(),
            username: payload.nick.trim(),
            email: payload.email.trim(),
            password: payload.password,
            nickType: payload.nickType || "variable",
            acceptedTerms: "true",
            acceptedPrivacy: "true",
            acceptedOperations: "true"
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
        setAuthFeedback({ type: "error", message: "인증 코드를 입력해 주세요." });
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
        setAuthFeedback({ type: "success", message: result.message || "회원가입이 완료되었습니다. 로그인으로 이동합니다." });
        setTimeout(() => navigate("/m/signin"), 450);
      }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "이메일 인증 확인 중 오류가 발생했습니다." }));
    }

    function submitPost(payload, reset) {
      if (!payload.title || !String(payload.content || "").trim()) {
        setWriteFeedback({ type: "error", message: "내용을 입력해주세요." });
        return;
      }
      if (!session?.loggedIn && (!payload.name || !payload.password)) {
        setWriteFeedback({ type: "error", message: "비회원은 이름과 비밀번호를 반드시 입력해야 합니다." });
        return;
      }
      const categoryOptions = categoryOptionsFromSettings(boardSettings);
      if (categoryOptions.length && !categoryOptions.includes(payload.category)) {
        setWriteFeedback({ type: "error", message: "사용할 수 없는 말머리입니다." });
        return;
      }
      api("/api/posts/write", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result.success) {
            setWriteFeedback({ type: "error", message: result.message || "게시글 작성에 실패했습니다." });
            return;
          }
          setWriteFeedback({ type: "success", message: "게시글을 등록했습니다." });
          if (typeof reset === "function") reset();
          setTimeout(() => navigate(`/m/board/${encodeURIComponent(payload.gid)}`), 350);
        })
        .catch((error) => setWriteFeedback({ type: "error", message: error.message || "게시글 작성 중 오류가 발생했습니다." }));
    }

    function submitComment(payload, reset) {
      if (!payload.content) {
        setCommentFeedback({ type: "error", message: "댓글 내용을 입력해 주세요." });
        return;
      }
      if (!session?.loggedIn && (!payload.name || !payload.password)) {
        setCommentFeedback({ type: "error", message: "비회원은 이름과 비밀번호를 반드시 입력해야 합니다." });
        return;
      }
      api("/api/posts/comment", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result.success) {
            setCommentFeedback({ type: "error", message: result.message || "댓글 등록에 실패했습니다." });
            return;
          }
          setCommentFeedback({ type: "success", message: "댓글을 등록했습니다." });
          if (typeof reset === "function") reset();
          return refreshCurrentPost(payload.gid, payload.postNo);
        })
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 등록 중 오류가 발생했습니다." }));
    }

    function deletePost(post) {
      const guestPost = !post?.writer_uid;
      const password = guestPost ? window.prompt("비회원 글 삭제 비밀번호를 입력하세요.") : "";
      if (guestPost && password === null) return;
      api("/api/posts/delete", {
        method: "POST",
        body: JSON.stringify({
          gid: post?.gall_id || route.params.gid,
          postNo: post?.post_no || route.params.postNo,
          password: password || ""
        })
      }).then((result) => {
        if (!result?.success) {
          setCommentFeedback({ type: "error", message: result?.message || "게시글 삭제에 실패했습니다." });
          return;
        }
        setCommentFeedback({ type: "success", message: "게시글을 삭제했습니다." });
        navigate(`/m/board/${encodeURIComponent(route.params.gid)}`, true);
      }).catch((error) => setCommentFeedback({ type: "error", message: error.message || "게시글 삭제 중 오류가 발생했습니다." }));
    }

    function deleteComment(comment) {
      const commentId = comment?.id || comment?.comment_id;
      if (!commentId) {
        setCommentFeedback({ type: "error", message: "삭제할 댓글을 찾지 못했습니다." });
        return;
      }
      const guestComment = !comment?.writer_uid;
      const password = guestComment ? window.prompt("비회원 댓글 삭제 비밀번호를 입력하세요.") : "";
      if (guestComment && password === null) return;
      api("/api/posts/comment/delete", {
        method: "POST",
        body: JSON.stringify({ commentId, password: password || "" })
      }).then((result) => {
        if (!result?.success) {
          setCommentFeedback({ type: "error", message: result?.message || "댓글 삭제에 실패했습니다." });
          return;
        }
        setCommentFeedback({ type: "success", message: "댓글을 삭제했습니다." });
        return refreshCurrentPost(route.params.gid, route.params.postNo);
      }).catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 삭제 중 오류가 발생했습니다." }));
    }

    function submitVote(payload) {
      api("/api/posts/vote", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result?.success) {
            setCommentFeedback({ type: "error", message: result?.message || "투표 처리에 실패했습니다." });
            if (result?.voteState) {
              setPostData((current) => ({ ...current, voteState: result.voteState }));
            }
            return;
          }
          setCommentFeedback({ type: "success", message: result?.message || "투표를 반영했습니다." });
          setPostData((current) => ({
            ...current,
            post: current.post ? { ...current.post, ...(result.post || {}) } : current.post,
            voteState: result.voteState || current.voteState
          }));
        })
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "투표 처리 중 오류가 발생했습니다." }));
    }

    function submitBoardRequest(payload, reset) {
      if (!session?.loggedIn) {
        setBoardRequestFeedback({ type: "error", message: "로그인해야 요청할 수 있습니다." });
        return;
      }
      if (!payload.gallId?.trim() || !payload.gallName?.trim() || !payload.topicId?.trim() || !payload.reason?.trim()) {
        setBoardRequestFeedback({ type: "error", message: "보드 ID, 이름, 주제, 요청 사유를 모두 입력해 주세요." });
        return;
      }
      api("/api/board/request/side-board", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result.success) {
            setBoardRequestFeedback({ type: "error", message: result.message || "보드 개설 요청에 실패했습니다." });
            return;
          }
          if (typeof reset === "function") reset();
          setBoardRequestFeedback({ type: "success", message: result.message || "보드 개설 요청을 보냈습니다." });
          api("/api/board/my")
            .then((dashboard) => setBoardDashboard(dashboard?.success && dashboard.data ? dashboard.data : { requestedBoards: [], managedBoards: [] }))
            .catch(() => setBoardDashboard({ requestedBoards: [], managedBoards: [] }));
          return refreshAlarms();
        })
        .catch((error) => setBoardRequestFeedback({ type: "error", message: error.message || "보드 개설 요청 중 오류가 발생했습니다." }));
    }

    function acceptAlarm(alarmId) {
      api(`/api/alarms/${encodeURIComponent(alarmId)}/accept`, { method: "POST" })
        .then((result) => {
          setAlarmFeedback({ type: result?.success ? "success" : "error", message: result?.message || "알림을 수락했습니다." });
          return refreshAlarms();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 수락에 실패했습니다." }));
    }

    function rejectAlarm(alarmId) {
      api(`/api/alarms/${encodeURIComponent(alarmId)}/reject`, { method: "POST" })
        .then((result) => {
          setAlarmFeedback({ type: result?.success ? "success" : "error", message: result?.message || "알림을 거절했습니다." });
          return refreshAlarms();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 거절에 실패했습니다." }));
    }

    function markAllAlarmsRead() {
      api("/api/features/notifications/read-all", { method: "POST" })
        .then((result) => {
          setAlarmFeedback({ type: result?.success ? "success" : "error", message: result?.message || "모든 알림을 읽음 처리했습니다." });
          return refreshAlarms();
        })
        .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 읽음 처리에 실패했습니다." }));
    }

    function saveProfile(payload) {
      api("/api/profile/me/settings", { method: "POST", body: JSON.stringify(payload) })
        .then((result) => {
          if (!result?.success) {
            setProfileFeedback({ type: "error", message: result?.message || "프로필 저장에 실패했습니다." });
            return;
          }
          setProfileData(result.data || null);
          setProfileFeedback({ type: "success", message: "프로필을 저장했습니다." });
        })
        .catch((error) => setProfileFeedback({ type: "error", message: error.message || "프로필 저장에 실패했습니다." }));
    }

    function deleteProfileHistory(scope) {
      api("/api/profile/me/history/delete", { method: "POST", body: JSON.stringify({ scope }) })
        .then((result) => {
          if (!result?.success) {
            setProfileFeedback({ type: "error", message: result?.message || "기록 삭제에 실패했습니다." });
            return;
          }
          setProfileFeedback({ type: "success", message: "기록을 삭제했습니다." });
          if (route.name === "profile") {
            const endpoint = route.params.uid ? `/api/profile/${encodeURIComponent(route.params.uid)}` : "/api/profile/me";
            return api(endpoint).then((next) => setProfileData(next?.success ? next.data : null));
          }
        })
        .catch((error) => setProfileFeedback({ type: "error", message: error.message || "기록 삭제에 실패했습니다." }));
    }

    function followProfile(targetUid) {
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

    function scrapPost(post) {
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/scrap`, { method: "POST" })
        .then((result) => setCommentFeedback({ type: result?.success ? "success" : "error", message: result?.message || "스크랩 상태를 반영했습니다." }))
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "스크랩에 실패했습니다." }));
    }

    function reportPost(post) {
      if (!importantActionConfirm("게시글 신고", [
        "허위 또는 반복 신고는 제한 대상이 될 수 있습니다.",
        "신고 사유는 운영 검토 자료로 전달됩니다."
      ])) return;
      const reason = window.prompt("신고 사유를 입력해 주세요.") || "";
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/report`, { method: "POST", body: JSON.stringify({ reason }) })
        .then((result) => setCommentFeedback({ type: result?.success ? "success" : "error", message: result?.message || "신고를 접수했습니다." }))
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "신고에 실패했습니다." }));
    }

    function likeComment(comment) {
      const commentId = comment.id || comment.comment_id;
      api(`/api/features/comments/${encodeURIComponent(commentId)}/like`, { method: "POST" })
        .then((result) => {
          setCommentFeedback({ type: result?.success ? "success" : "error", message: result?.message || "댓글 공감을 반영했습니다." });
          return refreshCurrentPost(route.params.gid, route.params.postNo);
        })
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 공감에 실패했습니다." }));
    }

    function reportComment(comment) {
      const commentId = comment.id || comment.comment_id;
      if (!importantActionConfirm("댓글 신고", [
        "허위 또는 반복 신고는 제한 대상이 될 수 있습니다.",
        "신고 사유는 운영 검토 자료로 전달됩니다."
      ])) return;
      const reason = window.prompt("댓글 신고 사유를 입력해 주세요.") || "";
      api(`/api/features/comments/${encodeURIComponent(commentId)}/report`, { method: "POST", body: JSON.stringify({ reason }) })
        .then((result) => setCommentFeedback({ type: result?.success ? "success" : "error", message: result?.message || "댓글 신고를 접수했습니다." }))
        .catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 신고에 실패했습니다." }));
    }

    if (route.name === "home") return h(HomeView, { session, boards, feed, onLogout: handleLogout, alarmCount });
    if (route.name === "feed") return h(FeedView, { session, feed, onLogout: handleLogout, alarmCount });
    if (route.name === "search") return h(SearchView, { session, boards, posts: searchResults, searchQuery, onLogout: handleLogout, alarmCount });
    if (route.name === "boards") return h(BoardsView, { session, boards, query, onChangeQuery: setQuery, onLogout: handleLogout, alarmCount });
    if (route.name === "boardRequest") return h(BoardRequestView, { session, feedback: boardRequestFeedback, boardDashboard, onSubmitRequest: submitBoardRequest, onLogout: handleLogout, alarmCount });
    if (route.name === "board") return h(BoardView, { session, gid: route.params.gid, board: currentBoard, posts: boardPosts, page, settings: boardSettings, manageData: boardManageData, listFeedback: boardPostsFeedback, onPrev: () => setPage((value) => Math.max(1, value - 1)), onNext: () => setPage((value) => value + 1), onLogout: handleLogout, alarmCount });
    if (route.name === "boardManage") return h(MBoardManageView, { session, gid: route.params.gid, board: currentBoard, manageData: boardManageData, feedback: boardManageFeedback, onSaveSubmanagerPermissions: submitSubmanagerPermissions, onAppointSubmanager: appointSubmanager, onRevokeSubmanager: revokeSubmanager, onTransferManager: transferManager, onLogout: handleLogout, alarmCount });
    if (route.name === "post") return h(PostView, { session, gid: route.params.gid, postNo: route.params.postNo, post: postData.post, comments: postData.comments, feedback: commentFeedback, voteFeedback: commentFeedback, voteState: postData.voteState, settings: boardSettings, manageData: boardManageData, onSubmitComment: submitComment, onDeletePost: deletePost, onDeleteComment: deleteComment, onVote: submitVote, onScrapPost: scrapPost, onReportPost: reportPost, onLikeComment: likeComment, onReportComment: reportComment, onLogout: handleLogout, alarmCount });
    if (route.name === "write") return h(WriteView, { session, gid: route.params.gid, feedback: writeFeedback, settings: boardSettings, manageData: boardManageData, onSubmitPost: submitPost, onLogout: handleLogout, alarmCount });
    if (route.name === "profile") return h(ProfileView, { session, profileData, feedback: profileFeedback, onSaveProfile: saveProfile, onDeleteHistory: deleteProfileHistory, onFollowProfile: followProfile, onUnfollowProfile: unfollowProfile, onLogout: handleLogout, alarmCount });
    if (route.name === "alarms") return h(AlarmsView, { session, alarms, feedback: alarmFeedback, onAcceptAlarm: acceptAlarm, onRejectAlarm: rejectAlarm, onMarkAllRead: markAllAlarmsRead, onLogout: handleLogout, alarmCount });
    if (route.name === "login") return h(AuthView, { mode: "login", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    if (route.name === "signup") return h(AuthView, { mode: "signup", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    return h(NotFoundView, { session, onLogout: handleLogout, alarmCount });
  }

  const root = document.getElementById("mobile-app");
  if (root) {
    ReactDOM.createRoot(root).render(h(App));
  }
})();



