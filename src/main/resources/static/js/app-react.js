(() => {
  const h = React.createElement;
  const { useEffect, useRef, useState } = React;

  const MAX_IMAGE_UPLOAD_BYTES = 50 * 1024 * 1024;
  const isMobilePath = window.location.pathname === "/m" || window.location.pathname.startsWith("/m/");
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
    if (!isUnsafeMethod(method) || !(url === "/login" || url === "/admin/login" || url.startsWith("/api/"))) {
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

  const appHref = (href) => {
    if (!isMobilePath || !href.startsWith("/") || href.startsWith("/m")) return href;
    return href === "/" ? "/m" : `/m${href}`;
  };

  const SUBMANAGER_PERMISSION_FIELDS = [
    ["can_delete_post", "게시글 삭제"],
    ["can_delete_comment", "댓글 삭제"],
    ["can_manage_write", "작성 권한 지정"],
    ["can_manage_guest_penalty", "비회원 불이익 설정"],
    ["can_manage_tags", "태그 설정"],
    ["can_manage_images", "이미지 차단/등록 권한"],
    ["can_manage_notice", "공지 등록"],
    ["can_manage_categories", "말머리 추가"],
    ["can_manage_cover", "대문 변경"],
    ["can_ban_user", "사용자 차단"],
    ["can_manage_forbidden_word", "금지 단어"],
    ["can_bump_post", "게시글 끌올"],
    ["can_manage_concept", "개념글 지정/취소"],
    ["can_manage_concept_cut", "개념컷 설정"],
    ["can_manage_submanager", "부매니저 권한제어"]
  ];

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

  const getSearchQueryFromLocation = () => (new URLSearchParams(window.location.search).get("q") || "").trim();
  const getBoardTypeFromLocation = () => (new URLSearchParams(window.location.search).get("type") || "all").trim().toLowerCase();

  const authorLabel = (item) => {
    if (!item) return "익명";
    if (item.writer_uid) return item.name || item.writer_uid;
    return item.name || "익명";
  };

  const normalizeNickType = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return ["fixed", "fix", "f", "1", "true", "고정", "고정닉"].includes(normalized) ? "fixed" : "variable";
  };
  const nickTypeLabel = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return ["fixed", "fix", "f", "1", "true", "고정", "고정닉"].includes(normalized) ? "고정닉" : "비고정닉";
  };
  const displayCategory = (item) => item?.display_category || item?.category || "일반";

  const normalizeBoardRole = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "manager") return "manager";
    if (normalized === "submanager") return "submanager";
    return "";
  };
  const boardRoleLabel = (value) => value === "manager" ? "M" : value === "submanager" ? "S" : "";

  function NickTypeBadge({ nickType, uid }) {
    const normalized = normalizeNickType(nickType);
    const className = `nick-type-badge ${normalized === "fixed" ? "is-fixed" : "is-variable"}`;
    const label = nickTypeLabel(normalized);
    return uid
        ? h(Link, { href: `/profile/${encodeURIComponent(uid)}`, className, title: `${uid} 프로필` }, label)
        : h("span", { className }, label);
  }

  function BoardRoleBadge({ role }) {
    const normalized = normalizeBoardRole(role);
    if (!normalized) return null;
    return h("span", {
      className: `board-role-icon is-${normalized}`,
      title: normalized === "manager" ? "매니저" : "부매니저"
    }, boardRoleLabel(normalized));
  }

  function MemberIdentity({ item, name, uid, nickType, className = "member-identity" }) {
    const resolvedName = name || authorLabel(item) || uid || "익명";
    const resolvedUid = uid || item?.writer_uid || "";
    const resolvedNickType = nickType || item?.nick_type || item?.nickType || "variable";
    const resolvedRole = item?.author_board_role || item?.board_role || item?.role || "";
    return h("span", { className },
        h("span", { className: "member-name" }, resolvedName),
        resolvedRole ? h(BoardRoleBadge, { role: resolvedRole }) : (resolvedUid ? h(NickTypeBadge, { nickType: resolvedNickType, uid: resolvedUid }) : null)
    );
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

  const SIGNUP_REQUIRED_TERMS = [
    "서비스 이용 약관과 커뮤니티 운영 원칙을 확인하였습니다.",
    "개인정보 수집 및 이용에 동의합니다. (수집 항목: 아이디, 닉네임, 이메일, 비밀번호 해시)",
    "이메일 인증, 계정 보호, 비회원 식별 보조 목적으로 정보 처리 안내를 확인하였습니다."
  ];

  const BOARD_REQUEST_TERMS = [
    "중복되거나 목적이 불명확한 개설 신청은 반려될 수 있음을 확인하였습니다.",
    "신청 내용은 운영 검토 후 승인 시에만 실제 보드 생성으로 이어짐을 확인하였습니다."
  ];

  const WRITE_TERMS = [
    "작성 내용의 책임은 작성자에게 있으며 운영 정책과 보드 규칙을 따르겠습니다.",
    "입력 내용은 HTML 형식으로 저장되고 다른 이용자에게 공개될 수 있음을 확인하였습니다."
  ];

  const COMMENT_TERMS = [
    "댓글 내용의 책임은 작성자에게 있으며 신고 또는 삭제 요청의 대상이 될 수 있음을 확인하였습니다.",
    "비회원 댓글의 이름, 비밀번호, 접속 정보가 작성자 식별 보조 수단으로 사용될 수 있음을 확인하였습니다."
  ];

  const importantActionConfirm = (title, lines) => window.confirm(`${title}\n\n${lines.map((line, index) => `${index + 1}. ${line}`).join("\n")}`);

  const generateCaptchaCode = () => Math.random().toString(36).slice(2, 7);

  function matchRoute(pathname) {
    const path = normalizePathname(pathname);
    if (path === "/") return { name: "home", params: {} };
    if (path === "/signin") return { name: "login", params: {} };
    if (path === "/admin-login") return { name: "adminLogin", params: {} };
    if (path === "/nid") return { name: "signup", params: {} };
    if (path === "/alarms") return { name: "alarms", params: {} };
    if (path === "/board-requests") return { name: "boardRequests", params: {} };
    if (path === "/profile") return { name: "profile", params: {} };
    if (path === "/boards" || path === "/board_main") return { name: "boards", params: {} };
    if (path === "/feed") return { name: "feed", params: {} };
    if (path === "/search") return { name: "search", params: {} };
    let match = path.match(/^\/profile\/([^/]+)$/);
    if (match) return { name: "profile", params: { uid: decodeURIComponent(match[1]) } };
    match = path.match(/^\/board\/([^/]+)\/write$/);
    if (match) return { name: "write", params: { gid: decodeURIComponent(match[1]) } };
    match = path.match(/^\/board\/([^/]+)\/(?:manage|settings)$/);
    if (match) return { name: "boardManage", params: { gid: decodeURIComponent(match[1]) } };
    match = path.match(/^\/board\/([^/]+)\/staff$/);
    if (match) return { name: "boardStaffManage", params: { gid: decodeURIComponent(match[1]) } };
    match = path.match(/^\/board\/([^/]+)\/([^/]+)$/);
    if (match) return { name: "post", params: { gid: decodeURIComponent(match[1]), postNo: decodeURIComponent(match[2]) } };
    match = path.match(/^\/board\/([^/]+)$/);
    if (match) return { name: "board", params: { gid: decodeURIComponent(match[1]) } };
    return { name: "notFound", params: {} };
  }

  function navigate(path, replace = false) {
    const target = appHref(path);
    if (isServerRenderedPath(target)) {
      if (replace) window.location.replace(target);
      else window.location.assign(target);
      return;
    }
    if (replace) window.history.replaceState({}, "", target);
    else window.history.pushState({}, "", target);
    window.dispatchEvent(new Event("app:navigate"));
  }

  function isServerRenderedPath(path) {
    const clean = String(path || "").split("#")[0];
    return clean === "/board"
      || clean === "/board_main"
      || clean.startsWith("/board?")
      || clean.startsWith("/boards")
      || clean.startsWith("/board/");
  }

  function Link({ href, className, children, reload = false }) {
    const target = appHref(href);
    return h("a", {
      href: target,
      className,
      onClick(event) {
        if (reload || !href.startsWith("/") || isServerRenderedPath(target)) return;
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

  function ConsentChecklist({ title = "사전 동의", items = [], checked = false, onToggle, requiredLabel = "모든 항목을 확인하고 동의합니다." }) {
    return h("div", { className: "consent-box" },
        h("div", { className: "consent-title" }, title),
        h("div", { className: "consent-list" },
            items.map((item, index) => h("div", { className: "consent-item", key: `${title}-${index}` }, item))
        ),
        h("label", { className: "check-row consent-check" },
            h("input", { type: "checkbox", checked, onChange: (event) => onToggle?.(event.target.checked) }),
            h("span", null, requiredLabel)
        )
    );
  }

  function Topbar({ session, onLogout, alarmCount = 0 }) {
    const navItems = [
      { label: "홈", href: "/" },
      { label: "보드", href: "/boards" },
      { label: "개설 신청", href: "/board-requests" },
      { label: "피드", href: "/" },
      { label: "내정보", href: "/profile", auth: true },
      { label: alarmCount > 0 ? `알림 ${alarmCount}` : "알림", href: "/alarms", auth: true }
    ];
    return h("header", { className: "topbar" },
        h("div", { className: "frame" },
            h("div", { className: "topbar-inner" },
                h("div", { className: "topbar-main" },
                    h(Link, { href: "/", className: "brand" }, h("span", { className: "brand-mark" }, "I"), h("span", null, "Irisen")),
                    h("div", { className: "topbar-search" },
                        h("button", { type: "button", className: "topbar-menu", "aria-label": "메뉴" }, h("span"), h("span"), h("span")),
                        h("span", { className: "topbar-search-placeholder" }, "보드 & 게시글 검색"),
                        h("span", { className: "topbar-search-icon", "aria-hidden": "true" })
                    ),
                    h("div", { className: "topbar-account" },
                        session?.loggedIn
                            ? [
                              h("span", { className: "chip", key: "nick" }, h(MemberIdentity, { name: session.nick || session.uid, uid: session.uid, nickType: session.nickType, className: "member-identity inline" })),
                              h("button", { type: "button", className: "btn btn-secondary btn-compact", key: "logout", onClick: onLogout }, "로그아웃")
                            ]
                            : [
                              h(Link, { href: "/signin", className: "btn btn-secondary btn-compact", key: "login" }, "로그인"),
                              h(Link, { href: "/nid", className: "btn btn-primary btn-compact", key: "signup" }, "가입")
                            ]
                    )
                ),
                h("nav", { className: "topbar-nav", "aria-label": "주요 메뉴" },
                    navItems.map((item) =>
                        !item.auth || session?.loggedIn
                            ? h(Link, { key: item.href + item.label, href: item.href, className: item.label === "보드" ? "is-active" : "" }, item.label)
                            : null
                    ),
                    session?.loggedIn ? null : h(Link, { href: "/signin", className: "topbar-nav-auth" }, "로그인")
                )
            )
        )
    );
  }

  function TopbarV2({ session, onLogout, alarmCount = 0 }) {
    const [searchText, setSearchText] = useState(getSearchQueryFromLocation());
    const currentPath = normalizePathname(window.location.pathname);
    const boardType = getBoardTypeFromLocation();

    useEffect(() => {
      setSearchText(getSearchQueryFromLocation());
    }); // 의존성 배열에 window.location은 반응형이 아니므로 제거

    const navItems = [
      { label: "홈", href: "/", active: currentPath === "/" },
      { label: "보드", href: "/boards?type=main", active: currentPath === "/boards" && boardType !== "side" },
      { label: "사이드 보드", href: "/boards?type=side", active: currentPath === "/boards" && boardType === "side" },
      { divider: true },
      { label: "피드", href: "/feed", active: currentPath === "/feed" }
    ];

    const submitSearch = (event) => {
      event.preventDefault();
      const q = searchText.trim();
      navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/boards");
    };

    return h("header", { className: "topbar" },
        h("div", { className: "frame" },
            h("div", { className: "topbar-inner" },
                h("div", { className: "topbar-main" },
                    h(Link, { href: "/", className: "brand" }, h("span", { className: "brand-mark" }, "/"), h("span", null, "Irisen")),
                    h("form", { className: "topbar-search", onSubmit: submitSearch },
                        h("button", { type: "button", className: "topbar-menu", "aria-label": "메뉴" }, h("span"), h("span"), h("span")),
                        h("input", {
                          type: "search",
                          className: "topbar-search-input",
                          placeholder: "보드 & 게시글 검색",
                          value: searchText,
                          onChange: (event) => setSearchText(event.target.value)
                        }),
                        h("button", { type: "submit", className: "topbar-search-submit", "aria-label": "검색" },
                            h("span", { className: "topbar-search-icon", "aria-hidden": "true" })
                        )
                    ),
                    h("div", { className: "topbar-account" },
                        session?.loggedIn
                            ? [
                              h("span", { className: "chip", key: "nick" }, h(MemberIdentity, { name: session.nick || session.uid, uid: session.uid, nickType: session.nickType, className: "member-identity inline" })),
                              h("button", { type: "button", className: "btn btn-secondary btn-compact", key: "logout", onClick: onLogout }, "로그아웃")
                            ]
                            : [
                              h(Link, { href: "/signin", className: "btn btn-secondary btn-compact", key: "login" }, "로그인"),
                              h(Link, { href: "/nid", className: "btn btn-primary btn-compact", key: "signup" }, "가입")
                            ]
                    )
                ),
                h("nav", { className: "topbar-nav", "aria-label": "주요 메뉴" },
                    navItems.map((item, index) =>
                        item.divider
                            ? h("span", { key: `divider-${index}`, className: "topbar-nav-divider", "aria-hidden": "true" }, "||")
                            : h(Link, { key: item.href + item.label, href: item.href, className: item.active ? "is-active" : "" }, item.label)
                    ),
                    session?.loggedIn
                        ? h(Link, { href: "/profile", className: "topbar-nav-auth" }, alarmCount > 0 ? `알림 ${alarmCount}` : "프로필")
                        : h(Link, { href: "/signin", className: "topbar-nav-auth" }, "로그인")
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

  function HtmlEditor({ id, value, onChange, placeholder, gallId, canUploadImage = window.__boardWriteCanUploadImage !== false }) {
    const editorRef = useRef(null);
    const fileInputRef = useRef(null);
    const [uploadFeedback, setUploadFeedback] = useState(null);
    const [imageUploading, setImageUploading] = useState(false);
    const resolvedGallId = gallId || window.location.pathname.split("/")[2] || "";

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

    async function uploadEditorImage(file) {
      if (!file) return;
      setUploadFeedback(null);
      if (!canUploadImage) {
        setUploadFeedback({ type: "error", message: "현재 권한에서는 이미지 첨부를 사용할 수 없습니다." });
        return;
      }
      if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
        setUploadFeedback({ type: "error", message: "이미지는 최대 50MB까지 업로드할 수 있습니다." });
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
          },
          onPaste: handlePaste
        }),
        h(Feedback, { feedback: uploadFeedback })
    );
  }

  function HomeView({ session, boards, feed, onLogout, alarmCount }) {
    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
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
                    h(PermissionNotice, { label: "이 화면은 누구나 볼 수 있습니다.", detail: "로그인 없이 보드 탐색과 추천 글 확인이 가능합니다." }),
                    h(PermissionMatrix, { items: [
                        { action: "홈 보기", required: "전체 사용자", available: true },
                        { action: "추천 글 보기", required: "전체 사용자", available: true },
                        { action: "로그인 개인 기능 사용", required: "가입된 사용자", available: !!session?.loggedIn }
                      ] }),
                    h(SectionHead, { eyebrow: "Feed", title: "추천 글" }),
                    feed.length
                        ? h("div", { className: "stack" }, feed.map((post) =>
                            h(Link, { href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, className: "card quick-card", key: `${post.gall_id}-${post.post_no}`, reload: true },
                                h("div", { className: "board-title" }, post.title || "제목 없음"),
                                h("div", { className: "muted" }, h("span", null, `${post.gall_name || post.gall_id} · `), h(MemberIdentity, { item: post, className: "member-identity inline" }))
                            )))
                        : h("div", { className: "empty-box" }, "추천 글이 없습니다."),
                    h("div", { className: "muted" }, `전체 보드 ${boards.length}개`)
                )
            )
        )
    );
  }

  function BoardsView({ session, boards, query, boardTypeFilter = "all", onQueryChange, onLogout, alarmCount }) {
    const q = query.trim().toLowerCase();
    const typed = boards.filter((board) => {
      const type = String(board?.gall_type || "").toLowerCase();
      if (boardTypeFilter === "side") {
        return type === "m" || type === "side" || type === "minor" || type === "s";
      }
      if (boardTypeFilter === "main") {
        return type === "main" || type === "";
      }
      return true;
    });
    const filtered = typed.filter((board) => !q || String(board.gall_id || "").toLowerCase().includes(q) || String(board.gall_name || "").toLowerCase().includes(q));
    const half = Math.ceil(filtered.length / 2);
    const columns = [filtered.slice(0, half), filtered.slice(half)];
    const boardHeading = boardTypeFilter === "side" ? "사이드 보드" : boardTypeFilter === "main" ? "보드" : "전체 보드";

    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "section-stack board-directory-page" },
                    h(PermissionNotice, {
                      label: "보드 목록은 누구나 볼 수 있습니다.",
                      detail: "사이드 보드 개설 요청은 로그인한 사용자만 보낼 수 있습니다."
                    }),
                    h(PermissionMatrix, { items: [
                        { action: "보드 목록 보기", required: "전체 사용자", available: true },
                        { action: "사이드 보드 개설 요청", required: "로그인 사용자", available: !!session?.loggedIn, note: "요청은 관리자 또는 운영자가 승인해야 반영됩니다." }
                      ] }),
                    h("article", { className: "card board-directory-hero" },
                        h("span", { className: "eyebrow" }, "Boards"),
                        h("div", { className: "board-directory-hero-head" },
                            h("div", null,
                                h("h1", { className: "section-title" }, "보드 디렉터리"),
                                h("p", { className: "muted board-directory-copy" }, "메인 보드와 사이드 보드를 한 번에 살펴보고 원하는 보드가 없으면 개설 요청을 보낼 수 있습니다.")
                            ),
                            h("div", { className: "board-directory-search" },
                                h("label", { htmlFor: "board-search", className: "hidden" }, "검색"),
                                h("input", { id: "board-search", type: "text", value: query, placeholder: "보드 이름 또는 ID", onChange: (event) => onQueryChange(event.target.value) })
                            )
                        ),
                        h("div", { className: "board-directory-actions" },
                            h(Link, { href: "/board-requests", className: "btn btn-primary" }, "사이드 보드 개설"),
                            h("span", { className: "chip" }, `전체 ${boards.length}개`)
                        )
                    ),
                    h("div", { className: "board-directory-layout" },
                        filtered.length
                            ? h("article", { className: "card board-directory-card" },
                                h("div", { className: "board-directory-meta" },
                                    h("strong", null, "전체 보드"),
                                    h("span", { className: "chip" }, `${filtered.length}개`)
                                ),
                                h("div", { className: "board-directory-columns" },
                                    columns.map((items, columnIndex) =>
                                        h("div", { className: "board-directory-column", key: `column-${columnIndex}` },
                                            items.map((board, index) =>
                                                h(Link, { href: `/board/${encodeURIComponent(board.gall_id)}`, className: "board-directory-entry", key: board.gall_id, reload: true },
                                                    h("span", { className: "board-directory-rank" }, `${columnIndex === 0 ? index + 1 : half + index + 1}.`),
                                                    h("strong", { className: "board-directory-name" }, board.gall_name || board.gall_id),
                                                    h("span", { className: "board-directory-sub" }, `${board.gall_id} · ${board.post_count ?? 0} posts`)
                                                )
                                            )
                                        )
                                    )
                                )
                            )
                            : h("div", { className: "empty-box" }, "검색 결과가 없습니다.")
                    )
                )
            )
        )
    );
  }

  function BoardRequestsView({ session, feedback, boardDashboard, onSubmitSideBoardRequest, onLogout, alarmCount }) {
    const [requestGid, setRequestGid] = useState("");
    const [requestName, setRequestName] = useState("");
    const [requestTopicId, setRequestTopicId] = useState("");
    const [boardTopics, setBoardTopics] = useState([]);
    const [requestReason, setRequestReason] = useState("");
    const [requestAgreed, setRequestAgreed] = useState(false);
    const normalizedGid = requestGid.trim().toLowerCase();
    const gidValid = /^[a-z0-9_-]{3,50}$/.test(normalizedGid);
    const nameValid = requestName.trim().length >= 2 && requestName.trim().length <= 100;
    const topicValid = !!requestTopicId;
    const reasonValid = requestReason.trim().length >= 10;

    useEffect(() => {
      let active = true;
      api("/api/board/topics")
          .then((result) => {
            if (!active) return;
            const topics = result?.success && Array.isArray(result.topics) ? result.topics : [];
            setBoardTopics(topics);
            setRequestTopicId((current) => current || topics[0]?.topic_id || "");
          })
          .catch(() => {
            if (active) setBoardTopics([]);
          });
      return () => {
        active = false;
      };
    }, []);

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

    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "section-stack board-request-page" },
                    h("article", { className: "card board-request-hero" },
                        h("span", { className: "eyebrow" }, "Application"),
                        h("h1", { className: "section-title" }, "사이드 보드 개설 신청"),
                        h("p", { className: "muted board-request-hero-copy" }, "현재 운영 중인 목록에 없는 주제를 별도 보드로 열고 싶다면 아래 규격과 심사 기준에 맞춰 개설 신청을 제출할 수 있습니다.")
                    ),
                    session?.loggedIn ? h("div", { className: "board-request-layout" },
                        h("article", { className: "card board-request-guide" },
                            h("h3", { className: "board-request-title" }, "내가 요청한 보드"),
                            requestedBoards.length
                                ? h("div", { className: "compact-stack" }, requestedBoards.map((board) =>
                                    h("div", { className: "mini-link-card", key: `requested-${board.request_id}` },
                                        h("div", { className: "section-head", style: { marginBottom: 0 } },
                                            h("div", null,
                                                h("div", { className: "board-title" }, board.gall_name || board.gall_id),
                                                h("div", { className: "muted" }, `${board.gall_id || "-"} · ${board.topic_name || board.topic_id || "주제 없음"}`)
                                            ),
                                            h("span", { className: "chip" }, statusLabel(board.status))
                                        )
                                    )
                                ))
                                : h("div", { className: "empty-box" }, "요청 중인 보드가 없습니다.")
                        ),
                        h("article", { className: "card board-request-guide" },
                            h("h3", { className: "board-request-title" }, "내가 관리 중인 보드"),
                            managedBoards.length
                                ? h("div", { className: "compact-stack" }, managedBoards.map((board) =>
                                    h(Link, { href: `/board/${encodeURIComponent(board.gall_id)}/manage`, className: "mini-link-card", key: `managed-${board.board_role}-${board.gall_id}`, reload: true },
                                        h("div", { className: "section-head", style: { marginBottom: 0 } },
                                            h("div", null,
                                                h("div", { className: "board-title" }, board.gall_name || board.gall_id),
                                                h("div", { className: "muted" }, `${board.gall_id || "-"} · ${board.topic_name || board.topic_id || "주제 없음"}`)
                                            ),
                                            h("span", { className: "chip" }, roleLabel(board.board_role))
                                        )
                                    )
                                ))
                                : h("div", { className: "empty-box" }, "관리 중인 보드가 없습니다.")
                        )
                    ) : null,
                    h("div", { className: "board-request-layout" },
                        h("article", { className: "card board-request-guide" },
                            h("h3", { className: "board-request-title" }, "신청 규격"),
                            h("div", { className: "board-request-rule-list" },
                                h("div", { className: "board-request-rule" }, h("strong", null, "보드 ID"), h("span", null, "3~50자의 영소문자, 숫자, _, -만 사용할 수 있으며 실제 보드 주소로 사용됩니다.")),
                                h("div", { className: "board-request-rule" }, h("strong", null, "보드 이름"), h("span", null, "2~100자 범위로 작성하며 기존 보드와 구분되도록 주제를 명확히 적어야 합니다.")),
                                h("div", { className: "board-request-rule" }, h("strong", null, "신청 사유"), h("span", null, "최소 10자 이상. 개설 목적, 예상 이용층, 기존 보드와의 차이를 포함해 주세요.")),
                                h("div", { className: "board-request-rule" }, h("strong", null, "신청 자격"), h("span", null, "로그인 사용자만 제출할 수 있으며 허위 또는 중복 신청은 반려될 수 있습니다.")),
                                h("div", { className: "board-request-rule" }, h("strong", null, "처리 방식"), h("span", null, "관리자 또는 운영자가 알림에서 검토하고 승인하면 실제 보드가 생성됩니다."))
                            ),
                            h("div", { className: "board-request-note" }, "중복 주제, 목적이 불명확하거나 운영 취지에 맞지 않는 신청은 반려될 수 있습니다."),
                            h("h3", { className: "board-request-title" }, "심사 때 확인하는 내용"),
                            h("div", { className: "board-request-rule-list" },
                                h("div", { className: "board-request-rule" }, h("strong", null, "주제 적합성"), h("span", null, "기존 메인 보드와 사이드 보드의 주제가 겹치지 않는지 확인합니다.")),
                                h("div", { className: "board-request-rule" }, h("strong", null, "지속 가능성"), h("span", null, "일회성 이슈가 아닌지, 꾸준한 이용 수요가 예상되는지 검토합니다.")),
                                h("div", { className: "board-request-rule" }, h("strong", null, "운영 적합성"), h("span", null, "분쟁 유발 목적, 광고성, 규정 위반 가능성이 높은 주제는 승인하지 않습니다.")),
                                h("div", { className: "board-request-rule" }, h("strong", null, "처리 결과"), h("span", null, "승인 시 보드가 생성되고, 반려 사유는 관리자 알림 처리 흐름에 따라 확인합니다."))
                            )
                        ),
                        h("article", { className: "card board-request-form-card" },
                            h("h3", { className: "board-request-title" }, "개설 신청 작성"),
                            h("p", { className: "muted board-request-form-copy" }, "아래 항목은 모두 필수입니다. 제출 전 보드 ID와 이름을 다시 확인해 주세요."),
                            !session?.loggedIn
                                ? h("div", { className: "empty-box" }, "로그인해야 개설 신청을 진행할 수 있습니다.")
                                : h("div", { className: "stack" },
                                    h("div", { className: "field" },
                                        h("label", { htmlFor: "board-request-gid" }, "보드 ID"),
                                        h("input", { id: "board-request-gid", type: "text", value: requestGid, placeholder: "예: apple_stock", onChange: (event) => setRequestGid(event.target.value.toLowerCase()) }),
                                        h("div", { className: gidValid || !requestGid ? "request-rule-hint" : "request-rule-hint is-error" }, "영소문자, 숫자, _, - 조합으로 3~50자")
                                    ),
                                    h("div", { className: "field" },
                                        h("label", { htmlFor: "board-request-name" }, "보드 이름"),
                                        h("input", { id: "board-request-name", type: "text", value: requestName, placeholder: "예: 미국 주식", onChange: (event) => setRequestName(event.target.value) }),
                                        h("div", { className: nameValid || !requestName ? "request-rule-hint" : "request-rule-hint is-error" }, "2~100자")
                                    ),
                                    h("div", { className: "field" },
                                        h("label", { htmlFor: "board-request-topic" }, "주제"),
                                        h("select", {
                                          id: "board-request-topic",
                                          value: requestTopicId,
                                          onChange: (event) => setRequestTopicId(event.target.value)
                                        },
                                            h("option", { value: "" }, "주제를 선택하세요"),
                                            boardTopics.map((topic) => h("option", {
                                              key: topic.topic_id,
                                              value: topic.topic_id
                                            }, topic.topic_name || topic.topic_id))
                                        ),
                                        h("div", { className: topicValid ? "request-rule-hint" : "request-rule-hint is-error" }, "개설 이후 주제는 변경할 수 없습니다.")
                                    ),
                                    h("div", { className: "field" },
                                        h("label", { htmlFor: "board-request-reason" }, "요청 사유"),
                                        h("textarea", { id: "board-request-reason", rows: 8, value: requestReason, placeholder: "개설 목적, 예상 이용층, 기존 보드와의 차이, 운영 방향을 적어주세요.", onChange: (event) => setRequestReason(event.target.value) }),
                                        h("div", { className: reasonValid || !requestReason ? "request-rule-hint" : "request-rule-hint is-error" }, `${requestReason.trim().length}/10자 이상`)
                                    ),
                                    h(ConsentChecklist, { title: "개설 신청 전 확인", items: BOARD_REQUEST_TERMS, checked: requestAgreed, onToggle: setRequestAgreed }),
                                    h("div", { className: "board-request-note" }, "제출한 신청은 운영 검토 후 승인 또는 반려됩니다. 승인 전까지 실제 보드는 생성되지 않습니다."),
                                    h(Feedback, { feedback }),
                                    h("div", { className: "inline-actions" },
                                        h("button", {
                                          type: "button",
                                          className: "btn btn-primary",
                                          disabled: !gidValid || !nameValid || !topicValid || !reasonValid || !requestAgreed,
                                          onClick() {
                                            onSubmitSideBoardRequest({ gallId: normalizedGid, gallName: requestName.trim(), topicId: requestTopicId, reason: requestReason.trim() }, () => {
                                              setRequestGid("");
                                              setRequestName("");
                                              setRequestTopicId(boardTopics[0]?.topic_id || "");
                                              setRequestReason("");
                                              setRequestAgreed(false);
                                            });
                                          }
                                        }, "개설 신청 보내기"),
                                        h(Link, { href: "/boards", className: "btn btn-secondary" }, "보드 목록")
                                    )
                                )
                        )
                    )
                )
            )
        )
    );
  }

  // 설정 패널
  function HomePortalView({ session, boards, feed, rankings, rankingFeedback, onRefreshRankings, onLogout, alarmCount }) {
    const normalizedBoards = Array.isArray(boards) ? boards : [];
    const normalizedFeed = Array.isArray(feed) ? feed.slice(0, 8) : [];
    const rankingItems = Array.isArray(rankings?.items) ? rankings.items : [];
    const buckets = normalizedBoards.reduce((acc, board) => {
      const type = String(board?.gall_type || "").toLowerCase();
      if (type === "main") acc.main.push(board);
      else if (type === "m" || type === "side" || type === "minor" || type === "s") acc.side.push(board);
      else acc.other.push(board);
      return acc;
    }, { main: [], side: [], other: [] });

    const renderBoardGroup = (title, items, emptyText) =>
        h("article", { className: "home-board-group card" },
            h("div", { className: "home-board-group-head" },
                h("h3", { className: "home-board-group-title" }, title),
                h("span", { className: "chip" }, `${items.length}개`)
            ),
            items.length
                ? h("div", { className: "home-board-list" }, items.slice(0, 10).map((board) =>
                    h(Link, { href: `/board/${encodeURIComponent(board.gall_id)}`, className: "home-board-link", key: `${title}-${board.gall_id}`, reload: true },
                        h("span", { className: "home-board-link-title" }, board.gall_name || board.gall_id),
                        h("span", { className: "home-board-link-meta" }, `${board.gall_id} · ${board.post_count ?? 0} posts`)
                    )
                ))
                : h("div", { className: "empty-box" }, emptyText)
        );

    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "home-portal" },
                    h("div", { className: "home-portal-main" },
                        h("div", { className: "home-board-columns" },
                            renderBoardGroup("메인보드", buckets.main, "표시할 메인 보드가 없습니다."),
                            renderBoardGroup("사이드보드", buckets.side, "표시할 사이드보드가 없습니다."),
                            renderBoardGroup("기타", buckets.other, "표시할 기타 보드가 없습니다.")
                        ),
                        h("article", { className: "card home-feed-card" },
                            h(SectionHead, { eyebrow: "Live", title: "지금 반응 많은 글" }),
                            normalizedFeed.length
                                ? h("div", { className: "home-feed-list" }, normalizedFeed.map((post, index) =>
                                    h(Link, { href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, className: "home-feed-row", key: `${post.gall_id}-${post.post_no}`, reload: true },
                                        h("span", { className: "home-feed-rank" }, String(index + 1).padStart(2, "0")),
                                        h("div", { className: "home-feed-copy" },
                                            h("div", { className: "home-feed-title" }, post.title || "제목 없음"),
                                            h("div", { className: "home-feed-meta" }, h("span", null, `${post.gall_name || post.gall_id} · `), h(MemberIdentity, { item: post, className: "member-identity inline" }))
                                        )
                                    )
                                ))
                                : h("div", { className: "empty-box" }, "추천 글이 없습니다.")
                        )
                    ),
                    h("aside", { className: "home-portal-side" },
                        h("article", { className: "card home-side-card" },
                            h("span", { className: "eyebrow" }, "Status"),
                            h("h3", { className: "home-side-title" }, session?.loggedIn ? h(MemberIdentity, { name: session.nick || session.uid, uid: session.uid, nickType: session.nickType, className: "member-identity" }) : "게스트 모드"),
                            h("p", { className: "home-side-copy" }, session?.loggedIn ? "프로필, 알림, 작성 기능을 바로 사용할 수 있습니다." : "로그인 없이도 보드와 인기 글을 둘러볼 수 있습니다."),
                            h(PermissionMatrix, { items: [
                                { action: "보드 열람", required: "전체 사용자", available: true },
                                { action: "인기 글 열람", required: "전체 사용자", available: true },
                                { action: "개인화 기능", required: "로그인 사용자", available: !!session?.loggedIn }
                              ] })
                        ),
                        h("article", { className: "card home-side-card board-ranking-card" },
                            h("div", { className: "board-ranking-head" },
                                h("div", null,
                                    h("span", { className: "eyebrow" }, "Ranking"),
                                    h("h3", { className: "home-side-title" }, "보드 랭킹")
                                ),
                                h("span", { className: "chip" }, "자동 갱신")
                            ),
                            h("div", { className: "board-ranking-meta" },
                                h("span", null, `오늘 ${rankings?.refreshCount ?? 0}회`),
                                h("span", null, `남은 ${rankings?.remainingRefreshes ?? 10}회`)
                            ),
                            h(Feedback, { feedback: rankingFeedback }),
                            rankingItems.length
                                ? h("div", { className: "board-ranking-list" }, rankingItems.map((item) =>
                                    h(Link, {
                                          href: `/board/${encodeURIComponent(item.gall_id)}`,
                                          className: "board-ranking-row",
                                          key: `ranking-${item.gall_id}`,
                                          reload: true
                                        },
                                        h("span", { className: "board-ranking-rank" }, item.rank_no),
                                        h("span", { className: "board-ranking-name" }, item.gall_name || item.gall_id),
                                        h("span", { className: "board-ranking-score" }, item.score ?? 0)
                                    )
                                ))
                                : h("div", { className: "empty-box" }, "랭킹 데이터가 없습니다.")
                        ),
                        h("article", { className: "card home-side-card" },
                            h(SectionHead, { eyebrow: "Quick", title: "바로 가기" }),
                            h("div", { className: "compact-stack" },
                                h(Link, { href: "/boards", className: "mini-link-card" },
                                    h("div", { className: "board-title", style: { fontSize: "1rem" } }, "보드 모아보기"),
                                    h("div", { className: "muted" }, "전체 보드와 사이드보드 요청")
                                ),
                                h(Link, { href: session?.loggedIn ? "/profile" : "/signin", className: "mini-link-card" },
                                    h("div", { className: "board-title", style: { fontSize: "1rem" } }, session?.loggedIn ? "내 프로필" : "로그인"),
                                    h("div", { className: "muted" }, session?.loggedIn ? "팔로우와 작성 기록 확인" : "개인 기능 사용을 위해 로그인")
                                )
                            )
                        )
                    )
                )
            )
        )
    );
  }

  function FeedView({ session, feed, onLogout, alarmCount }) {
    const items = Array.isArray(feed) ? feed : [];
    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "section-stack" },
                    h(SectionHead, { eyebrow: "Feed", title: "피드" }),
                    items.length
                        ? h("div", { className: "home-feed-list" }, items.map((post, index) =>
                            h(Link, {
                                  href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`,
                                  className: "home-feed-row card",
                                  key: `${post.gall_id}-${post.post_no}`,
                                  reload: true
                                },
                                h("span", { className: "home-feed-rank" }, String(index + 1).padStart(2, "0")),
                                h("div", { className: "home-feed-copy" },
                                    h("div", { className: "home-feed-title" }, post.title || "제목 없음"),
                                    h("div", { className: "home-feed-meta" }, `${post.gall_name || post.gall_id} · ${authorLabel(post)} · ${formatDate(post.writed_at)}`)
                                )
                            )
                        ))
                        : h("div", { className: "empty-box" }, "표시할 피드가 없습니다.")
                )
            )
        )
    );
  }

  function SearchResultsView({ session, boards, posts, searchQuery, onLogout, alarmCount }) {
    const q = (searchQuery || "").trim().toLowerCase();
    const boardMatches = q
        ? boards.filter((board) =>
            String(board?.gall_id || "").toLowerCase().includes(q) ||
            String(board?.gall_name || "").toLowerCase().includes(q)
        ).slice(0, 12)
        : [];

    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "section-stack" },
                    h(SectionHead, { eyebrow: "Search", title: q ? `검색 결과: ${searchQuery}` : "통합 검색" }),
                    !q
                        ? h("div", { className: "empty-box" }, "상단 검색창에서 보드와 게시글을 검색해 주세요.")
                        : h("div", { className: "board-directory-layout" },
                            h("article", { className: "card board-directory-card" },
                                h("div", { className: "board-directory-meta" },
                                    h("strong", null, "보드"),
                                    h("span", { className: "chip" }, `${boardMatches.length}개`)
                                ),
                                boardMatches.length
                                    ? h("div", { className: "compact-stack" }, boardMatches.map((board) =>
                                        h(Link, {
                                              href: `/board/${encodeURIComponent(board.gall_id)}`,
                                              className: "board-directory-entry",
                                              key: `search-board-${board.gall_id}`,
                                              reload: true
                                            },
                                            h("strong", { className: "board-directory-name" }, board.gall_name || board.gall_id),
                                            h("span", { className: "board-directory-sub" }, `${board.gall_id} · ${board.post_count ?? 0} posts`)
                                        )
                                    ))
                                    : h("div", { className: "empty-box" }, "일치하는 보드가 없습니다.")
                            ),
                            h("article", { className: "card board-directory-card" },
                                h("div", { className: "board-directory-meta" },
                                    h("strong", null, "게시글"),
                                    h("span", { className: "chip" }, `${Array.isArray(posts) ? posts.length : 0}개`)
                                ),
                                Array.isArray(posts) && posts.length
                                    ? h("div", { className: "compact-stack" }, posts.map((post) =>
                                        h(Link, {
                                              href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`,
                                              className: "mini-link-card",
                                              key: `search-post-${post.gall_id}-${post.post_no}`,
                                              reload: true
                                            },
                                            h("div", { className: "board-title", style: { fontSize: "1rem" } }, post.title || "제목 없음"),
                                            h("div", { className: "muted" }, `${post.gall_name || post.gall_id} · ${authorLabel(post)} · ${formatDate(post.writed_at)}`)
                                        )
                                    ))
                                    : h("div", { className: "empty-box" }, "일치하는 게시글이 없습니다.")
                            )
                        )
                )
            )
        )
    );
  }

  function BoardView({ session, gid, board, posts, page, manageData, settingsFeedback, listFeedback, onPrevPage, onNextPage, onLogout, alarmCount }) {
    const settings = manageData?.settings || null;
    const permissions = manageData?.permissions || {};
    const manager = manageData?.manager || null;
    const boardInfo = manageData?.board || board || {};
    const isMainBoard = String(boardInfo?.gall_type || "").trim().toLowerCase() === "main";
    const submanagers = Array.isArray(manageData?.submanagers) ? manageData.submanagers : [];
    const roleLabels = Array.isArray(manageData?.roleLabels) ? manageData.roleLabels : [];
    const roleLabel = roleLabels.length ? roleLabels.join(", ") : session?.loggedIn ? "member" : "guest";

    // 깨진 한글 복구: "전체"
    const [selectedCategory, setSelectedCategory] = useState("전체");
    const [listMode, setListMode] = useState("all");
    const parsedConceptThreshold = Number(settings?.concept_recommend_threshold || settings?.concept_threshold);
    const conceptThreshold = Number.isFinite(parsedConceptThreshold) && parsedConceptThreshold > 0 ? parsedConceptThreshold : 10;
    const boardThemeStyle = settings?.theme_color ? { "--board-accent": settings.theme_color } : null;
    const canWritePost = !!session?.loggedIn || flagEnabled(settings?.allow_guest_post);
    const configuredCategories = categoryOptionsFromSettings(settings);
    const postCategories = posts.map((post) => String(post.category || "").trim()).filter(Boolean);

    // 깨진 한글 복구: "전체"
    const categories = ["전체", ...Array.from(new Set([...configuredCategories, ...postCategories]))];
    const isConceptPost = (post) => Number(post.is_concept || post.concept || 0) === 1;
    const filteredPosts = posts.filter((post) => {
      // 깨진 한글 복구: "일반"
      const category = String(post.category || "일반");
      const matchesCategory = selectedCategory === "전체" || category === selectedCategory;
      const matchesMode =
          listMode === "all" ||
          (listMode === "concept" && isConceptPost(post)) ||
          (listMode === "notice" && Number(post.notice || post.is_notice || 0) === 1);
      return matchesCategory && matchesMode;
    });
    const staffItems = [
      manager ? `매니저 ${manager.nick && manager.nick !== manager.uid ? `${manager.nick} (${manager.uid})` : (manager.uid || manager.nick)}` : "매니저 미지정",
      // 깨진 한글 복구: "부매니저"
      ...submanagers.slice(0, 4).map((user) => `부매니저 ${user.nick && user.nick !== user.uid ? `${user.nick} (${user.uid})` : (user.uid || user.nick)}`)
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
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "dc-board-shell", style: boardThemeStyle },
                    h(PermissionNotice, {
                      label: "보드 열람은 누구나 가능합니다.",
                      detail: `글쓰기 ${settings?.allow_guest_post !== false ? "허용" : "로그인 필요"} · 댓글 ${settings?.allow_guest_comment !== false ? "허용" : "로그인 필요"}`
                    }),
                    h(Feedback, { feedback: listFeedback }),
                    h(PermissionMatrix, { items: [
                        { action: "게시글 목록 보기", required: "전체 사용자", available: true },
                        { action: "게시글 작성", required: settings?.allow_guest_post !== false ? "비회원 또는 로그인 사용자" : "로그인 사용자", available: settings?.allow_guest_post !== false || !!session?.loggedIn, note: "비회원 작성은 이름과 비밀번호가 필요합니다." },
                        { action: "보드 설정 변경", required: "관리자, 보드 매니저, 부매니저", available: !!permissions.canEditSettings },
                        { action: "게시글/댓글 관리", required: "관리자, 보드 매니저, 부매니저", available: !!permissions.canModerate },
                        { action: "부매니저 임명/해임", required: "관리자 또는 보드 매니저", available: !!permissions.canAssignSubmanager }
                      ] }),
                    h("div", { className: "dc-board-head" },
                        h("div", { className: "dc-board-title-row" },
                            h("h1", { className: "dc-board-title" }, boardInfo?.gall_name || gid),
                            h("span", { className: "dc-board-id" }, gid)
                        ),
                        h("div", { className: "dc-board-head-links" },
                            // 깨진 한글 복구: "설정", "글쓰기"
                            permissions.canEditSettings ? h(Link, { href: `/board/${encodeURIComponent(gid)}/manage`, className: "dc-head-link" }, "설정") : null,
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
                                    // 깨진 한글 복구: "게시판입니다."
                                    settings?.welcome_message ? h("p", null, settings.welcome_message) : h("p", null, `${boardInfo?.gall_name || gid} 게시판입니다.`),
                                    settings?.board_notice ? h("p", { className: "dc-board-notice-line" }, settings.board_notice) : null
                                ),
                                !isMainBoard ? h("div", { className: "dc-board-staff" },
                                    h("strong", null, "운영진"),
                                    // 깨진 한글 복구: "운영진 정보 없음"
                                    h("div", { className: "dc-board-staff-list" }, staffItems.length ? staffItems.join(" · ") : "운영진 정보 없음")
                                ) : null
                            )
                        ),
                        settings?.cover_image_url
                            ? h("div", { className: "dc-board-cover" }, h("img", { src: settings.cover_image_url, alt: `${boardInfo?.gall_name || gid} cover` }))
                            : null
                    ),
                    h("div", { className: "dc-board-tabs" },
                        // 깨진 한글 복구: "전체글", "개념글", "공지", "페이지"
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
                    // 깨진 한글 복구: "말머리 목록"
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
                            ["번호", "말머리", "제목", "날짜", "작성자", "조회", "추천"].map((label) => h("span", { key: label }, label))
                        ),
                        filteredPosts.length
                            ? filteredPosts.map((post) =>
                                h(Link, { href: `/board/${encodeURIComponent(gid)}/${post.post_no}?page=${page}`, className: "dc-post-row", key: `${gid}-${post.post_no}`, reload: true },
                                    h("span", { className: "dc-post-no" }, post.post_no ?? "-"),
                                    // 깨진 한글 복구: "공지", "개념글", "일반"
                                    h("span", { className: "dc-post-kind" }, post.category || (post.notice ? "공지" : Number(post.is_concept || 0) === 1 ? "개념글" : "일반")),
                                    // 깨진 한글 복구: "제목 없음"
                                    h("span", { className: "dc-post-subject" }, h("strong", null, post.title || "제목 없음"), Number(post.comment_count || 0) > 0 ? h("em", null, `[${post.comment_count}]`) : null),
                                    h("span", { className: "dc-post-author" }, h(MemberIdentity, { item: post, className: "member-identity inline" })),
                                    h("span", { className: "dc-post-date" }, formatDate(post.writed_at || post.created_at)),
                                    h("span", { className: "dc-post-view" }, post.view_count ?? 0),
                                    h("span", { className: "dc-post-rec" }, post.recommend_count ?? 0)
                                )
                            )
                            // 깨진 한글 복구: "조건에 맞는 개념글이 없습니다.", "표시할 게시글이 없습니다."
                            : h("div", { className: "empty-box dc-post-empty" }, listMode === "concept" ? "조건에 맞는 개념글이 없습니다." : "표시할 게시글이 없습니다.")
                    ),
                    h("div", { className: "dc-pagination" },
                        // 깨진 한글 복구: "이전", "다음"
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
    const fileInputRef = useRef(null);
    const [boardNotice, setBoardNotice] = useState(settings?.board_notice || "");
    const [welcomeMessage, setWelcomeMessage] = useState(settings?.welcome_message || "");
    const [coverImageUrl, setCoverImageUrl] = useState(settings?.cover_image_url || "");
    const [themeColor, setThemeColor] = useState(settings?.theme_color || "#ff8fab");
    const [categoryOptions, setCategoryOptions] = useState(settings?.category_options || "일반");
    const [boardTags, setBoardTags] = useState(settings?.board_tags || "");
    const [conceptRecommendThreshold, setConceptRecommendThreshold] = useState(String(settings?.concept_recommend_threshold || 10));
    const [allowGuestPost, setAllowGuestPost] = useState(settings?.allow_guest_post !== false);
    const [allowGuestComment, setAllowGuestComment] = useState(settings?.allow_guest_comment !== false);
    const [joinPolicy, setJoinPolicy] = useState(settings?.join_policy || "free");
    const [visibility, setVisibility] = useState(settings?.visibility || "public");
    const [readVisibility, setReadVisibility] = useState(settings?.read_visibility || "inherit");
    const [pinnedNoticeCount, setPinnedNoticeCount] = useState(String(settings?.pinned_notice_count ?? 3));
    const [allowedAttachmentTypes, setAllowedAttachmentTypes] = useState(settings?.allowed_attachment_types || "");
    const [attachmentMaxBytes, setAttachmentMaxBytes] = useState(String(settings?.attachment_max_bytes || 10485760));
    const [coverUploadFeedback, setCoverUploadFeedback] = useState(null);
    const [coverUploading, setCoverUploading] = useState(false);
    const [allowMemberImage, setAllowMemberImage] = useState(settings?.allow_member_image !== false);
    const [allowGuestImage, setAllowGuestImage] = useState(settings?.allow_guest_image !== false);

    useEffect(() => {
      setBoardNotice(settings?.board_notice || "");
      setWelcomeMessage(settings?.welcome_message || "");
      setCoverImageUrl(settings?.cover_image_url || "");
      setThemeColor(settings?.theme_color || "#ff8fab");
      setCategoryOptions(settings?.category_options || "일반");
      setBoardTags(settings?.board_tags || "");
      setConceptRecommendThreshold(String(settings?.concept_recommend_threshold || 10));
      setAllowGuestPost(settings?.allow_guest_post !== false);
      setAllowGuestComment(settings?.allow_guest_comment !== false);
      setJoinPolicy(settings?.join_policy || "free");
      setVisibility(settings?.visibility || "public");
      setReadVisibility(settings?.read_visibility || "inherit");
      setPinnedNoticeCount(String(settings?.pinned_notice_count ?? 3));
      setAllowedAttachmentTypes(settings?.allowed_attachment_types || "");
      setAttachmentMaxBytes(String(settings?.attachment_max_bytes || 10485760));
      setCoverUploadFeedback(null);
      setCoverUploading(false);
      setAllowMemberImage(settings?.allow_member_image !== false);
      setAllowGuestImage(settings?.allow_guest_image !== false);
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
            h("label", { className: "check-row" },
                h("input", { type: "checkbox", checked: allowMemberImage, onChange: (event) => setAllowMemberImage(event.target.checked) }),
                h("span", null, "회원 이미지 첨부 허용")
            ),
            h("label", { className: "check-row" },
                h("input", { type: "checkbox", checked: allowGuestImage, onChange: (event) => setAllowGuestImage(event.target.checked) }),
                h("span", null, "비회원 이미지 첨부 허용")
            ),
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
                h("label", { htmlFor: "board-setting-tags-v2" }, "검색 태그"),
                h("textarea", { id: "board-setting-tags-v2", rows: 3, value: boardTags, onChange: (event) => setBoardTags(event.target.value), placeholder: "검색에만 사용됩니다. 화면에는 표시하지 않습니다." })
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
                h("label", { htmlFor: "board-setting-visibility-v2" }, "참여 범위"),
                h("select", { id: "board-setting-visibility-v2", value: visibility, onChange: (event) => setVisibility(event.target.value) },
                    h("option", { value: "public" }, "공개"),
                    h("option", { value: "private" }, "비공개"),
                    h("option", { value: "members" }, "멤버 전용")
                )
            ),
            h("div", { className: "field" },
                h("label", { htmlFor: "board-setting-read-visibility-v2" }, "조회 범위"),
                h("select", { id: "board-setting-read-visibility-v2", value: readVisibility, onChange: (event) => setReadVisibility(event.target.value) },
                    h("option", { value: "inherit" }, "참여 범위와 동일"),
                    h("option", { value: "public" }, "누구나 조회"),
                    h("option", { value: "members" }, "멤버만 조회"),
                    h("option", { value: "private" }, "비공개")
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
                    h("button", { type: "button", className: "btn btn-secondary", onClick: () => fileInputRef.current?.click(), disabled: coverUploading }, coverUploading ? "업로드 중.." : "이미지 선택"),
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
                    onSave({ boardNotice, welcomeMessage, coverImageUrl, categoryOptions, boardTags, themeColor, conceptRecommendThreshold, allowGuestPost, allowGuestComment, joinPolicy, visibility, readVisibility, pinnedNoticeCount, allowedAttachmentTypes, attachmentMaxBytes, allowMemberImage, allowGuestImage });
                  }
                }, "설정 저장")
            )
        )
    );
  }

  function SubmanagerPermissionPanel({ submanagers = [], permissions = {}, feedback, onSave, onAppoint, onRevoke, onTransfer }) {
    const [drafts, setDrafts] = useState({});
    const [appointUid, setAppointUid] = useState("");
    const [transferUid, setTransferUid] = useState("");

    useEffect(() => {
      const nextDrafts = {};
      submanagers.forEach((sub) => {
        nextDrafts[sub.uid] = Object.fromEntries(SUBMANAGER_PERMISSION_FIELDS.map(([key]) => [key, flagEnabled(sub[key])]));
      });
      setDrafts(nextDrafts);
    }, [submanagers.map((sub) => `${sub.uid}:${SUBMANAGER_PERMISSION_FIELDS.map(([key]) => sub[key]).join(",")}`).join("|")]);

    const canAssign = !!permissions.canAssignSubmanager || !!permissions.isAdmin;
    const canEdit = canAssign || !!permissions.canManageSubmanager;
    const canTransfer = !!permissions.canTransferManager || !!permissions.isAdmin;

    return h("article", { className: "card board-settings-card" },
        h(SectionHead, { eyebrow: "Submanager", title: "부매니저 임명/해제" }),
        h("div", { className: "stack" },
            canAssign ? h("section", { className: "mini-link-card" },
                h("div", { className: "board-title" }, "부매니저 임명"),
                h("div", { className: "muted" }, "대상 UID를 입력하면 해당 사용자에게 부매니저 임명 요청 알림을 보냅니다."),
                h("div", { className: "staff-action-row" },
                    h("input", { type: "text", value: appointUid, onChange: (event) => setAppointUid(event.target.value), placeholder: "대상 UID" }),
                    h("button", {
                      type: "button",
                      className: "btn btn-primary btn-compact",
                      onClick() {
                        const uid = appointUid.trim();
                        if (!uid) return;
                        onAppoint(uid, () => setAppointUid(""));
                      }
                    }, "임명 요청")
                )
            ) : null,
            canTransfer ? h("section", { className: "mini-link-card" },
                h("div", { className: "board-title" }, "매니저 위임"),
                h("div", { className: "muted" }, "현재 부매니저 중 한 명에게 매니저 권한 위임 요청을 보냅니다."),
                h("div", { className: "staff-action-row" },
                    h("input", { type: "text", value: transferUid, onChange: (event) => setTransferUid(event.target.value), placeholder: "위임 대상 UID" }),
                    h("button", {
                      type: "button",
                      className: "btn btn-secondary btn-compact",
                      onClick() {
                        const uid = transferUid.trim();
                        if (!uid) return;
                        onTransfer(uid, () => setTransferUid(""));
                      }
                    }, "위임 요청")
                )
            ) : null,
            submanagers.length
                ? submanagers.map((sub) =>
                    h("section", { className: "mini-link-card", key: sub.uid },
                        h("div", { className: "board-title" }, `${sub.nick || sub.uid} (${sub.uid})`),
                        h("div", { className: "permission-grid" },
                            SUBMANAGER_PERMISSION_FIELDS.map(([key, label]) =>
                                h("label", { className: "check-row", key: `${sub.uid}-${key}` },
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
                        canEdit || canAssign ? h("div", { className: "inline-actions" },
                            canEdit ? h("button", {
                              type: "button",
                              className: "btn btn-secondary btn-compact",
                              onClick: () => onSave(sub.uid, drafts[sub.uid] || {})
                            }, "권한 저장") : null,
                            canAssign ? h("button", {
                              type: "button",
                              className: "btn btn-ghost btn-compact",
                              onClick: () => onRevoke(sub.uid)
                            }, "해제") : null
                        ) : null
                    )
                )
                : h("div", { className: "empty-box" }, "등록된 부매니저가 없습니다."),
            h(Feedback, { feedback })
        )
    );
  }

  function PendingStaffRequestList({ requests = [] }) {
    return h("article", { className: "card board-settings-card" },
        h(SectionHead, { eyebrow: "Pending", title: "임명 대기 목록" }),
        requests.length
            ? h("div", { className: "stack" },
                requests.map((request) =>
                    h("section", { className: "mini-link-card", key: `pending-${request.alarm_id}` },
                        h("div", { className: "board-title" }, request.role === "manager" ? "매니저 위임 요청" : "부매니저 임명 요청"),
                        h("div", { className: "muted" }, `${request.display_name || request.target_nick || request.target_uid || "대상 미지정"} · ${formatDate(request.created_at)}`),
                        h("div", { className: "muted" }, `요청자: ${request.requester_nick && request.requester_nick !== request.requester_uid ? `${request.requester_nick} (${request.requester_uid})` : (request.requester_uid || request.requester_nick || "정보 없음")}`),
                        h("div", { className: "muted" }, `${request.gall_name || request.gall_id || ""}`)
                    )
                )
            )
            : h("div", { className: "empty-box" }, "현재 대기 중인 임명 요청이 없습니다.")
    );
  }

  function BoardManageView({ session, gid, board, manageData, feedback, submanagerFeedback, onSaveSettings, onSaveSubmanagerPermissions, onAppointSubmanager, onRevokeSubmanager, onTransferManager, onLogout, alarmCount }) {
    const permissions = manageData?.permissions || {};
    const settings = manageData?.settings || { gall_id: gid, theme_color: "#ff8fab", concept_recommend_threshold: 10, allow_guest_post: true, allow_guest_comment: true };
    const submanagers = Array.isArray(manageData?.submanagers) ? manageData.submanagers : [];
    const pendingRequests = Array.isArray(manageData?.pendingStaffRequests) ? manageData.pendingStaffRequests : [];
    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "section-stack" },
                    h(SectionHead, {
                      eyebrow: "Manage",
                      title: `${board?.gall_name || gid} 보드 관리`,
                      action: h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-secondary" }, "보드로 돌아가기")
                    }),
                    h(PermissionMatrix, { items: [
                        { action: "보드 설정 저장", required: "관리자, 보드 매니저, 부매니저", available: !!permissions.canEditSettings },
                        { action: "게시글/댓글 관리", required: "관리자, 보드 매니저, 부매니저", available: !!permissions.canModerate },
                        { action: "매니저 요청/양도", required: "관리자 또는 현재 매니저", available: !!permissions.canTransferManager },
                        { action: "부매니저 임명/해임", required: "관리자 또는 현재 매니저", available: !!permissions.canAssignSubmanager }
                      ] }),
                    permissions.canEditSettings
                        ? h(BoardSettingsPanel, { settings, feedback, onSave: onSaveSettings })
                        : h("article", { className: "card board-settings-card" }, h("div", { className: "error-box" }, "이 보드 설정을 변경할 권한이 없습니다.")),
                    (permissions.canAssignSubmanager || permissions.canManageSubmanager || permissions.isAdmin)
                        ? h(PendingStaffRequestList, { requests: pendingRequests })
                        : null,
                    (permissions.canAssignSubmanager || permissions.canManageSubmanager || permissions.isAdmin)
                        ? h(Link, { href: `/board/${encodeURIComponent(gid)}/staff`, className: "mini-link-card" },
                            h("div", { className: "board-title" }, "부매니저 임명 화면"),
                            h("div", { className: "muted" }, "임명 요청, 해임, 권한 설정은 전용 화면에서 관리합니다.")
                        )
                        : null,
                    h(SubmanagerPermissionPanel, { submanagers, permissions, feedback: submanagerFeedback, onSave: onSaveSubmanagerPermissions, onAppoint: onAppointSubmanager, onRevoke: onRevokeSubmanager, onTransfer: onTransferManager })
                )
            )
        )
    );
  }

  function BoardStaffManageView({ session, gid, board, manageData, feedback, onSaveSubmanagerPermissions, onAppointSubmanager, onRevokeSubmanager, onTransferManager, onLogout, alarmCount }) {
    const permissions = manageData?.permissions || {};
    const submanagers = Array.isArray(manageData?.submanagers) ? manageData.submanagers : [];
    const pendingRequests = Array.isArray(manageData?.pendingStaffRequests) ? manageData.pendingStaffRequests : [];
    const canOpen = !!permissions.canAssignSubmanager || !!permissions.canManageSubmanager || !!permissions.isAdmin;
    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "section-stack" },
                    h(SectionHead, {
                      eyebrow: "Staff",
                      title: `${board?.gall_name || gid} 부매니저 임명`,
                      action: h("div", { className: "inline-actions" },
                          h(Link, { href: `/board/${encodeURIComponent(gid)}/manage`, className: "btn btn-secondary" }, "보드 관리"),
                          h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-secondary" }, "보드로")
                      )
                    }),
                    h(PermissionMatrix, { items: [
                        { action: "부매니저 임명 요청", required: "관리자 또는 현재 매니저", available: !!permissions.canAssignSubmanager },
                        { action: "부매니저 해임", required: "관리자 또는 현재 매니저", available: !!permissions.canAssignSubmanager },
                        { action: "부매니저 권한 설정", required: "관리자, 현재 매니저, 권한제어 권한 보유자", available: !!permissions.canManageSubmanager || !!permissions.canAssignSubmanager || !!permissions.isAdmin }
                      ] }),
                    canOpen ? h(PendingStaffRequestList, { requests: pendingRequests }) : null,
                    canOpen
                        ? h(SubmanagerPermissionPanel, {
                          submanagers,
                          permissions,
                          feedback,
                          onSave: onSaveSubmanagerPermissions,
                          onAppoint: onAppointSubmanager,
                          onRevoke: onRevokeSubmanager,
                          onTransfer: onTransferManager
                        })
                        : h("article", { className: "card board-settings-card" }, h("div", { className: "error-box" }, "부매니저를 관리할 권한이 없습니다."))
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
            if (!importantActionConfirm(buttonLabel, [
              "삭제 전에는 복구가 어려울 수 있습니다.",
              "작성자 본인 또는 관리 권한이 있는 경우에만 삭제해야 합니다."
            ])) return;
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

  function PostView({ session, gid, post, comments, feedback, deleteFeedback, voteFeedback, voteState, manageData, onSubmitComment, onDeletePost, onDeleteComment, onVote, onScrapPost, onReportPost, onLikeComment, onReportComment, onCancelConcept, onSetConcept, onBumpPost, onSetNotice, onLogout, alarmCount }) {
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    const [commentAgreed, setCommentAgreed] = useState(false);
    const isAdmin = ["1", 1, "admin", "operator"].includes(session?.memberDivision);
    const permissions = manageData?.permissions || {};
    const settings = manageData?.settings || null;
    const parsedConceptThreshold = Number(settings?.concept_recommend_threshold || settings?.concept_threshold);
    const conceptThreshold = Number.isFinite(parsedConceptThreshold) && parsedConceptThreshold > 0 ? parsedConceptThreshold : 10;
    const canForceConcept = Number(post?.recommend_count || 0) >= conceptThreshold;
    const canComment = !!session?.loggedIn || flagEnabled(settings?.allow_guest_comment);
    const isOwnedBySession = (item) => session?.loggedIn && session?.uid && item?.writer_uid && String(item.writer_uid).trim() === String(session.uid).trim();
    const isDeletedComment = (item) => Number(item?.is_deleted || 0) === 1;
    const commentDepth = (item) => Math.max(0, Math.min(2, Number(item?.reply_depth || (item?.parent_id ? 1 : 0)) || 0));
    const isReplyComment = (item) => commentDepth(item) > 0 || !!item?.parent_id;
    const canDeleteByRole = (kind) => isAdmin || (kind === "post" ? !!permissions.canDeletePost : !!permissions.canDeleteComment);
    const canRenderDelete = (item, kind) => item && !isDeletedComment(item) && (!session?.loggedIn ? !item.writer_uid : isOwnedBySession(item) || canDeleteByRole(kind));
    const requiresDeletePassword = (item, kind) => item && !item.writer_uid && !(session?.loggedIn && canDeleteByRole(kind));

    if (!post) {
      return h(React.Fragment, null, h(TopbarV2, { session, onLogout, alarmCount }), h("main", { className: "shell" }, h("div", { className: "frame" }, h("div", { className: "error-box" }, "게시글을 찾을 수 없습니다."))));
    }

    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h(PermissionMatrix, { items: [
                    { action: "게시글 읽기", required: "전체 사용자", available: true },
                    { action: "추천/비추천", required: "비회원 포함 전체 사용자", available: voteState?.canVote !== false, note: "오늘 같은 게시글이나 IP 기준 하루에 한 번만 투표할 수 있습니다." },
                    { action: "댓글 작성", required: "보드 설정이 허용한 비회원 또는 로그인 사용자", available: true, note: "비회원 댓글은 이름과 비밀번호가 필요합니다." },
                    { action: "게시글 삭제", required: "작성자(비회원 작성 비밀번호), 관리자 또는 보드 매니저/글 삭제 권한", available: canRenderDelete(post, "post") },
                    { action: "댓글 삭제", required: "작성자(비회원 작성 비밀번호), 관리자 또는 보드 운영진", note: "댓글마다 삭제 가능 여부가 다르게 표시됩니다." }
                  ] }),
                h("article", { className: "card post-card" },
                    h("div", { className: "post-card-main" },
                        h("div", { className: "post-meta-bar" }, h("span", { className: "post-board-name" }, post.gall_name || gid)),
                        h("div", { className: "post-title-block" },
                            post.category ? h("span", { className: "chip" }, `[${post.category}]`) : null,
                            h("h1", { className: "post-heading" }, post.title || "제목 없음"),
                            h("div", { className: "post-info-row" },
                                h("span", null, h(MemberIdentity, { item: post, className: "member-identity inline" })),
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
                            permissions.canBumpPost || isAdmin ? h("button", { type: "button", className: "btn btn-ghost btn-compact", onClick: () => onBumpPost(post) }, "끌올") : null,
                            permissions.canManageNotice || isAdmin ? h("button", { type: "button", className: "btn btn-ghost btn-compact", onClick: () => onSetNotice(post, Number(post.is_notice || post.notice || 0) !== 1) }, Number(post.is_notice || post.notice || 0) === 1 ? "공지 해제" : "공지 등록") : null,
                            permissions.canManageConcept || isAdmin
                                ? Number(post.is_concept || 0) === 1
                                    ? h("button", { type: "button", className: "btn btn-ghost btn-compact", onClick: () => onCancelConcept(post) }, "개념글 취소")
                                    : canForceConcept ? h("button", { type: "button", className: "btn btn-ghost btn-compact", onClick: () => onSetConcept(post) }, "개념글 지정") : null
                                : null
                        ),
                        canRenderDelete(post, "post") ? h(PopupDeleteControl, { session, buttonLabel: "게시글 삭제", requirePassword: requiresDeletePassword(post, "post"), onDelete: (password, reset) => onDeletePost({ gid, postNo: post.post_no, password }, reset) }) : null,
                        h(Feedback, { feedback: deleteFeedback })
                    )
                ),
                h("section", { className: "section-stack" },
                    h(SectionHead, { eyebrow: "Comments", title: "댓글" }),
                    comments.length
                        ? h("div", { className: "stack" }, comments.map((comment) =>
                            h("article", { className: ["card", "comment-card", `depth-${commentDepth(comment)}`, isDeletedComment(comment) ? "is-deleted" : "", isReplyComment(comment) ? "is-reply" : ""].filter(Boolean).join(" "), key: comment.id || comment.comment_id || `${comment.created_at}-${comment.name}` },
                                isDeletedComment(comment)
                                    ? h("div", { className: "muted comment-deleted-label" }, "삭제된 댓글")
                                    : h("div", { className: "muted" }, h(MemberIdentity, { item: comment, className: "member-identity inline" }), ` · ${formatDate(comment.writed_at || comment.created_at)}`),
                                isDeletedComment(comment) ? null : h("div", { className: "preview comment-preview", dangerouslySetInnerHTML: { __html: comment.content || "" } }),
                                isDeletedComment(comment) ? null : h("div", { className: "inline-actions" },
                                    h("button", { type: "button", className: "btn btn-secondary btn-compact", onClick: () => onLikeComment(comment) }, `공감 ${comment.like_count ?? 0}`),
                                    h("button", { type: "button", className: "btn btn-ghost btn-compact", onClick: () => onReportComment(comment) }, "신고")
                                ),
                                isDeletedComment(comment) ? null : (canRenderDelete(comment, "comment") ? h(PopupDeleteControl, { session, buttonLabel: "댓글 삭제", requirePassword: requiresDeletePassword(comment, "comment"), onDelete: (password, reset) => onDeleteComment({ commentId: comment.id || comment.comment_id, password }, reset) }) : null)
                            )))
                        : h("div", { className: "empty-box" }, "아직 댓글이 없습니다."),
                    h("article", { className: "card" },
                        h("div", { className: "field" },
                            h("label", { htmlFor: "comment-content" }, "댓글"),
                            h("textarea", { id: "comment-content", rows: 5, value: content, onChange: (event) => setContent(event.target.value) })
                        ),
                        session?.loggedIn ? null : h(GuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "comment" }),
                        h(ConsentChecklist, { title: "댓글 작성 전 확인", items: COMMENT_TERMS, checked: commentAgreed, onToggle: setCommentAgreed }),
                        canComment ? null : h("div", { className: "error-box" }, "이 보드에는 로그인한 사용자만 댓글을 작성할 수 있습니다."),
                        h(Feedback, { feedback }),
                        h(ActionPermission, null, "필요 권한: 댓글 작성이 허용된 보드(로그인 사용자 또는 비회원 이름/비밀번호 필수)"),
                        h("div", { className: "inline-actions" },
                            h("button", {
                              type: "button",
                              className: "btn btn-primary",
                              disabled: !canComment || !commentAgreed,
                              onClick() {
                                if (!canComment) return;
                                onSubmitComment({ gid, postNo: post.post_no, content, name: guestName.trim(), password: guestPassword }, () => {
                                  setContent("");
                                  setGuestName("");
                                  setGuestPassword("");
                                  setCommentAgreed(false);
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
    const [writeAgreed, setWriteAgreed] = useState(false);
    const settings = manageData?.settings || null;
    const canWritePost = !!session?.loggedIn || flagEnabled(settings?.allow_guest_post);
    const canUploadImage = session?.loggedIn ? flagEnabled(settings?.allow_member_image) : flagEnabled(settings?.allow_guest_image);
    window.__boardWriteCanUploadImage = canUploadImage; // TODO: prop으로 전달하는 방식으로 리팩토링 필요
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
        h(TopbarV2, { session, onLogout, alarmCount }),
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
                            { action: "HTML 서식/이미지 입력", required: "게시글 작성 가능 사용자", available: true, note: "입력창에서는 서식이 적용되고 저장값은 HTML로 보관됩니다." },
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
                        h(ConsentChecklist, { title: "게시글 작성 전 확인", items: WRITE_TERMS, checked: writeAgreed, onToggle: setWriteAgreed }),
                        canWritePost ? null : h("div", { className: "error-box" }, "이 보드에는 로그인한 사용자만 글을 작성할 수 있습니다."),
                        h(Feedback, { feedback }),
                        h(ActionPermission, null, session?.loggedIn ? "필요 권한: 로그인 사용자" : "필요 권한: 비회원 이름과 비밀번호 입력"),
                        h("div", { className: "inline-actions" },
                            h("button", {
                              type: "button",
                              className: "btn btn-primary",
                              disabled: !canWritePost || !writeAgreed,
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
                                  setWriteAgreed(false);
                                });
                              }
                            }, "글 등록"),
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

  function AdminLoginView({ feedback, onSubmitAuth, session, onLogout, alarmCount }) {
    const [uid, setUid] = useState("");
    const [password, setPassword] = useState("");
    const [adminCode, setAdminCode] = useState("");

    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "auth-wrap" },
                    h("article", { className: "auth-card card" },
                        h("span", { className: "eyebrow" }, "Admin Access"),
                        h("h1", { className: "section-title" }, "관리자 전용 로그인"),
                        h("p", { className: "muted" }, "관리 목적 계정은 일반 로그인으로 접근할 수 없으며, 별도 관리자 코드가 필요합니다."),
                        h("div", { className: "stack", style: { marginTop: "16px" } },
                            h("div", { className: "field" },
                                h("label", { htmlFor: "admin-login-id" }, "관리자 아이디 또는 이메일"),
                                h("input", { id: "admin-login-id", type: "text", value: uid, autoComplete: "username", onChange: (event) => setUid(event.target.value) })
                            ),
                            h("div", { className: "field" },
                                h("label", { htmlFor: "admin-login-pw" }, "비밀번호"),
                                h("input", { id: "admin-login-pw", type: "password", value: password, autoComplete: "current-password", onChange: (event) => setPassword(event.target.value) })
                            ),
                            h("div", { className: "field" },
                                h("label", { htmlFor: "admin-login-code" }, "관리자 전용 코드"),
                                h("input", { id: "admin-login-code", type: "password", value: adminCode, autoComplete: "one-time-code", onChange: (event) => setAdminCode(event.target.value) })
                            ),
                            h(Feedback, { feedback }),
                            h("div", { className: "inline-actions" },
                                h("button", { type: "button", className: "btn btn-primary", onClick: () => onSubmitAuth({ mode: "admin-login", uid, password, adminCode }) }, "관리자 로그인"),
                                h(Link, { href: "/signin", className: "btn btn-secondary" }, "일반 로그인")
                            )
                        )
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
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [code, setCode] = useState("");
    const [nicknameMode, setNicknameMode] = useState("비고정");
    const [captchaCode, setCaptchaCode] = useState(() => generateCaptchaCode());
    const [captchaValue, setCaptchaValue] = useState("");
    const [signupTermsAgreed, setSignupTermsAgreed] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [stepFeedback, setStepFeedback] = useState(null);
    const [uidFeedback, setUidFeedback] = useState(null);
    const [nickFeedback, setNickFeedback] = useState(null);
    const [uidChecking, setUidChecking] = useState(false);
    const [nickChecking, setNickChecking] = useState(false);
    const [verificationLoading, setVerificationLoading] = useState(false);
    const [signupLoading, setSignupLoading] = useState(false);
    const [uidChecked, setUidChecked] = useState({ value: "", ok: false });
    const [nickChecked, setNickChecked] = useState({ value: "", type: "variable", ok: false });
    const isLogin = mode === "login";
    const requiresFixedNickCheck = nicknameMode === "고정";
    const trimmedUid = uid.trim();
    const trimmedNick = nick.trim();
    const uidCheckPassed = uidChecked.ok && uidChecked.value === trimmedUid;
    const nickCheckPassed = !requiresFixedNickCheck || (nickChecked.ok && nickChecked.value === trimmedNick && nickChecked.type === "fixed");
    const passwordChecks = {
      combo: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/.test(password),
      length: password.length >= 8 && password.length <= 20,
      special: /[^A-Za-z0-9]/.test(password)
    };
    const passwordStrength = [passwordChecks.combo, passwordChecks.length, passwordChecks.special].filter(Boolean).length;
    const passwordStrengthPercent = (passwordStrength / 3) * 100;
    const passwordMatched = password.length > 0 && password === passwordConfirm;

    async function validateSignupFieldRequest(field, value, nickType) {
      const params = new URLSearchParams({
        field: String(field || ""),
        value: String(value || "")
      });
      if (nickType) params.set("nickType", nickType);
      const result = await api(`/api/signup/validate?${params.toString()}`);
      if (!result?.success || !result?.data?.valid) {
        throw new Error(result?.data?.message || "입력값을 확인해주세요.");
      }
      return result;
    }

    async function validateSignupForm() {
      if (!signupTermsAgreed) throw new Error("약관 및 개인정보 수집 동의가 필요합니다.");
      if (!passwordMatched) throw new Error("비밀번호 확인이 일치하지 않습니다.");
      if ((captchaValue || "").trim().toLowerCase() !== captchaCode.toLowerCase()) throw new Error("자동 입력 방지 코드가 일치하지 않습니다.");
      if (!uidCheckPassed) throw new Error("아이디 중복확인을 완료해 주세요.");
      if (!nickCheckPassed) throw new Error("고정 닉네임 중복확인을 완료해 주세요.");
      await validateSignupFieldRequest("uid", trimmedUid);
      await validateSignupFieldRequest("nick", trimmedNick, requiresFixedNickCheck ? "fixed" : "variable");
      await validateSignupFieldRequest("email", email.trim());
      await validateSignupFieldRequest("password", password);
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

    async function requestVerificationMail() {
      try {
        setVerificationLoading(true);
        setStepFeedback(null);
        await validateSignupForm();
        onSubmitAuth({ mode, uid, nick, email, password, nickType: requiresFixedNickCheck ? "fixed" : "variable", resendOnly: true, setVerificationSent, signupTermsAgreed });
      } catch (error) {
        setStepFeedback({ type: "error", message: error.message || "가입 정보를 다시 확인해주세요." });
      } finally {
        setVerificationLoading(false);
      }
    }

    async function completeSignup() {
      try {
        setSignupLoading(true);
        setStepFeedback(null);
        await validateSignupForm();
        if (!verificationSent) {
          throw new Error("먼저 인증 메일을 보내고 코드를 받아주세요.");
        }
        if (!code.trim()) {
          throw new Error("이메일 인증 코드를 입력해주세요.");
        }
        onSubmitAuth({ mode, uid, nick, email, password, nickType: requiresFixedNickCheck ? "fixed" : "variable", code, verificationSent, setVerificationSent, signupTermsAgreed });
      } catch (error) {
        setStepFeedback({ type: "error", message: error.message || "가입 정보를 다시 확인해주세요." });
      } finally {
        setSignupLoading(false);
      }
    }

    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "auth-wrap" },
                    h("article", { className: "auth-card card" },
                        h(PermissionNotice, {
                          label: isLogin ? "로그인은 비회원 페이지가 아닙니다." : "회원가입은 비회원만 진행할 수 있습니다.",
                          detail: isLogin ? "로그인하면 알림, 권한, 보드 요청 기능을 사용할 수 있습니다." : "가입 시 이메일 인증 완료가 필요합니다."
                        }),
                        h(PermissionMatrix, { items: isLogin ? [
                            { action: "로그인", required: "가입된 사용자 계정", available: true },
                            { action: "알림 확인", required: "로그인 사용자", available: !!session?.loggedIn },
                            { action: "보드 요청/권한 수락", required: "로그인 사용자", available: !!session?.loggedIn }
                          ] : [
                            { action: "회원가입", required: "비회원", available: !session?.loggedIn },
                            { action: "이메일 인증 메일 발송", required: "아이디, 닉네임, 이메일, 비밀번호 정책 통과", available: true },
                            { action: "가입 완료", required: "이메일 인증 코드 확인", available: false, note: "인증 성공 시 계정이 생성됩니다." }
                          ] }),
                        h("span", { className: "eyebrow" }, isLogin ? "Access" : "Join"),
                        h("h1", { className: "section-title" }, isLogin ? "로그인" : "회원가입"),
                        h("div", { className: "stack", style: { marginTop: "16px" } },
                            isLogin
                                ? h("div", { className: "stack" },
                                    h("div", { className: "field" }, h("label", { htmlFor: "auth-login-id" }, "아이디 또는 이메일"), h("input", { id: "auth-login-id", type: "text", value: uid, onChange: (event) => setUid(event.target.value) })),
                                    h("div", { className: "field" }, h("label", { htmlFor: "auth-login-pw" }, "비밀번호"), h("input", { id: "auth-login-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value) }))
                                )
                                : h("div", { className: "signup-sheet" },
                                    h("div", { className: "signup-sheet-head" },
                                        h("span", { className: "eyebrow" }, "Join"),
                                        h("h1", { className: "section-title" }, "회원가입"),
                                        h("p", { className: "muted" }, "아이디, 비밀번호, 닉네임, 자동 입력 방지 코드와 이메일 인증을 한 번에 진행합니다.")
                                    ),
                                    h("div", { className: "signup-grid" },
                                        h("div", { className: "signup-label" }, "아이디"),
                                        h("div", { className: "signup-control stack compact-stack" },
                                            h("div", { className: "signup-inline-value" }, uid || "사용할 아이디를 입력해 주세요."),
                                            h("div", { className: "signup-inline-row" },
                                                h("div", { className: "field", style: { flex: "1" } },
                                                    h("input", { id: "auth-uid", type: "text", value: uid, onChange: (event) => { setUid(event.target.value); setUidChecked({ value: "", ok: false }); setUidFeedback(null); }, placeholder: "4~20자 영문 소문자, 숫자, 밑줄" })
                                                ),
                                                h("button", { type: "button", className: "btn btn-secondary signup-mail-btn", onClick: checkUidDuplicate, disabled: uidChecking }, uidChecking ? h(React.Fragment, null, h("span", { className: "loading-spinner", "aria-hidden": "true" }), "확인 중") : "중복확인")
                                            ),
                                            h(Feedback, { feedback: uidFeedback }),
                                            h("div", { className: "signup-help danger-text" }, "아이디와 비밀번호를 기억해 주세요."),
                                            h("div", { className: "signup-help danger-text" }, "첫 글자는 영문 소문자여야 하며, 가입 후에는 변경할 수 없습니다."),
                                            h("div", { className: "signup-help" }, uidCheckPassed ? "아이디 중복확인이 완료되었습니다." : "가입 전에 아이디 중복확인 버튼을 눌러 주세요.")
                                        ),
                                        h("div", { className: "signup-label" }, "비밀번호 입력"),
                                        h("div", { className: "signup-control stack compact-stack" },
                                            h("div", { className: "field" }, h("input", { id: "auth-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value), placeholder: "비밀번호를 입력해 주세요." })),
                                            h("div", { className: "field" }, h("input", { id: "auth-pw-confirm", type: "password", value: passwordConfirm, onChange: (event) => setPasswordConfirm(event.target.value), placeholder: "비밀번호를 재확인해 주세요." })),
                                            h("div", { className: "signup-policy-block" },
                                                h("strong", null, "비밀번호 필수 조건"),
                                                h("div", { className: passwordChecks.combo ? "signup-policy-ok" : "signup-policy-pending" }, "영문, 숫자, 특수문자 조합입니다."),
                                                h("div", { className: passwordChecks.length ? "signup-policy-ok" : "signup-policy-pending" }, "8~20자입니다."),
                                                h("div", { className: passwordMatched ? "signup-policy-ok" : "signup-policy-pending" }, "비밀번호 확인이 일치합니다.")
                                            ),
                                            h("div", { className: "signup-strength" },
                                                h("span", null, "안전 정도"),
                                                h("div", { className: "signup-strength-bar" },
                                                    h("div", { className: `signup-strength-fill strength-${passwordStrength}` , style: { width: `${passwordStrengthPercent}%` } })
                                                )
                                            )
                                        ),
                                        h("div", { className: "signup-label" }, "닉네임 만들기"),
                                        h("div", { className: "signup-control stack compact-stack" },
                                            h("div", { className: "signup-inline-row" },
                                                h("div", { className: "field", style: { flex: "1" } }, h("input", { id: "auth-nick", type: "text", value: nick, onChange: (event) => { setNick(event.target.value); setNickChecked({ value: "", type: requiresFixedNickCheck ? "fixed" : "variable", ok: false }); setNickFeedback(null); }, placeholder: "닉네임을 입력해 주세요." })),
                                                h("div", { className: "field signup-select-field" },
                                                    h("select", { value: nicknameMode, onChange: (event) => { const nextMode = event.target.value; setNicknameMode(nextMode); setNickChecked({ value: "", type: nextMode === "고정" ? "fixed" : "variable", ok: false }); setNickFeedback(null); } },
                                                        h("option", { value: "비고정" }, "비고정"),
                                                        h("option", { value: "고정" }, "고정")
                                                    )
                                                ),
                                                requiresFixedNickCheck ? h("button", { type: "button", className: "btn btn-secondary signup-mail-btn", onClick: checkNickDuplicate, disabled: nickChecking }, nickChecking ? h(React.Fragment, null, h("span", { className: "loading-spinner", "aria-hidden": "true" }), "확인 중") : "중복확인") : null
                                            ),
                                            h(Feedback, { feedback: nickFeedback }),
                                            h("div", { className: "signup-help" }, requiresFixedNickCheck
                                                ? (nickCheckPassed ? "고정 닉네임 중복확인이 완료되었습니다." : "1~20자의 닉네임을 입력한 후 중복확인 버튼을 눌러 주세요.")
                                                : "1~20자의 닉네임을 입력해 주세요. 비고정 닉네임은 중복확인이 필요하지 않습니다.")
                                        ),
                                        h("div", { className: "signup-label" }, "이메일 인증"),
                                        h("div", { className: "signup-control stack compact-stack" },
                                            h("div", { className: "signup-inline-row" },
                                                h("div", { className: "field", style: { flex: "1" } }, h("input", { id: "auth-email", type: "email", value: email, onChange: (event) => setEmail(event.target.value), placeholder: "인증 메일을 받을 주소를 입력해 주세요." })),
                                                h("button", { type: "button", className: "btn btn-secondary signup-mail-btn", onClick: requestVerificationMail, disabled: verificationLoading }, verificationLoading ? h(React.Fragment, null, h("span", { className: "loading-spinner", "aria-hidden": "true" }), "처리 중") : (verificationSent ? "인증 메일 재전송" : "인증 메일 전송"))
                                            ),
                                            h("div", { className: "signup-inline-row" },
                                                h("div", { className: "field", style: { flex: "1" } }, h("input", { id: "auth-code", type: "text", value: code, onChange: (event) => setCode(event.target.value), placeholder: "메일로 받은 인증 코드를 입력해 주세요." })),
                                                verificationSent ? h("span", { className: "chip" }, "인증 메일 발송됨") : null
                                            )
                                        ),
                                        h("div", { className: "signup-label" }, "자동 입력 방지 코드"),
                                        h("div", { className: "signup-control stack compact-stack" },
                                            h("div", { className: "signup-inline-row" },
                                                h("button", { type: "button", className: "signup-captcha-box", onClick: () => { setCaptchaCode(generateCaptchaCode()); setCaptchaValue(""); } }, captchaCode),
                                                h("div", { className: "field", style: { flex: "1" } }, h("input", { value: captchaValue, onChange: (event) => setCaptchaValue(event.target.value), placeholder: "코드 입력" })),
                                                h("button", { type: "button", className: "btn btn-secondary signup-refresh-btn", onClick: () => { setCaptchaCode(generateCaptchaCode()); setCaptchaValue(""); } }, "새 코드")
                                            ),
                                            h("div", { className: "signup-help" }, "코드 박스나 새 코드 버튼을 눌러 제한 없이 계속 변경할 수 있습니다.")
                                        )
                                    ),
                                    h("div", { className: "signup-policy-link-row" },
                                        h("a", { href: "/policy.html", className: "signup-policy-link", target: "_blank", rel: "noreferrer" }, "약관 전문 보기")
                                    ),
                                    h(ConsentChecklist, { title: "회원가입 필수 동의", items: SIGNUP_REQUIRED_TERMS, checked: signupTermsAgreed, onToggle: setSignupTermsAgreed, requiredLabel: "위 약관과 개인정보 수집 및 이용에 동의합니다." }),
                                    verificationSent ? h("div", { className: "success-box" }, "인증 메일을 보냈습니다. 코드를 입력해 가입을 완료해 주세요.") : null
                                ),
                            isLogin ? null : h(Feedback, { feedback: stepFeedback }),
                            h(Feedback, { feedback }),
                            h("div", { className: "inline-actions" },
                                isLogin
                                    ? h("button", { type: "button", className: "btn btn-primary", onClick: () => onSubmitAuth({ mode, uid, password }) }, "로그인")
                                    : [
                                      h("button", { type: "button", className: "btn btn-secondary", key: "send", onClick: requestVerificationMail, disabled: verificationLoading }, verificationLoading ? h(React.Fragment, null, h("span", { className: "loading-spinner", "aria-hidden": "true" }), "처리 중") : (verificationSent ? "인증 메일 다시 보내기" : "인증 메일 보내기")),
                                      h("button", { type: "button", className: "btn btn-primary", key: "verify", disabled: !verificationSent || signupLoading, onClick: completeSignup }, signupLoading ? h(React.Fragment, null, h("span", { className: "loading-spinner", "aria-hidden": "true" }), "처리 중") : "인증 완료 후 가입")
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
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "section-stack" },
                    h(PermissionNotice, {
                      label: "알림 확인은 로그인 사용자만 가능합니다.",
                      detail: "권한 관리 요청과 개인 알림을 한곳에서 확인합니다."
                    }),
                    h(PermissionMatrix, { items: [
                        { action: "알림 목록 확인", required: "로그인 사용자", available: !!session?.loggedIn },
                        { action: "매니저/부매니저 요청 수락", required: "알림 수신 본인", available: !!session?.loggedIn },
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
    const [avatarUrl, setAvatarUrl] = useState(profileData?.avatarUrl || "");
    const [bannerUrl, setBannerUrl] = useState(profileData?.bannerUrl || "");
    const [showPosts, setShowPosts] = useState(profileData?.showPosts !== false);
    const [showComments, setShowComments] = useState(profileData?.showComments !== false);
    const [showFollowers, setShowFollowers] = useState(profileData?.showFollowers !== false);
    const [showFollowing, setShowFollowing] = useState(profileData?.showFollowing !== false);
    const [profileUploadFeedback, setProfileUploadFeedback] = useState(null);
    const [profileUploading, setProfileUploading] = useState("");
    const avatarFileRef = useRef(null);
    const bannerFileRef = useRef(null);

    useEffect(() => {
      setStatusMessage(profileData?.statusMessage || "");
      setBio(profileData?.bio || "");
      setAccentColor(profileData?.accentColor || "#ff8fab");
      setAvatarUrl(profileData?.avatarUrl || "");
      setBannerUrl(profileData?.bannerUrl || "");
      setShowPosts(profileData?.showPosts !== false);
      setShowComments(profileData?.showComments !== false);
      setShowFollowers(profileData?.showFollowers !== false);
      setShowFollowing(profileData?.showFollowing !== false);
      setProfileUploadFeedback(null);
      setProfileUploading("");
    }, [profileData]);

    if (!profileData) {
      return h(React.Fragment, null,
          h(TopbarV2, { session, onLogout, alarmCount }),
          h("main", { className: "shell" }, h("div", { className: "frame" }, h("section", { className: "section-stack" }, h("div", { className: "error-box" }, "프로필을 불러오지 못했습니다."))))
      );
    }

    const stats = profileData.stats || {};
    const accentStyle = profileData.accentColor ? { borderTop: `4px solid ${profileData.accentColor}` } : null;
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

    const renderFollowList = (items = []) => h("div", { className: "compact-stack" }, items.map((user) =>
        h(Link, { href: `/profile/${encodeURIComponent(user.uid)}`, className: "mini-link-card", key: user.uid },
            h("div", { className: "board-title", style: { fontSize: "1rem" } }, h(MemberIdentity, { name: user.nick || user.uid, uid: user.uid, nickType: user.nick_type || user.nickType, className: "member-identity inline" })),
            h("div", { className: "muted" }, `@${user.uid} · ${formatDate(user.created_at)}`)
        )
    ));

    function renderFollowDetails({ title, count, hidden, items, emptyText }) {
      return h("details", { className: "profile-follow-details" },
          h("summary", null,
              h("span", null, title),
              h("strong", null, Number(count || 0).toLocaleString("ko-KR"))
          ),
          hidden
              ? h("div", { className: "empty-box" }, `${title} 목록이 비공개입니다.`)
              : items?.length ? renderFollowList(items) : h("div", { className: "empty-box" }, emptyText)
      );
    }

    return h(React.Fragment, null,
        h(TopbarV2, { session, onLogout, alarmCount }),
        h("main", { className: "shell" },
            h("div", { className: "frame" },
                h("section", { className: "section-stack" },
                    h("article", { className: "card profile-hero-card", style: accentStyle },
                        h("div", { className: "profile-banner", style: bannerUrl ? { backgroundImage: `url("${bannerUrl}")` } : null }),
                        h("div", { className: "profile-hero-head" },
                            h("div", { className: "profile-identity-row" },
                                h("div", { className: "profile-avatar" },
                                    avatarUrl ? h("img", { src: avatarUrl, alt: `${displayName} 프로필 사진` }) : h("span", null, initial)
                                ),
                                h("div", { className: "stack", style: { gap: "8px" } },
                                    h("span", { className: "eyebrow" }, profileData.ownerView ? "My Profile" : "Profile"),
                                    h("h1", { className: "section-title", style: { margin: 0 } }, h(MemberIdentity, { name: displayName, uid: profileData.uid, nickType: profileData.nickType, className: "member-identity profile" })),
                                    h("div", { className: "muted" }, `@${profileData.uid}`),
                                    profileData.statusMessage ? h("div", { className: "profile-status-text" }, profileData.statusMessage) : null
                                )
                            ),
                            h("div", { className: "profile-stat-grid" },
                                h("div", { className: "profile-stat-card" }, h("strong", null, stats.postCount ?? 0), h("span", null, "글")),
                                h("div", { className: "profile-stat-card" }, h("strong", null, stats.commentCount ?? 0), h("span", null, "댓글")),
                                h("div", { className: "profile-stat-card" }, h("strong", null, stats.followerCount ?? 0), h("span", null, "팔로워")),
                                h("div", { className: "profile-stat-card" }, h("strong", null, stats.followingCount ?? 0), h("span", null, "팔로잉"))
                            )
                        ),
                        profileData.bio ? h("div", { className: "profile-bio-box" }, profileData.bio) : null,
                        h("div", { className: "inline-actions" },
                            profileData.email ? h("span", { className: "chip" }, profileData.email) : null,
                            h("span", { className: "chip" }, nickTypeLabel(profileData.nickType)),
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
                                h("div", { className: "profile-upload-grid" },
                                    h("div", { className: "field" },
                                        h("label", null, "프로필 사진"),
                                        h("div", { className: "inline-actions" },
                                            h("button", { type: "button", className: "btn btn-secondary", disabled: profileUploading === "avatar", onClick: () => avatarFileRef.current?.click() }, profileUploading === "avatar" ? "업로드 중" : "사진 업로드"),
                                            avatarUrl ? h("button", { type: "button", className: "btn btn-ghost", onClick: () => setAvatarUrl("") }, "삭제") : null
                                        ),
                                        h("input", { ref: avatarFileRef, type: "file", accept: "image/*", hidden: true, onChange: (event) => handleProfileImageUpload("avatar", event) })
                                    ),
                                    h("div", { className: "field" },
                                        h("label", null, "프로필 배너"),
                                        h("div", { className: "inline-actions" },
                                            h("button", { type: "button", className: "btn btn-secondary", disabled: profileUploading === "banner", onClick: () => bannerFileRef.current?.click() }, profileUploading === "banner" ? "업로드 중" : "배너 업로드"),
                                            bannerUrl ? h("button", { type: "button", className: "btn btn-ghost", onClick: () => setBannerUrl("") }, "삭제") : null
                                        ),
                                        h("input", { ref: bannerFileRef, type: "file", accept: "image/*", hidden: true, onChange: (event) => handleProfileImageUpload("banner", event) })
                                    )
                                ),
                                h(Feedback, { feedback: profileUploadFeedback }),
                                h("div", { className: "field profile-color-field" }, h("label", { htmlFor: "profile-color" }, "테마 색상"), h("input", { id: "profile-color", type: "color", value: accentColor, onChange: (event) => setAccentColor(event.target.value || "#ff8fab") })),
                                h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: showPosts, onChange: (event) => setShowPosts(event.target.checked) }), h("span", null, "작성 글 공개")),
                                h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: showComments, onChange: (event) => setShowComments(event.target.checked) }), h("span", null, "작성 댓글 공개")),
                                h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: showFollowers, onChange: (event) => setShowFollowers(event.target.checked) }), h("span", null, "팔로워 목록 공개")),
                                h("label", { className: "check-row" }, h("input", { type: "checkbox", checked: showFollowing, onChange: (event) => setShowFollowing(event.target.checked) }), h("span", null, "팔로잉 목록 공개")),
                                h(Feedback, { feedback }),
                                h("div", { className: "inline-actions" }, h("button", { type: "button", className: "btn btn-primary", onClick: () => onSaveProfile({ statusMessage, bio, accentColor, avatarUrl, bannerUrl, showPosts, showComments, showFollowers, showFollowing }) }, "프로필 저장"))
                            )
                        )
                        : null,
                    h("article", { className: "card profile-list-card" },
                        h(SectionHead, { eyebrow: "Follow", title: "팔로우 세부 목록" }),
                        h("div", { className: "profile-follow-detail-grid" },
                            renderFollowDetails({ title: "팔로워", count: stats.followerCount, hidden: profileData.followersHidden, items: profileData.followers, emptyText: "팔로워가 없습니다." }),
                            renderFollowDetails({ title: "팔로잉", count: stats.followingCount, hidden: profileData.followingHidden, items: profileData.following, emptyText: "팔로잉이 없습니다." })
                        )
                    ),
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
        h(TopbarV2, { session, onLogout, alarmCount }),
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
    const [rankings, setRankings] = useState({ items: [], refreshCount: 0, remainingRefreshes: 10, canRefresh: true });
    const [searchResults, setSearchResults] = useState([]);
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
    const [boardPostsFeedback, setBoardPostsFeedback] = useState(null);
    const [submanagerFeedback, setSubmanagerFeedback] = useState(null);
    const [profileFeedback, setProfileFeedback] = useState(null);
    const [boardRequestFeedback, setBoardRequestFeedback] = useState(null);
    const [boardDashboard, setBoardDashboard] = useState({ requestedBoards: [], managedBoards: [] });
    const [rankingFeedback, setRankingFeedback] = useState(null);

    const currentBoard = boards.find((board) => board.gall_id === route.params.gid) || null;
    const targetProfileUid = route.params.uid || session.uid || "";
    const alarmCount = alarms.filter((alarm) => alarm?.actionable).length;
    const searchQuery = getSearchQueryFromLocation();
    const boardTypeFilter = getBoardTypeFromLocation();

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

    function refreshRankings() {
      return api("/api/board/rankings")
          .then((result) => setRankings(result?.success && result.data ? result.data : { items: [], refreshCount: 0, remainingRefreshes: 10, canRefresh: true }))
          .catch(() => setRankings({ items: [], refreshCount: 0, remainingRefreshes: 10, canRefresh: true }));
    }

    function requestRefreshRankings() {
      setRankingFeedback(null);
      return refreshRankings();
    }

    function refreshSearchResults(q) {
      const trimmed = (q || "").trim();
      if (!trimmed) {
        setSearchResults([]);
        return Promise.resolve();
      }
      return api(`/api/features/search?q=${encodeURIComponent(trimmed)}`)
          .then((result) => setSearchResults(result?.success && Array.isArray(result.posts) ? result.posts : []))
          .catch(() => setSearchResults([]));
    }

    function refreshAlarms() {
      if (!session?.loggedIn) {
        setAlarms([]);
        return Promise.resolve();
      }
      return api("/api/alarms/my").then((result) => setAlarms(result?.success && Array.isArray(result.alarms) ? result.alarms : [])).catch(() => setAlarms([]));
    }

    function refreshMyBoardDashboard() {
      if (!session?.loggedIn) {
        setBoardDashboard({ requestedBoards: [], managedBoards: [] });
        return Promise.resolve();
      }
      return api("/api/board/my")
          .then((result) => setBoardDashboard(result?.success && result.data ? result.data : { requestedBoards: [], managedBoards: [] }))
          .catch(() => setBoardDashboard({ requestedBoards: [], managedBoards: [] }));
    }

    function refreshBoardPosts(gid, nextPage) {
      setBoardPostsFeedback(null);
      return api(`/api/board/posts/${encodeURIComponent(gid)}?page=${nextPage}`)
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

    function refreshBoardManage(gid) {
      return api(`/api/board/manage/${encodeURIComponent(gid)}`)
          .then((result) => {
            const data = result?.success ? result.data : null;
            if ((route.name === "boardManage" || route.name === "boardStaffManage") && (!data || !data?.permissions?.canManage)) {
              setSettingsFeedback({ type: "error", message: result?.message || "보드 관리 권한이 없습니다." });
              navigate(`/board/${encodeURIComponent(gid)}`, true);
              setBoardManageData(null);
              return;
            }
            setBoardManageData(data);
          })
          .catch(() => {
            if (route.name === "boardManage" || route.name === "boardStaffManage") {
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
      refreshRankings();
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
      if (route.name === "boardManage" || route.name === "boardStaffManage") refreshBoardManage(route.params.gid);
      if (route.name === "write") refreshBoardManage(route.params.gid);
      if (route.name === "post") {
        refreshPostDetail(route.params.gid, route.params.postNo);
        refreshBoardManage(route.params.gid);
      }
      if (route.name === "profile") refreshProfile(targetProfileUid);
      if (route.name === "alarms") refreshAlarms();
      if (route.name === "boardRequests") refreshMyBoardDashboard();
      if (route.name === "search") refreshSearchResults(searchQuery);
    }, [route, page, targetProfileUid, session?.loggedIn]);

    function handleLogout() {
      fetch("/logout", { method: "POST", credentials: "include" }).finally(() => {
        setSession({ loggedIn: false });
        navigate("/", true);
      });
    }

    function submitAuth(payload) {
      if (payload.mode === "admin-login") {
        if (!payload.uid?.trim() || !payload.password || !payload.adminCode?.trim()) {
          setAuthFeedback({ type: "error", message: "관리자 아이디, 비밀번호, 전용 코드를 모두 입력해 주세요." });
          return;
        }
        api("/admin/login", {
          method: "POST",
          body: JSON.stringify({
            userID: payload.uid.trim(),
            password: payload.password,
            adminCode: payload.adminCode.trim()
          })
        }).then((result) => {
          if (!result.success) {
            setAuthFeedback({ type: "error", message: result.message || "관리자 로그인에 실패했습니다." });
            return;
          }
          refreshSession().then(() => navigate("/admin", true));
        }).catch((error) => setAuthFeedback({ type: "error", message: error.message || "관리자 로그인 요청 중 오류가 발생했습니다." }));
        return;
      }

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
      if (!payload.signupTermsAgreed) {
        setAuthFeedback({ type: "error", message: "회원가입 약관 및 개인정보 수집 동의가 필요합니다." });
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
        setWriteFeedback({ type: "error", message: "이 보드에는 로그인한 사용자만 글을 작성할 수 있습니다." });
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
        setCommentFeedback({ type: "error", message: "이 보드에는 로그인한 사용자만 댓글을 작성할 수 있습니다." });
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
      if (!importantActionConfirm("게시글 신고", [
        "허위 또는 보복성 신고 시 제한 대상이 될 수 있습니다.",
        "신고 사유는 운영 검토 자료로 활용될 수 있습니다."
      ])) return;
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
      if (!importantActionConfirm("댓글 신고", [
        "허위 또는 보복성 신고 시 제한 대상이 될 수 있습니다.",
        "신고 사유는 운영 검토 자료로 활용될 수 있습니다."
      ])) return;
      const reason = window.prompt("댓글 신고 사유를 입력해주세요.") || "";
      api(`/api/features/comments/${encodeURIComponent(commentId)}/report`, { method: "POST", body: JSON.stringify({ reason }) })
          .then((result) => setCommentFeedback({ type: result?.success ? "success" : "error", message: result?.message || "댓글 신고를 접수했습니다." }))
          .catch((error) => setCommentFeedback({ type: "error", message: error.message || "댓글 신고에 실패했습니다." }));
    }

    function cancelConcept(post) {
      if (!importantActionConfirm("개념글 취소", [
        "개념글에서 제외되면 메인 노출 상태가 바뀔 수 있습니다.",
        "보드 운영 기준에 따라 취소 사유를 스스로 설명할 책임이 있습니다."
      ])) return;
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/concept/cancel`, { method: "POST" })
          .then((result) => {
            setVoteFeedback({ type: result?.success ? "success" : "error", message: result?.message || "개념글을 취소했습니다." });
            refreshCurrentPost();
          })
          .catch((error) => setVoteFeedback({ type: "error", message: error.message || "개념글 취소에 실패했습니다." }));
    }

    function setConcept(post) {
      if (!importantActionConfirm("개념글 지정", [
        "운영 권한으로 이 글을 개념글 상태로 지정합니다.",
        "보드 운영 기준에 맞는 글인지 확인해 주세요."
      ])) return;
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/concept/set`, { method: "POST" })
          .then((result) => {
            setVoteFeedback({ type: result?.success ? "success" : "error", message: result?.message || "개념글로 지정했습니다." });
            refreshCurrentPost();
          })
          .catch((error) => setVoteFeedback({ type: "error", message: error.message || "개념글 지정에 실패했습니다." }));
    }

    function bumpPost(post) {
      if (!importantActionConfirm("포스트 끌어올리기", [
        "글 작성 시간이 현재 시각으로 갱신되어 목록 상단에 노출됩니다.",
        "공지 또는 운영상 필요한 글에만 사용해 주세요."
      ])) return;
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/bump`, { method: "POST" })
          .then((result) => {
            setVoteFeedback({ type: result?.success ? "success" : "error", message: result?.message || "포스트를 끌어올렸습니다." });
            refreshCurrentPost();
            refreshBoardPosts(post.gall_id, page);
          })
          .catch((error) => setVoteFeedback({ type: "error", message: error.message || "포스트 끌어올리기에 실패했습니다." }));
    }

    function setNotice(post, notice) {
      if (!importantActionConfirm(notice ? "공지 등록" : "공지 해제", [
        notice ? "이 글을 보드 공지로 올립니다." : "이 글의 공지 상태를 해제합니다.",
        "보드 목록 노출 순서가 바뀔 수 있습니다."
      ])) return;
      api(`/api/features/posts/${encodeURIComponent(post.gall_id)}/${encodeURIComponent(post.post_no)}/notice`, {
        method: "POST",
        body: JSON.stringify({ notice: String(!!notice) })
      }).then((result) => {
        setVoteFeedback({ type: result?.success ? "success" : "error", message: result?.message || (notice ? "공지로 등록했습니다." : "공지에서 해제했습니다.") });
        refreshCurrentPost();
        refreshBoardPosts(post.gall_id, page);
      }).catch((error) => setVoteFeedback({ type: "error", message: "공지 상태 변경에 실패했습니다." }));
    }

    function submitBoardSettings(payload) {
      if (!boardManageData?.permissions?.canEditSettings) {
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

    function managerPasswordForStaffAction(actionName) {
      const permissions = boardManageData?.permissions || {};
      if (permissions.isAdmin) return "";
      if (!permissions.isManager) return "";
      const password = window.prompt(`${actionName}을(를) 하려면 매니저 비밀번호를 다시 입력해 주세요.`);
      if (password === null) return null;
      if (!password.trim()) {
        setSubmanagerFeedback({ type: "error", message: "매니저 비밀번호를 입력해 주세요." });
        return null;
      }
      return password;
    }

    function appointSubmanager(targetUid, reset) {
      if (!boardManageData?.permissions?.canAssignSubmanager) {
        setSubmanagerFeedback({ type: "error", message: "부매니저를 임명할 권한이 없습니다." });
        return;
      }
      if (!importantActionConfirm("부매니저 임명", [
        "해당 사용자에게 부매니저 임명 요청 알림을 보냅니다.",
        "매니저가 수행하는 경우 본인 비밀번호 재확인이 필요합니다."
      ])) return;
      const password = managerPasswordForStaffAction("부매니저 임명");
      if (password === null) return;
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/submanager`, {
        method: "POST",
        body: JSON.stringify({ targetUid, password })
      }).then((result) => {
        if (!result?.success) {
          setSubmanagerFeedback({ type: "error", message: result?.message || "부매니저 임명 요청에 실패했습니다." });
          return;
        }
        reset?.();
        setSubmanagerFeedback({ type: "success", message: "부매니저 임명 요청 알림을 보냈습니다." });
        refreshBoardManage(route.params.gid);
      }).catch((error) => setSubmanagerFeedback({ type: "error", message: error.message || "부매니저 임명 요청에 실패했습니다." }));
    }

    function revokeSubmanager(targetUid) {
      if (!boardManageData?.permissions?.canAssignSubmanager) {
        setSubmanagerFeedback({ type: "error", message: "부매니저를 해제할 권한이 없습니다." });
        return;
      }
      if (!importantActionConfirm("부매니저 해제", [
        "선택한 사용자의 부매니저 권한을 즉시 해제합니다.",
        "매니저가 실행하는 경우 본인 비밀번호 재확인이 필요합니다."
      ])) return;
      const password = managerPasswordForStaffAction("부매니저 해제");
      if (password === null) return;
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/submanager/${encodeURIComponent(targetUid)}`, {
        method: "DELETE",
        body: JSON.stringify({ password })
      }).then((result) => {
        if (!result?.success) {
          setSubmanagerFeedback({ type: "error", message: result?.message || "부매니저 해제에 실패했습니다." });
          return;
        }
        setSubmanagerFeedback({ type: "success", message: "부매니저를 해제했습니다." });
        refreshBoardManage(route.params.gid);
      }).catch((error) => setSubmanagerFeedback({ type: "error", message: error.message || "부매니저 해제에 실패했습니다." }));
    }

    function transferManager(targetUid, reset) {
      if (!boardManageData?.permissions?.canTransferManager) {
        setSubmanagerFeedback({ type: "error", message: "매니저를 위임할 권한이 없습니다." });
        return;
      }
      if (!importantActionConfirm("매니저 위임", [
        "해당 부매니저에게 매니저 위임 요청 알림을 보냅니다.",
        "요청을 수락하면 현재 매니저 권한이 대상자에게 넘어갑니다."
      ])) return;
      const password = managerPasswordForStaffAction("매니저 위임");
      if (password === null) return;
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/manager`, {
        method: "POST",
        body: JSON.stringify({ targetUid, password })
      }).then((result) => {
        if (!result?.success) {
          setSubmanagerFeedback({ type: "error", message: result?.message || "매니저 위임 요청에 실패했습니다." });
          return;
        }
        reset?.();
        setSubmanagerFeedback({ type: "success", message: "매니저 위임 요청 알림을 보냈습니다." });
        refreshBoardManage(route.params.gid);
      }).catch((error) => setSubmanagerFeedback({ type: "error", message: error.message || "매니저 위임 요청에 실패했습니다." }));
    }

    function submitSubmanagerPermissions(targetUid, payload) {
      if (!targetUid) return;
      if (!boardManageData?.permissions?.canAssignSubmanager && !boardManageData?.permissions?.canManageSubmanager) {
        setSubmanagerFeedback({ type: "error", message: "부매니저 권한을 변경할 권한이 없습니다." });
        return;
      }
      const normalized = Object.fromEntries(Object.entries(payload || {}).map(([key, value]) => [key, String(!!value)]));
      api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/submanager/${encodeURIComponent(targetUid)}/permissions`, {
        method: "POST",
        body: JSON.stringify(normalized)
      }).then((result) => {
        if (!result?.success) {
          setSubmanagerFeedback({ type: "error", message: result?.message || "부매니저 권한 저장에 실패했습니다." });
          return;
        }
        setBoardManageData(result.data || boardManageData);
        setSubmanagerFeedback({ type: "success", message: "부매니저 권한을 저장했습니다." });
      }).catch((error) => setSubmanagerFeedback({ type: "error", message: error.message || "부매니저 권한 저장에 실패했습니다." }));
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
        setProfileFeedback({ type: "error", message: "로그인해야 팔로우할 수 있습니다." });
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
        setBoardRequestFeedback({ type: "error", message: "로그인해야 요청할 수 있습니다." });
        return;
      }
      if (!payload.gallId?.trim() || !payload.gallName?.trim() || !payload.topicId?.trim() || !payload.reason?.trim()) {
        setBoardRequestFeedback({ type: "error", message: "보드 ID, 이름, 주제, 요청 사유를 모두 입력해주세요." });
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
            if (session?.loggedIn) refreshMyBoardDashboard();
          })
          .catch((error) => setBoardRequestFeedback({ type: "error", message: error.message || "사이드 보드 요청에 실패했습니다." }));
    }

    function acceptAlarm(alarmId) {
      if (!session?.loggedIn) {
        setAlarmFeedback({ type: "error", message: "로그인해야 알림을 처리할 수 있습니다." });
        return;
      }
      if (!importantActionConfirm("알림 수락", [
        "권한 임명 또는 요청 수락이 즉시 반영될 수 있습니다.",
        "수락 이후에는 해당 권한 범위의 책임이 본인에게 부여됩니다."
      ])) return;
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
        setAlarmFeedback({ type: "error", message: "로그인해야 알림을 처리할 수 있습니다." });
        return;
      }
      if (!importantActionConfirm("알림 거절", [
        "거절 이후에는 같은 요청을 다시 받아야 진행할 수 있습니다.",
        "잘못된 요청이 아니라면 요청자와 운영 흐름에 영향을 줄 수 있습니다."
      ])) return;
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
          .catch((error) => setAlarmFeedback({ type: "error", message: error.message || "알림 읽음 처리 중에 실패했습니다." }));
    }

    if (route.name === "home") return h(HomePortalView, { session, boards, feed, rankings, rankingFeedback, onRefreshRankings: requestRefreshRankings, onLogout: handleLogout, alarmCount });
    if (route.name === "boards") return h(BoardsView, { session, boards, query, boardTypeFilter, onQueryChange: setQuery, onSubmitSideBoardRequest: submitSideBoardRequest, requestFeedback: boardRequestFeedback, onLogout: handleLogout, alarmCount });
    if (route.name === "feed") return h(FeedView, { session, feed, onLogout: handleLogout, alarmCount });
    if (route.name === "search") return h(SearchResultsView, { session, boards, posts: searchResults, searchQuery, onLogout: handleLogout, alarmCount });
    if (route.name === "boardRequests") return h(BoardRequestsView, { session, feedback: boardRequestFeedback, boardDashboard, onSubmitSideBoardRequest: submitSideBoardRequest, onLogout: handleLogout, alarmCount });
    if (route.name === "board") return h(BoardView, { session, gid: route.params.gid, board: currentBoard, posts: boardPosts, page, manageData: boardManageData, settingsFeedback, listFeedback: boardPostsFeedback, onPrevPage: () => navigate(`/board/${encodeURIComponent(route.params.gid)}?page=${Math.max(1, page - 1)}`), onNextPage: () => navigate(`/board/${encodeURIComponent(route.params.gid)}?page=${page + 1}`), onLogout: handleLogout, alarmCount });
    if (route.name === "boardManage") return h(BoardManageView, { session, gid: route.params.gid, board: currentBoard, manageData: boardManageData, feedback: settingsFeedback, submanagerFeedback, onSaveSettings: submitBoardSettings, onSaveSubmanagerPermissions: submitSubmanagerPermissions, onAppointSubmanager: appointSubmanager, onRevokeSubmanager: revokeSubmanager, onTransferManager: transferManager, onLogout: handleLogout, alarmCount });
    if (route.name === "boardStaffManage") return h(BoardStaffManageView, { session, gid: route.params.gid, board: currentBoard, manageData: boardManageData, feedback: submanagerFeedback, onSaveSubmanagerPermissions: submitSubmanagerPermissions, onAppointSubmanager: appointSubmanager, onRevokeSubmanager: revokeSubmanager, onTransferManager: transferManager, onLogout: handleLogout, alarmCount });
    if (route.name === "post") return h(PostView, { session, gid: route.params.gid, post: postData.post, comments: postData.comments, feedback: commentFeedback, deleteFeedback, voteFeedback, voteState: postData.voteState, manageData: boardManageData, onSubmitComment: submitComment, onDeletePost: submitDeletePost, onDeleteComment: submitDeleteComment, onVote: submitVote, onScrapPost: scrapPost, onReportPost: reportPost, onLikeComment: likeComment, onReportComment: reportComment, onCancelConcept: cancelConcept, onSetConcept: setConcept, onBumpPost: bumpPost, onSetNotice: setNotice, onLogout: handleLogout, alarmCount });
    if (route.name === "profile") return h(ProfileView, { session, profileData, feedback: profileFeedback, onSaveProfile: submitProfileSettings, onFollowProfile: followProfile, onUnfollowProfile: unfollowProfile, onLogout: handleLogout, alarmCount });
    if (route.name === "write") return h(WriteView, { session, gid: route.params.gid, feedback: writeFeedback, manageData: boardManageData, onSubmitPost: submitPost, onLogout: handleLogout, alarmCount });
    if (route.name === "login") return h(AuthView, { mode: "login", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
    if (route.name === "adminLogin") return h(AdminLoginView, { feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout, alarmCount });
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
