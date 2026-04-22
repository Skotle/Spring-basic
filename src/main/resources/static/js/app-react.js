(() => {
  const h = React.createElement;
  const { useEffect, useMemo, useState } = React;

  function api(url, options = {}) {
    return fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      ...options
    }).then((response) => response.json());
  }

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function matchRoute(pathname) {
    if (pathname === "/") return { name: "home", params: {} };
    if (pathname === "/signin") return { name: "login", params: {} };
    if (pathname === "/nid") return { name: "signup", params: {} };
    if (pathname === "/boards" || pathname === "/board_main") return { name: "boards", params: {} };

    let match = pathname.match(/^\/board\/([^/]+)\/write$/);
    if (match) {
      return { name: "write", params: { gid: decodeURIComponent(match[1]) } };
    }

    match = pathname.match(/^\/board\/([^/]+)\/([^/]+)$/);
    if (match) {
      return {
        name: "post",
        params: { gid: decodeURIComponent(match[1]), postNo: decodeURIComponent(match[2]) }
      };
    }

    match = pathname.match(/^\/board\/([^/]+)$/);
    if (match) {
      return { name: "board", params: { gid: decodeURIComponent(match[1]) } };
    }

    return { name: "notFound", params: {} };
  }

  function navigate(path, replace = false) {
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    window.dispatchEvent(new Event("app:navigate"));
  }

  function Link({ href, className, children }) {
    return h(
      "a",
      {
        href,
        className,
        onClick(event) {
          if (!href.startsWith("/")) return;
          event.preventDefault();
          navigate(href);
        }
      },
      children
    );
  }

  function Topbar({ session, onLogout }) {
    return h(
      "header",
      { className: "topbar" },
      h(
        "div",
        { className: "frame" },
        h(
          "div",
          { className: "topbar-inner" },
          h(
            Link,
            { href: "/", className: "brand" },
            h("span", { className: "brand-mark" }),
            h("span", null, "irisen archive")
          ),
          h(
            "div",
            { className: "nav-actions" },
            h(Link, { href: "/", className: "btn btn-ghost" }, "홈"),
            h(Link, { href: "/boards", className: "btn btn-ghost" }, "보드"),
            session && session.loggedIn
              ? [
                  h(
                    "span",
                    { className: "chip", key: "chip" },
                    h("span", { className: "chip-dot" }),
                    session.nick || session.uid
                  ),
                  h(
                    "button",
                    { className: "btn btn-secondary", onClick: onLogout, key: "logout", type: "button" },
                    "로그아웃"
                  )
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

  function SectionTitle({ eyebrow, title, action }) {
    return h(
      "div",
      { className: "section-head" },
      h(
        "div",
        null,
        h("span", { className: "eyebrow" }, eyebrow),
        h("h1", { className: "section-title" }, title)
      ),
      action || null
    );
  }

  function HomeView({ session, boards, feed, onLogout }) {
    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "hero" },
            h(
              "article",
              { className: "hero-card card" },
              h("span", { className: "eyebrow" }, "React Single Page Board"),
              h(
                "h1",
                { className: "hero-title" },
                "하나의 앱에서",
                h("br"),
                h("span", null, "읽고 쓰고 이동하는"),
                h("br"),
                "보드 화면"
              ),
              h(
                "p",
                { className: "hero-copy" },
                "이제 페이지 조각 대신 React 컴포넌트로 전체 화면을 다시 구성했습니다. 홈, 보드, 글 상세, 글쓰기까지 모두 같은 앱 안에서 전환됩니다."
              ),
              h(
                "div",
                { className: "inline-actions", style: { marginTop: "24px" } },
                h(Link, { href: "/boards", className: "btn btn-primary" }, "보드 둘러보기"),
                h(Link, { href: "/signin", className: "btn btn-ghost" }, "로그인")
              ),
              h(
                "div",
                { className: "hero-metrics" },
                h("div", { className: "metric" }, h("strong", null, boards.length), h("span", null, "boards indexed")),
                h("div", { className: "metric" }, h("strong", null, feed.length), h("span", null, "recent posts")),
                h("div", { className: "metric" }, h("strong", null, session && session.loggedIn ? "ON" : "OFF"), h("span", null, "session state"))
              )
            ),
            session && session.loggedIn
              ? h(
                  "aside",
                  { className: "session-card card" },
                  h("span", { className: "eyebrow" }, "Session"),
                  h("h2", { className: "section-title" }, session.nick || session.uid),
                  h(
                    "div",
                    { className: "stack" },
                    h("div", { className: "chip mono" }, `uid ${session.uid}`),
                    h("div", { className: "chip" }, `role ${session.memberDivision || "user"}`),
                    h("div", { className: "chip" }, `icon ${session.nickIconType || "default"}`)
                  ),
                  h(
                    "div",
                    { className: "inline-actions", style: { marginTop: "18px" } },
                    h(Link, { href: "/boards", className: "btn btn-primary" }, "보드로 이동"),
                    h("button", { type: "button", className: "btn btn-secondary", onClick: onLogout }, "세션 종료")
                  )
                )
              : h(
                  "aside",
                  { className: "session-card card" },
                  h("span", { className: "eyebrow" }, "Entry"),
                  h("h2", { className: "section-title" }, "로그인 후 바로 글쓰기"),
                  h("p", { className: "hero-copy" }, "세션이 있으면 글쓰기 화면으로 바로 이동하고, 없으면 인증 화면으로 이어집니다."),
                  h(
                    "div",
                    { className: "inline-actions", style: { marginTop: "18px" } },
                    h(Link, { href: "/signin", className: "btn btn-primary" }, "로그인"),
                    h(Link, { href: "/nid", className: "btn btn-secondary" }, "회원가입")
                  )
                )
          ),
          h(
            "section",
            { className: "section" },
            h(SectionTitle, {
              eyebrow: "Live Feed",
              title: "최근 올라온 글",
              action: h(Link, { href: "/boards", className: "btn btn-secondary" }, "전체 보드 보기")
            }),
            h(
              "section",
              { className: "feed-layout" },
              h(
                "div",
                { className: "panel list" },
                feed.length
                  ? feed.map((post) =>
                      h(
                        Link,
                        {
                          href: `/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`,
                          className: "feed-card",
                          key: `${post.gall_id}-${post.post_no}`
                        },
                        h(
                          "div",
                          { className: "meta-row muted" },
                          h("span", null, post.gall_id),
                          h("span", null, formatDate(post.created_at || post.reg_date || post.writed_at))
                        ),
                        h("div", { className: "feed-title" }, post.title || "제목 없음"),
                        h(
                          "div",
                          { className: "meta-row muted" },
                          h("span", null, post.name || "익명"),
                          h("span", null, `#${post.post_no}`)
                        )
                      )
                    )
                  : h("div", { className: "empty-box" }, "최근 글이 아직 없습니다.")
              ),
              h(
                "aside",
                { className: "panel list" },
                h(
                  Link,
                  { href: "/boards", className: "quick-card" },
                  h("div", { className: "board-title" }, "보드 목록"),
                  h("div", { className: "muted" }, "관심 있는 갤러리를 바로 찾습니다.")
                ),
                h(
                  Link,
                  { href: "/signin", className: "quick-card" },
                  h("div", { className: "board-title" }, "로그인"),
                  h("div", { className: "muted" }, "세션 기반으로 글쓰기 권한을 받습니다.")
                ),
                h(
                  Link,
                  { href: "/nid", className: "quick-card" },
                  h("div", { className: "board-title" }, "회원가입"),
                  h("div", { className: "muted" }, "아이디, 닉네임, 이메일로 계정을 만듭니다.")
                )
              )
            )
          )
        )
      )
    );
  }

  function BoardsView({ session, boards, query, onQueryChange, onLogout }) {
    const filteredBoards = useMemo(() => {
      const normalized = query.trim().toLowerCase();
      return boards.filter((board) => {
        if (!normalized) return true;
        return String(board.gall_id).toLowerCase().includes(normalized) ||
          String(board.gall_name).toLowerCase().includes(normalized);
      });
    }, [boards, query]);

    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "section" },
            h(SectionTitle, {
              eyebrow: "Boards",
              title: "보드 목록",
              action: h(Link, { href: "/", className: "btn btn-secondary" }, "홈으로")
            }),
            h(
              "div",
              { className: "panel" },
              h("input", {
                className: "searchbar",
                type: "text",
                placeholder: "보드 이름 또는 ID 검색",
                value: query,
                onChange(event) {
                  onQueryChange(event.target.value);
                }
              })
            ),
            h(
              "section",
              { className: "board-grid", style: { marginTop: "18px" } },
              filteredBoards.length
                ? filteredBoards.map((board) =>
                    h(
                      Link,
                      {
                        href: `/board/${encodeURIComponent(board.gall_id)}`,
                        className: "board-card",
                        key: board.gall_id
                      },
                      h("span", { className: "eyebrow" }, "gallery"),
                      h("div", { className: "board-title" }, board.gall_name),
                      h("p", { className: "muted" }, `보드 ID ${board.gall_id}`),
                      h(
                        "div",
                        { className: "post-stats", style: { marginTop: "18px" } },
                        h("span", { className: "chip" }, `${board.post_count ?? 0} posts`)
                      )
                    )
                  )
                : h("div", { className: "empty-box" }, "검색 조건에 맞는 보드가 없습니다.")
            )
          )
        )
      )
    );
  }

  function BoardView({ session, board, posts, page, onPrevPage, onNextPage, onLogout }) {
    const gid = board ? board.gall_id : "";
    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "section" },
            h(SectionTitle, {
              eyebrow: "Board",
              title: board ? board.gall_name : gid,
              action: h(
                "div",
                { className: "board-tools" },
                h("span", { className: "chip mono" }, gid),
                h("span", { className: "chip" }, `${board && board.post_count != null ? board.post_count : posts.length} posts`)
              )
            }),
            h(
              "section",
              { className: "board-layout" },
              h(
                "div",
                { className: "panel board-main" },
                posts.length
                  ? posts.map((post) =>
                      h(
                        Link,
                        {
                          href: `/board/${encodeURIComponent(gid)}/${post.post_no}`,
                          className: "post-row",
                          key: `${gid}-${post.post_no}`
                        },
                        h(
                          "div",
                          { className: "post-row-top muted" },
                          h("span", { className: "mono" }, `#${post.post_no}`),
                          h("span", null, formatDate(post.created_at || post.reg_date || post.writed_at))
                        ),
                        h("div", { className: "post-title" }, post.title || "제목 없음"),
                        h(
                          "div",
                          { className: "post-row-bottom muted" },
                          h("span", null, post.name || "익명"),
                          h("span", null, gid)
                        )
                      )
                    )
                  : h("div", { className: "empty-box" }, "아직 게시글이 없습니다."),
                h(
                  "div",
                  { className: "pagination" },
                  h("button", { type: "button", className: "btn btn-ghost", onClick: onPrevPage }, "이전"),
                  h("span", { className: "chip" }, `page ${page}`),
                  h("button", { type: "button", className: "btn btn-ghost", onClick: onNextPage }, "다음")
                )
              ),
              session && session.loggedIn
                ? h(
                    "aside",
                    { className: "panel board-side" },
                    h("span", { className: "eyebrow" }, "Write"),
                    h("h3", { className: "section-title", style: { fontSize: "1.8rem" } }, "새 글 작성"),
                    h("p", { className: "muted" }, "로그인된 계정으로 바로 이 보드에 글을 씁니다."),
                    h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "btn btn-primary" }, "작성 화면 열기")
                  )
                : h(
                    "aside",
                    { className: "panel board-side" },
                    h("span", { className: "eyebrow" }, "Auth"),
                    h("h3", { className: "section-title", style: { fontSize: "1.8rem" } }, "글쓰기는 로그인 후"),
                    h("p", { className: "muted" }, "세션이 있어야 게시글 작성 API를 사용할 수 있습니다."),
                    h(
                      "div",
                      { className: "inline-actions" },
                      h(Link, { href: "/signin", className: "btn btn-primary" }, "로그인"),
                      h(Link, { href: "/nid", className: "btn btn-secondary" }, "회원가입")
                    )
                  )
            )
          )
        )
      )
    );
  }

  function PostView({ session, post, gid, postNo, onLogout }) {
    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "post-detail" },
            h(
              "article",
              { className: "post-card" },
              post
                ? [
                    h(
                      "div",
                      { className: "meta-row muted", key: "meta" },
                      h("span", { className: "chip mono" }, `${gid} / ${postNo}`),
                      h("span", null, formatDate(post.created_at || post.reg_date || post.writed_at))
                    ),
                    h("h1", { className: "post-heading", key: "title" }, post.title || "제목 없음"),
                    h(
                      "div",
                      { className: "post-stats muted", key: "stats" },
                      h("span", null, post.name || "익명"),
                      h("span", null, `writer ${post.writer_uid || "-"}`)
                    ),
                    h("div", {
                      className: "post-body",
                      key: "body",
                      dangerouslySetInnerHTML: { __html: post.content || "" }
                    }),
                    h(
                      "div",
                      { className: "inline-actions", style: { marginTop: "24px" }, key: "actions" },
                      h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-secondary" }, "목록으로"),
                      h(Link, { href: `/board/${encodeURIComponent(gid)}/write`, className: "btn btn-primary" }, "이 보드에 글쓰기")
                    )
                  ]
                : h("div", { className: "error-box" }, "게시글을 불러오지 못했습니다.")
            )
          )
        )
      )
    );
  }

  function WriteView({ session, gid, feedback, onPreviewChange, onSubmit, onLogout }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");

    useEffect(() => {
      onPreviewChange(content);
    }, [content, onPreviewChange]);

    const disabled = !session || !session.loggedIn;
    const previewHtml = content.trim() || "아직 작성한 내용이 없습니다.";

    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "section" },
            h(SectionTitle, {
              eyebrow: "Compose",
              title: `${gid} 글쓰기`,
              action: h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-secondary" }, "보드로 돌아가기")
            }),
            h(
              "section",
              { className: "write-shell" },
              h(
                "article",
                { className: "compose-card card" },
                disabled
                  ? h("div", { className: "error-box" }, "로그인 후 글을 작성할 수 있습니다.")
                  : h("div", { className: "success-box" }, `현재 ${(session.nick || session.uid)} 계정으로 작성합니다.`),
                h(
                  "div",
                  { className: "composer", style: { marginTop: "16px" } },
                  h(
                    "div",
                    { className: "field" },
                    h("label", { htmlFor: "write-title" }, "제목"),
                    h("input", {
                      id: "write-title",
                      type: "text",
                      placeholder: "글 제목을 입력하세요",
                      disabled,
                      value: title,
                      onChange(event) {
                        setTitle(event.target.value);
                      }
                    })
                  ),
                  h(
                    "div",
                    { className: "field" },
                    h("label", { htmlFor: "write-content" }, "본문"),
                    h("textarea", {
                      id: "write-content",
                      placeholder: "HTML도 입력할 수 있습니다.",
                      disabled,
                      value: content,
                      onChange(event) {
                        setContent(event.target.value);
                      }
                    })
                  ),
                  h(
                    "div",
                    { className: "inline-actions" },
                    h(
                      "button",
                      {
                        type: "button",
                        className: "btn btn-primary",
                        disabled,
                        onClick() {
                          onSubmit({ gid, title: title.trim(), content: content.trim() });
                        }
                      },
                      "게시하기"
                    ),
                    h(Link, { href: `/board/${encodeURIComponent(gid)}`, className: "btn btn-ghost" }, "취소")
                  ),
                  feedback ? h("div", { className: `${feedback.type === "error" ? "error-box" : "success-box"}` }, feedback.message) : null
                )
              ),
              h(
                "aside",
                { className: "preview-card card" },
                h("span", { className: "eyebrow" }, "Preview"),
                h("h3", { className: "section-title", style: { fontSize: "1.8rem" } }, "미리보기"),
                h("p", { className: "muted" }, "입력한 본문을 즉시 렌더링합니다."),
                h("div", { className: "preview", dangerouslySetInnerHTML: { __html: previewHtml } })
              )
            )
          )
        )
      )
    );
  }

  function AuthView({ mode, feedback, onSubmit, session, onLogout }) {
    const isLogin = mode === "login";
    const [uid, setUid] = useState("");
    const [nick, setNick] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "auth-wrap" },
            h(
              "article",
              { className: "auth-card card" },
              h("span", { className: "eyebrow" }, isLogin ? "Access" : "Join"),
              h("h1", { className: "section-title" }, isLogin ? "로그인" : "회원가입"),
              h("p", { className: "muted" }, "리액트 컴포넌트 기반으로 인증 화면도 새로 구성했습니다."),
              feedback ? h("div", { className: `${feedback.type === "error" ? "error-box" : "success-box"}`, style: { marginTop: "16px" } }, feedback.message) : null,
              h(
                "div",
                { className: "stack", style: { marginTop: "16px" } },
                h(
                  "div",
                  { className: "field" },
                  h("label", { htmlFor: "auth-uid" }, isLogin ? "아이디 또는 이메일" : "아이디"),
                  h("input", {
                    id: "auth-uid",
                    type: "text",
                    value: uid,
                    onChange(event) {
                      setUid(event.target.value);
                    }
                  })
                ),
                isLogin
                  ? null
                  : [
                      h(
                        "div",
                        { className: "field", key: "nick" },
                        h("label", { htmlFor: "auth-nick" }, "닉네임"),
                        h("input", {
                          id: "auth-nick",
                          type: "text",
                          value: nick,
                          onChange(event) {
                            setNick(event.target.value);
                          }
                        })
                      ),
                      h(
                        "div",
                        { className: "field", key: "email" },
                        h("label", { htmlFor: "auth-email" }, "이메일"),
                        h("input", {
                          id: "auth-email",
                          type: "email",
                          value: email,
                          onChange(event) {
                            setEmail(event.target.value);
                          }
                        })
                      )
                    ],
                h(
                  "div",
                  { className: "field" },
                  h("label", { htmlFor: "auth-pw" }, "비밀번호"),
                  h("input", {
                    id: "auth-pw",
                    type: "password",
                    value: password,
                    onChange(event) {
                      setPassword(event.target.value);
                    }
                  })
                ),
                h(
                  "div",
                  { className: "inline-actions" },
                  h(
                    "button",
                    {
                      type: "button",
                      className: "btn btn-primary",
                      onClick() {
                        onSubmit({ uid, nick, email, password });
                      }
                    },
                    isLogin ? "로그인" : "회원가입"
                  ),
                  h(Link, { href: isLogin ? "/nid" : "/signin", className: "btn btn-secondary" }, isLogin ? "회원가입" : "로그인으로")
                )
              )
            )
          )
        )
      )
    );
  }

  function NotFoundView({ session, onLogout }) {
    return h(
      React.Fragment,
      null,
      h(Topbar, { session, onLogout }),
      h(
        "main",
        { className: "shell" },
        h(
          "div",
          { className: "frame" },
          h(
            "section",
            { className: "auth-wrap" },
            h(
              "article",
              { className: "auth-card card" },
              h("span", { className: "eyebrow" }, "404"),
              h("h1", { className: "section-title" }, "페이지를 찾을 수 없습니다."),
              h("p", { className: "muted" }, "이 경로는 현재 리액트 라우터에 등록되어 있지 않습니다."),
              h(
                "div",
                { className: "inline-actions", style: { marginTop: "20px" } },
                h(Link, { href: "/", className: "btn btn-primary" }, "홈으로"),
                h(Link, { href: "/boards", className: "btn btn-secondary" }, "보드로")
              )
            )
          )
        )
      )
    );
  }

  function App() {
    const [route, setRoute] = useState(matchRoute(window.location.pathname));
    const [session, setSession] = useState(null);
    const [boards, setBoards] = useState([]);
    const [feed, setFeed] = useState([]);
    const [boardQuery, setBoardQuery] = useState("");
    const [boardPage, setBoardPage] = useState(1);
    const [boardPosts, setBoardPosts] = useState([]);
    const [boardDetail, setBoardDetail] = useState(null);
    const [postDetail, setPostDetail] = useState(null);
    const [authFeedback, setAuthFeedback] = useState(null);
    const [writeFeedback, setWriteFeedback] = useState(null);

    useEffect(() => {
      function syncRoute() {
        setRoute(matchRoute(window.location.pathname));
      }

      window.addEventListener("popstate", syncRoute);
      window.addEventListener("app:navigate", syncRoute);
      return () => {
        window.removeEventListener("popstate", syncRoute);
        window.removeEventListener("app:navigate", syncRoute);
      };
    }, []);

    useEffect(() => {
      document.title = `${route.name} | irisen`;
    }, [route]);

    useEffect(() => {
      api("/api/check-login").then(setSession).catch(() => setSession({ loggedIn: false }));
      api("/api/board/list").then(setBoards).catch(() => setBoards([]));
    }, []);

    useEffect(() => {
      if (route.name === "home") {
        api("/api/posts/recommend").then(setFeed).catch(() => setFeed([]));
      }
    }, [route]);

    useEffect(() => {
      if (route.name === "board") {
        api(`/api/board/posts/${encodeURIComponent(route.params.gid)}?page=${boardPage}`)
          .then((data) => {
            setBoardPosts(Array.isArray(data) ? data : []);
            setBoardDetail(boards.find((board) => board.gall_id === route.params.gid) || {
              gall_id: route.params.gid,
              gall_name: route.params.gid,
              post_count: Array.isArray(data) ? data.length : 0
            });
          })
          .catch(() => {
            setBoardPosts([]);
            setBoardDetail(null);
          });
      }
    }, [route, boardPage, boards]);

    useEffect(() => {
      if (route.name === "post") {
        api(`/api/posts/get/${encodeURIComponent(route.params.gid)}/${encodeURIComponent(route.params.postNo)}`)
          .then((result) => {
            setPostDetail(result && result.success ? result.post : null);
          })
          .catch(() => setPostDetail(null));
      }
    }, [route]);

    useEffect(() => {
      if (route.name !== "board") {
        setBoardPage(1);
      }
      if (route.name !== "login" && route.name !== "signup") {
        setAuthFeedback(null);
      }
      if (route.name !== "write") {
        setWriteFeedback(null);
      }
      window.scrollTo({ top: 0, behavior: "auto" });
    }, [route]);

    function handleLogout() {
      fetch("/logout", { method: "POST", credentials: "include" }).finally(() => {
        setSession({ loggedIn: false });
        navigate("/", true);
      });
    }

    function handleBoardPrev() {
      if (boardPage <= 1) return;
      setBoardPage((page) => page - 1);
    }

    function handleBoardNext() {
      setBoardPage((page) => page + 1);
    }

    function handleAuthSubmit(payload) {
      if (route.name === "login") {
        if (!payload.uid.trim() || !payload.password) {
          setAuthFeedback({ type: "error", message: "아이디와 비밀번호를 모두 입력해주세요." });
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
            navigate("/", true);
          });
        }).catch(() => {
          setAuthFeedback({ type: "error", message: "로그인 요청 중 오류가 발생했습니다." });
        });

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

        setAuthFeedback({ type: "success", message: "가입이 완료되었습니다. 로그인 화면으로 이동합니다." });
        setTimeout(() => navigate("/signin"), 500);
      }).catch(() => {
        setAuthFeedback({ type: "error", message: "회원가입 요청 중 오류가 발생했습니다." });
      });
    }

    function handleSubmitPost(payload) {
      if (!payload.title || !payload.content) {
        setWriteFeedback({ type: "error", message: "제목과 본문을 모두 입력해주세요." });
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
        setTimeout(() => navigate(`/board/${encodeURIComponent(payload.gid)}`), 400);
      }).catch(() => {
        setWriteFeedback({ type: "error", message: "게시글 작성 중 오류가 발생했습니다." });
      });
    }

    if (route.name === "home") {
      return h(HomeView, { session, boards, feed, onLogout: handleLogout });
    }

    if (route.name === "boards") {
      return h(BoardsView, {
        session,
        boards,
        query: boardQuery,
        onQueryChange: setBoardQuery,
        onLogout: handleLogout
      });
    }

    if (route.name === "board") {
      return h(BoardView, {
        session,
        board: boardDetail,
        posts: boardPosts,
        page: boardPage,
        onPrevPage: handleBoardPrev,
        onNextPage: handleBoardNext,
        onLogout: handleLogout
      });
    }

    if (route.name === "post") {
      return h(PostView, {
        session,
        post: postDetail,
        gid: route.params.gid,
        postNo: route.params.postNo,
        onLogout: handleLogout
      });
    }

    if (route.name === "write") {
      return h(WriteView, {
        session,
        gid: route.params.gid,
        feedback: writeFeedback,
        onPreviewChange() {},
        onSubmit: handleSubmitPost,
        onLogout: handleLogout
      });
    }

    if (route.name === "login") {
      return h(AuthView, {
        mode: "login",
        feedback: authFeedback,
        onSubmit: handleAuthSubmit,
        session,
        onLogout: handleLogout
      });
    }

    if (route.name === "signup") {
      return h(AuthView, {
        mode: "signup",
        feedback: authFeedback,
        onSubmit: handleAuthSubmit,
        session,
        onLogout: handleLogout
      });
    }

    return h(NotFoundView, { session, onLogout: handleLogout });
  }

  const rootElement = document.getElementById("app");
  if (rootElement) {
    ReactDOM.createRoot(rootElement).render(h(App));
  }
})();
