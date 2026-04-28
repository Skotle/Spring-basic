(() => {
  const h = React.createElement;
  const { useEffect, useMemo, useState } = React;

  const api = (url, options = {}) =>
    fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options
    }).then((response) => response.json());

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

  function matchRoute(pathname) {
    if (pathname === "/m") return { name: "home", params: {} };
    if (pathname === "/m/signin") return { name: "login", params: {} };
    if (pathname === "/m/nid") return { name: "signup", params: {} };
    if (pathname === "/m/boards") return { name: "boards", params: {} };

    let match = pathname.match(/^\/m\/board\/([^/]+)\/write$/);
    if (match) return { name: "write", params: { gid: decodeURIComponent(match[1]) } };

    match = pathname.match(/^\/m\/board\/([^/]+)\/([^/]+)$/);
    if (match) return { name: "post", params: { gid: decodeURIComponent(match[1]), postNo: decodeURIComponent(match[2]) } };

    match = pathname.match(/^\/m\/board\/([^/]+)$/);
    if (match) return { name: "board", params: { gid: decodeURIComponent(match[1]) } };

    return { name: "notFound", params: {} };
  }

  function navigate(path, replace = false) {
    if (replace) window.history.replaceState({}, "", path);
    else window.history.pushState({}, "", path);
    window.dispatchEvent(new Event("mobile:navigate"));
  }

  function MLink({ href, className, children }) {
    return h("a", {
      href,
      className,
      onClick(event) {
        if (!href.startsWith("/m")) return;
        event.preventDefault();
        navigate(href);
      }
    }, children);
  }

  function MobileTopbar({ session, onLogout }) {
    const navItems = [
      { label: "홈", href: "/m" },
      { label: "보드", href: "/m/boards" },
      { label: "피드", href: "/m" },
      { label: session?.loggedIn ? "내정보" : "로그인", href: session?.loggedIn ? "/m" : "/m/signin" },
      { label: "가입", href: "/m/nid" }
    ];
    return h(
      "header",
      { className: "m-topbar" },
      h(
        "div",
        { className: "m-top-searchbar" },
        h(MLink, { href: "/m", className: "m-mobile-logo", "aria-label": "모바일 홈" }, "I"),
        h("div", { className: "m-search-panel" },
          h("button", { type: "button", className: "m-menu-btn", "aria-label": "메뉴" }, h("span"), h("span"), h("span")),
          h("span", { className: "m-search-placeholder" }, "보드 & 게시글 검색"),
          h("span", { className: "m-search-symbol", "aria-hidden": "true" }),
          h("span", { className: "m-recent-visit" }, session?.loggedIn ? "내 보드" : "로그인")
        )
      ),
      h("nav", { className: "m-primary-tabs", "aria-label": "모바일 주요 메뉴" },
        navItems.map((item) => h(MLink, { key: item.label, href: item.href, className: item.label === "보드" ? "is-active" : "" }, item.label))
      ),
      h("div", { className: "m-session-strip" },
        session?.loggedIn
          ? [
              h("span", { className: "m-session-name", key: "nick" }, session.nick || session.uid),
              h("button", { type: "button", className: "m-session-link", key: "logout", onClick: onLogout }, "로그아웃")
            ]
          : [
              h(MLink, { href: "/m/signin", className: "m-session-link", key: "login" }, "로그인"),
              h(MLink, { href: "/m/nid", className: "m-session-link", key: "signup" }, "가입")
            ]
      )
    );
  }

  function MSectionHead({ eyebrow, title, action }) {
    return h("div", { className: "m-section-head" }, h("div", null, h("span", { className: "m-eyebrow" }, eyebrow), h("h2", { className: "m-section-title" }, title)), action || null);
  }

  function MFeedback({ feedback }) {
    if (!feedback) return null;
    return h("div", { className: feedback.type === "error" ? "m-feedback-error" : "m-feedback-success" }, feedback.message);
  }

  function MGuestFields({ name, password, setName, setPassword, prefix }) {
    return [
      h("div", { className: "m-field", key: `${prefix}-name` }, h("label", { htmlFor: `${prefix}-name` }, "비회원 이름"), h("input", { id: `${prefix}-name`, type: "text", value: name, onChange: (event) => setName(event.target.value) })),
      h("div", { className: "m-field", key: `${prefix}-pw` }, h("label", { htmlFor: `${prefix}-pw` }, "비밀번호"), h("input", { id: `${prefix}-pw`, type: "password", value: password, onChange: (event) => setPassword(event.target.value) }))
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

  function MHtmlEditor({ id, value, onChange, placeholder }) {
    const editorRef = React.useRef(null);

    useEffect(() => {
      if (!editorRef.current) return;
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || "";
      }
    }, [value]);

    return h("div", { className: "m-editor-shell" },
      h(MEditorToolbar),
      h("div", {
        id,
        ref: editorRef,
        className: "m-html-editor",
        contentEditable: true,
        suppressContentEditableWarning: true,
        "data-placeholder": placeholder,
        onInput(event) {
          onChange(event.currentTarget.innerHTML);
        }
      }),
      h("div", { className: "m-muted", style: { fontSize: "0.86rem" } }, "보이는 서식 그대로 HTML로 저장됩니다.")
    );
  }

  function HomeView({ session, boards, feed, onLogout }) {
    return h(
      React.Fragment,
      null,
      h(MobileTopbar, { session, onLogout }),
      h(
        "main",
        { className: "m-shell m-stack" },
        h(
          "section",
          { className: "m-hero m-card" },
          h("span", { className: "m-eyebrow" }, "Mobile"),
          h("h1", { className: "m-title" }, "모바일에서", h("br"), h("span", null, "읽고 댓글 달고"), h("br"), "바로 쓰기"),
          h("p", { className: "m-copy" }, "비회원도 비밀번호만 입력하면 모바일 전용 경로에서 글과 댓글을 남길 수 있습니다."),
          h("div", { className: "m-inline", style: { marginTop: "16px" } }, h(MLink, { href: "/m/boards", className: "m-btn m-btn-primary" }, "보드 보기"), h(MLink, { href: "/m/signin", className: "m-btn m-btn-secondary" }, "로그인")),
          h("div", { className: "m-stats" }, h("div", { className: "m-stat" }, h("strong", null, boards.length), h("span", { className: "m-muted" }, "boards")), h("div", { className: "m-stat" }, h("strong", null, feed.length), h("span", { className: "m-muted" }, "recent")), h("div", { className: "m-stat" }, h("strong", null, session?.loggedIn ? "MEMBER" : "GUEST"), h("span", { className: "m-muted" }, "mode")))
        ),
        h(
          "section",
          { className: "m-panel m-stack" },
          h(MSectionHead, { eyebrow: "Feed", title: "최근 글" }),
          feed.length
            ? feed.map((post) => h(MLink, { href: `/m/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`, className: "m-feed-card", key: `${post.gall_id}-${post.post_no}` }, h("div", { className: "m-meta m-muted" }, h("span", null, post.gall_id), h("span", null, formatDate(post.writed_at || post.created_at || post.reg_date))), h("div", { className: "m-feed-title" }, post.title || "제목 없음"), h("div", { className: "m-meta m-muted" }, h("span", null, post.name || "익명"), h("span", null, `#${post.post_no}`))))
            : h("div", { className: "m-empty" }, "최근 글이 없습니다.")
        )
      )
    );
  }

  function BoardsView({ session, boards, query, onChangeQuery, onLogout }) {
    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      return boards.filter((board) => !q || String(board.gall_id).toLowerCase().includes(q) || String(board.gall_name).toLowerCase().includes(q));
    }, [boards, query]);

    return h(
      React.Fragment,
      null,
      h(MobileTopbar, { session, onLogout }),
      h(
        "main",
        { className: "m-shell m-stack" },
        h(
          "section",
          { className: "m-panel m-stack" },
          h(MSectionHead, { eyebrow: "Boards", title: "보드 목록", action: h(MLink, { href: "/m", className: "m-btn m-btn-secondary" }, "홈") }),
          h("input", { className: "m-search", type: "text", value: query, placeholder: "보드 이름 또는 ID", onChange: (event) => onChangeQuery(event.target.value) }),
          filtered.length
            ? filtered.map((board) => h(MLink, { href: `/m/board/${encodeURIComponent(board.gall_id)}`, className: "m-board-card", key: board.gall_id }, h("span", { className: "m-eyebrow" }, "gallery"), h("div", { className: "m-board-title" }, board.gall_name), h("div", { className: "m-muted" }, `ID ${board.gall_id}`), h("div", { className: "m-inline", style: { marginTop: "10px" } }, h("span", { className: "m-chip" }, `${board.post_count ?? 0} posts`))))
            : h("div", { className: "m-empty" }, "검색 결과가 없습니다.")
        )
      )
    );
  }

  function BoardView({ session, gid, board, posts, page, settings, onPrev, onNext, onLogout }) {
    const [selectedCategory, setSelectedCategory] = useState("전체");
    const [listMode, setListMode] = useState("all");
    const configuredCategories = categoryOptionsFromSettings(settings);
    const postCategories = posts.map((post) => String(post.category || "").trim()).filter(Boolean);
    const categories = ["전체", ...Array.from(new Set([...configuredCategories, ...postCategories]))];
    const parsedConceptThreshold = Number(settings?.concept_recommend_threshold || settings?.concept_threshold);
    const conceptThreshold = Number.isFinite(parsedConceptThreshold) && parsedConceptThreshold > 0 ? parsedConceptThreshold : 10;
    const isConceptPost = (post) =>
      Number(post.is_concept || post.concept || 0) === 1 ||
      Number(post.recommend_count || post.recommend || post.likes || 0) >= conceptThreshold;
    const isNoticePost = (post) => Number(post.notice || post.is_notice || 0) === 1;
    const filteredPosts = posts.filter((post) => {
      const matchesCategory = selectedCategory === "전체" || String(post.category || "일반") === selectedCategory;
      const matchesMode =
        listMode === "all" ||
        (listMode === "concept" && isConceptPost(post)) ||
        (listMode === "notice" && isNoticePost(post));
      return matchesCategory && matchesMode;
    });
    const visiblePosts = filteredPosts.slice(0, 15);
    const boardInitial = String(board?.gall_name || gid || "I").trim().charAt(0).toUpperCase();

    useEffect(() => {
      if (!categories.includes(selectedCategory)) {
        setSelectedCategory("전체");
      }
    }, [gid, categories.join("|")]);

    return h(
      React.Fragment,
      null,
      h(MobileTopbar, { session, onLogout }),
      h(
        "main",
        { className: "m-shell m-board-screen" },
        h(
          "section",
          { className: "m-board-titlebar" },
          h("div", { className: "m-board-title-main" },
            h("h1", { className: "m-board-name" }, board ? board.gall_name : gid),
            h("span", { className: "m-board-type" }, String(board?.gall_type || "m").toUpperCase()),
            h("span", { className: "m-board-count" }, `(${posts.length.toLocaleString("ko-KR")})`)
          ),
          h("div", { className: "m-board-title-actions" },
            h("span", { className: "m-info-dot" }, "i"),
            h("span", null, "보드정보"),
            h("span", null, "운영"),
            h(MLink, { href: `/m/board/${encodeURIComponent(gid)}/write`, className: "m-write-outline" }, "글쓰기")
          )
        ),
        h(
          "section",
          { className: "m-board-notice-card" },
          h("div", { className: "m-board-notice-logo" }, boardInitial),
          h("div", null,
            h("strong", null, settings?.board_notice || settings?.welcome_message || `${board ? board.gall_name : gid} 모바일 게시판입니다.`),
            h("span", null, settings?.welcome_message && settings?.board_notice ? settings.welcome_message : "말머리를 선택해서 원하는 글만 빠르게 볼 수 있습니다.")
          ),
          h("span", { className: "m-info-float" }, "i")
        ),
        h(
          "section",
          { className: "m-board-tabs", "aria-label": "글 목록 종류" },
          h("button", { type: "button", className: listMode === "all" ? "is-active" : "", onClick: () => setListMode("all") }, "전체"),
          h("button", { type: "button", className: listMode === "concept" ? "is-active" : "", onClick: () => setListMode("concept") }, "개념글"),
          h("button", { type: "button", className: listMode === "notice" ? "is-active" : "", onClick: () => setListMode("notice") }, "공지"),
          h("button", { type: "button", className: "m-tab-count" }, `${filteredPosts.length}개`)
        ),
        h(
          "section",
          { className: "m-category-strip", "aria-label": "말머리 목록" },
          categories.map((category) =>
            h("button", {
              key: category,
              type: "button",
              className: selectedCategory === category ? "is-active" : "",
              onClick: () => setSelectedCategory(category)
            }, category)
          )
        ),
        h(
          "section",
          { className: "m-compact-list" },
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
                    h("span", null, post.name || "익명"),
                    h("span", null, formatDate(post.writed_at || post.created_at || post.reg_date)),
                    isConceptPost(post) ? h("span", { className: "m-concept-mark" }, "개념") : null
                  )
                )
              )
            : h("div", { className: "m-empty" }, listMode === "concept" ? "조건에 맞는 개념글이 없습니다." : "게시글이 없습니다."),
          filteredPosts.length > 15 ? h("div", { className: "m-list-note" }, "모바일 화면 가독성을 위해 현재 페이지에서 15개까지 표시합니다.") : null
        ),
        h(
          "section",
          { className: "m-board-bottom" },
          h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: onPrev }, "이전"),
          h("span", { className: "m-chip" }, `page ${page}`),
          h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: onNext }, "다음")
        )
      )
    );
  }

  function PostView({ session, gid, postNo, post, comments, feedback, onSubmitComment, onLogout }) {
    const [content, setContent] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");

    return h(
      React.Fragment,
      null,
      h(MobileTopbar, { session, onLogout }),
      h(
        "main",
        { className: "m-shell m-stack" },
        h(
          "article",
          { className: "m-post-card" },
          post
            ? [
                h("div", { className: "m-meta m-muted", key: "meta" }, h("span", { className: "m-chip m-mono" }, `${gid}/${postNo}`), post.category ? h("span", { className: "m-chip" }, `[${post.category}]`) : null, h("span", null, formatDate(post.writed_at || post.created_at || post.reg_date))),
                h("h1", { className: "m-post-heading", key: "title" }, post.title || "제목 없음"),
                h("div", { className: "m-post-meta m-muted", key: "author" }, h("span", null, post.name || "익명"), h("span", null, `${post.comment_count ?? comments.length} comments`)),
                h("div", { className: "m-post-body", key: "body", dangerouslySetInnerHTML: { __html: post.content || "" } }),
                h("div", { className: "m-inline", style: { marginTop: "14px" }, key: "actions" }, h(MLink, { href: `/m/board/${encodeURIComponent(gid)}`, className: "m-btn m-btn-secondary" }, "목록"), h(MLink, { href: `/m/board/${encodeURIComponent(gid)}/write`, className: "m-btn m-btn-primary" }, "글쓰기")),
                h(
                  "section",
                  { className: "m-panel m-stack", style: { marginTop: "14px" }, key: "comment-list" },
                  h(MSectionHead, { eyebrow: "Comments", title: "댓글" }),
                  comments.length
                    ? comments.map((comment) => h("div", { className: "m-post-row", key: comment.id }, h("div", { className: "m-meta m-muted" }, h("span", null, comment.name || "익명"), h("span", null, formatDate(comment.writed_at))), h("div", { className: "m-post-title", style: { fontSize: "0.98rem" } }, comment.content || "")))
                    : h("div", { className: "m-empty" }, "댓글이 없습니다.")
                ),
                h(
                  "section",
                  { className: "m-panel m-stack", key: "comment-form" },
                  session?.loggedIn ? null : h(MGuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "m-comment" }),
                  h("div", { className: "m-field" }, h("label", { htmlFor: "m-comment-content" }, "댓글 내용"), h("textarea", { id: "m-comment-content", value: content, onChange: (event) => setContent(event.target.value) })),
                  h(MFeedback, { feedback }),
                  h("button", {
                    type: "button",
                    className: "m-btn m-btn-primary",
                    onClick() {
                      onSubmitComment({
                        gid,
                        postNo,
                        content: content.trim(),
                        name: guestName.trim(),
                        password: guestPassword
                      }, () => {
                        setContent("");
                        setGuestName("");
                        setGuestPassword("");
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

  function WriteView({ session, gid, feedback, settings, onSubmitPost, onLogout }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [category, setCategory] = useState("");
    const [guestName, setGuestName] = useState("");
    const [guestPassword, setGuestPassword] = useState("");
    const categoryOptions = categoryOptionsFromSettings(settings);

    useEffect(() => {
      if (!category && categoryOptions.length) {
        setCategory(categoryOptions[0]);
      }
      if (category && categoryOptions.length && !categoryOptions.includes(category)) {
        setCategory(categoryOptions[0]);
      }
    }, [settings?.category_options]);

    return h(
      React.Fragment,
      null,
      h(MobileTopbar, { session, onLogout }),
      h(
        "main",
        { className: "m-shell m-stack" },
        h(
          "section",
          { className: "m-compose m-card m-stack" },
          h(MSectionHead, { eyebrow: "Compose", title: `${gid} 글쓰기`, action: h(MLink, { href: `/m/board/${encodeURIComponent(gid)}`, className: "m-btn m-btn-secondary" }, "보드") }),
          h("div", { className: session?.loggedIn ? "m-feedback-success" : "m-feedback-error" }, session?.loggedIn ? `${session.nick || session.uid} 계정으로 작성합니다.` : "비회원은 이름과 비밀번호를 반드시 입력해야 합니다."),
          session?.loggedIn ? null : h(MGuestFields, { name: guestName, password: guestPassword, setName: setGuestName, setPassword: setGuestPassword, prefix: "m-post" }),
          categoryOptions.length
            ? h("div", { className: "m-field" },
                h("label", { htmlFor: "m-write-category" }, "말머리"),
                h("select", { id: "m-write-category", value: category || categoryOptions[0], onChange: (event) => setCategory(event.target.value) },
                  categoryOptions.map((option) => h("option", { key: option, value: option }, `[${option}]`))
                )
              )
            : null,
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-write-title" }, "제목"), h("input", { id: "m-write-title", type: "text", value: title, onChange: (event) => setTitle(event.target.value) })),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-write-content" }, "본문"), h(MHtmlEditor, { id: "m-write-content", value: content, onChange: setContent, placeholder: "모바일에서도 바로 글을 쓰면 HTML로 저장됩니다." })),
          h(MFeedback, { feedback }),
          h("button", {
            type: "button",
            className: "m-btn m-btn-primary",
            onClick() {
              onSubmitPost({
                gid,
                category: category || categoryOptions[0] || "",
                title: title.trim(),
                content: content.trim(),
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
          }, "게시하기")
        ),
        h("section", { className: "m-preview m-card m-stack" }, h("span", { className: "m-eyebrow" }, "Saved HTML"), h("div", { className: "m-preview-box", dangerouslySetInnerHTML: { __html: content || "<p>아직 작성한 내용이 없습니다.</p>" } }))
      )
    );
  }

  function AuthView({ mode, feedback, onSubmitAuth, session, onLogout }) {
    const [uid, setUid] = useState("");
    const [nick, setNick] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const isLogin = mode === "login";

    return h(
      React.Fragment,
      null,
      h(MobileTopbar, { session, onLogout }),
      h(
        "main",
        { className: "m-shell m-stack" },
        h(
          "section",
          { className: "m-auth m-card m-stack" },
          h("span", { className: "m-eyebrow" }, isLogin ? "Access" : "Join"),
          h("h1", { className: "m-section-title" }, isLogin ? "로그인" : "회원가입"),
          h("div", { className: "m-muted" }, "회원으로 쓰거나, 비회원으로도 참여할 수 있습니다."),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-uid" }, isLogin ? "아이디 또는 이메일" : "아이디"), h("input", { id: "m-auth-uid", type: "text", value: uid, onChange: (event) => setUid(event.target.value) })),
          isLogin ? null : h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-nick" }, "닉네임"), h("input", { id: "m-auth-nick", type: "text", value: nick, onChange: (event) => setNick(event.target.value) })),
          isLogin ? null : h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-email" }, "이메일"), h("input", { id: "m-auth-email", type: "email", value: email, onChange: (event) => setEmail(event.target.value) })),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-pw" }, "비밀번호"), h("input", { id: "m-auth-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value) })),
          h(MFeedback, { feedback }),
          h("button", { type: "button", className: "m-btn m-btn-primary", onClick: () => onSubmitAuth({ uid, nick, email, password }) }, isLogin ? "로그인" : "회원가입"),
          h(MLink, { href: isLogin ? "/m/nid" : "/m/signin", className: "m-btn m-btn-secondary" }, isLogin ? "회원가입" : "로그인으로")
        )
      )
    );
  }

  function NotFoundView({ session, onLogout }) {
    return h(
      React.Fragment,
      null,
      h(MobileTopbar, { session, onLogout }),
      h("main", { className: "m-shell m-stack" }, h("section", { className: "m-auth m-card m-stack" }, h("span", { className: "m-eyebrow" }, "404"), h("h1", { className: "m-section-title" }, "모바일 페이지를 찾을 수 없습니다."), h(MLink, { href: "/m", className: "m-btn m-btn-primary" }, "모바일 홈"))));
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
    const [postData, setPostData] = useState({ post: null, comments: [] });
    const [authFeedback, setAuthFeedback] = useState(null);
    const [writeFeedback, setWriteFeedback] = useState(null);
    const [commentFeedback, setCommentFeedback] = useState(null);

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
      if (route.name === "home") {
        api("/api/posts/recommend").then(setFeed).catch(() => setFeed([]));
      }
      if (route.name === "board") {
        api(`/api/board/posts/${encodeURIComponent(route.params.gid)}?page=${page}`).then((data) => setBoardPosts(Array.isArray(data) ? data : [])).catch(() => setBoardPosts([]));
      }
      if (route.name === "post") {
        api(`/api/posts/get/${encodeURIComponent(route.params.gid)}/${encodeURIComponent(route.params.postNo)}`).then((result) => {
          setPostData({
            post: result && result.success ? result.post : null,
            comments: result && result.success && Array.isArray(result.comments) ? result.comments : []
          });
        }).catch(() => setPostData({ post: null, comments: [] }));
      }
      if (route.name === "board" || route.name === "write") {
        api(`/api/board/manage/${encodeURIComponent(route.params.gid)}/settings`).then((result) => {
          setBoardSettings(result && result.success ? result.data : null);
        }).catch(() => setBoardSettings(null));
      }
    }, [route, page]);

    useEffect(() => {
      if (route.name !== "board") setPage(1);
      if (route.name !== "login" && route.name !== "signup") setAuthFeedback(null);
      if (route.name !== "write") setWriteFeedback(null);
      if (route.name !== "write" && route.name !== "board") setBoardSettings(null);
      if (route.name !== "post") setCommentFeedback(null);
      window.scrollTo({ top: 0, behavior: "auto" });
    }, [route]);

    const currentBoard = boards.find((board) => board.gall_id === route.params.gid) || null;

    function handleLogout() {
      fetch("/logout", { method: "POST", credentials: "include" }).finally(() => {
        setSession({ loggedIn: false });
        navigate("/m", true);
      });
    }

    function submitAuth(payload) {
      if (route.name === "login") {
        if (!payload.uid.trim() || !payload.password) {
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
          api("/api/check-login").then((nextSession) => {
            setSession(nextSession);
            navigate("/m", true);
          });
        }).catch(() => setAuthFeedback({ type: "error", message: "로그인 요청 중 오류가 발생했습니다." }));
        return;
      }

      if (!payload.uid.trim() || !payload.nick.trim() || payload.password.length < 4) {
        setAuthFeedback({ type: "error", message: "아이디, 닉네임, 4자 이상 비밀번호를 입력해주세요." });
        return;
      }

      api("/api/signup", {
        method: "POST",
        body: JSON.stringify({
          userID: payload.uid.trim(),
          username: payload.nick.trim(),
          email: payload.email.trim(),
          password: payload.password
        })
      }).then((result) => {
        if (!result.success) {
          setAuthFeedback({ type: "error", message: result.message || "회원가입에 실패했습니다." });
          return;
        }
        setAuthFeedback({ type: "success", message: "가입이 완료되었습니다. 로그인으로 이동합니다." });
        setTimeout(() => navigate("/m/signin"), 450);
      }).catch(() => setAuthFeedback({ type: "error", message: "회원가입 요청 중 오류가 발생했습니다." }));
    }

    function submitPost(payload, reset) {
      if (!payload.title || !payload.content) {
        setWriteFeedback({ type: "error", message: "제목과 본문을 모두 입력해주세요." });
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

      api("/api/posts/write", {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((result) => {
        if (!result.success) {
          setWriteFeedback({ type: "error", message: result.message || "게시글 작성에 실패했습니다." });
          return;
        }
        setWriteFeedback({ type: "success", message: "게시글이 등록되었습니다." });
        if (typeof reset === "function") reset();
        setTimeout(() => navigate(`/m/board/${encodeURIComponent(payload.gid)}`), 350);
      }).catch(() => setWriteFeedback({ type: "error", message: "게시글 작성 중 오류가 발생했습니다." }));
    }

    function submitComment(payload, reset) {
      if (!payload.content) {
        setCommentFeedback({ type: "error", message: "댓글 내용을 입력해주세요." });
        return;
      }
      if (!session?.loggedIn && (!payload.name || !payload.password)) {
        setCommentFeedback({ type: "error", message: "비회원은 이름과 비밀번호를 반드시 입력해야 합니다." });
        return;
      }

      api("/api/posts/comment", {
        method: "POST",
        body: JSON.stringify(payload)
      }).then((result) => {
        if (!result.success) {
          setCommentFeedback({ type: "error", message: result.message || "댓글 등록에 실패했습니다." });
          return;
        }
        setCommentFeedback({ type: "success", message: "댓글이 등록되었습니다." });
        if (typeof reset === "function") reset();
        api(`/api/posts/get/${encodeURIComponent(payload.gid)}/${encodeURIComponent(payload.postNo)}`).then((next) => {
          setPostData({
            post: next && next.success ? next.post : null,
            comments: next && next.success && Array.isArray(next.comments) ? next.comments : []
          });
        });
      }).catch(() => setCommentFeedback({ type: "error", message: "댓글 등록 중 오류가 발생했습니다." }));
    }

    if (route.name === "home") return h(HomeView, { session, boards, feed, onLogout: handleLogout });
    if (route.name === "boards") return h(BoardsView, { session, boards, query, onChangeQuery: setQuery, onLogout: handleLogout });
    if (route.name === "board") return h(BoardView, { session, gid: route.params.gid, board: currentBoard, posts: boardPosts, page, settings: boardSettings, onPrev: () => setPage((value) => Math.max(1, value - 1)), onNext: () => setPage((value) => value + 1), onLogout: handleLogout });
    if (route.name === "post") return h(PostView, { session, gid: route.params.gid, postNo: route.params.postNo, post: postData.post, comments: postData.comments, feedback: commentFeedback, onSubmitComment: submitComment, onLogout: handleLogout });
    if (route.name === "write") return h(WriteView, { session, gid: route.params.gid, feedback: writeFeedback, settings: boardSettings, onSubmitPost: submitPost, onLogout: handleLogout });
    if (route.name === "login") return h(AuthView, { mode: "login", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout });
    if (route.name === "signup") return h(AuthView, { mode: "signup", feedback: authFeedback, onSubmitAuth: submitAuth, session, onLogout: handleLogout });
    return h(NotFoundView, { session, onLogout: handleLogout });
  }

  const root = document.getElementById("mobile-app");
  if (root) {
    ReactDOM.createRoot(root).render(h(App));
  }
})();
