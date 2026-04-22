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
    if (replace) {
      window.history.replaceState({}, "", path);
    } else {
      window.history.pushState({}, "", path);
    }
    window.dispatchEvent(new Event("mobile:navigate"));
  }

  function MLink({ href, className, children }) {
    return h(
      "a",
      {
        href,
        className,
        onClick(event) {
          if (!href.startsWith("/m")) return;
          event.preventDefault();
          navigate(href);
        }
      },
      children
    );
  }

  function MobileTopbar({ session, onLogout }) {
    return h(
      "header",
      { className: "m-topbar" },
      h(
        "div",
        { className: "m-topbar-inner" },
        h(
          MLink,
          { href: "/m", className: "m-brand" },
          h("span", { className: "m-brand-mark" }),
          h("span", null, "irisen m")
        ),
        h(
          "div",
          { className: "m-actions" },
          session && session.loggedIn
            ? [
                h("span", { className: "m-chip", key: "who" }, h("span", { className: "m-dot" }), session.nick || session.uid),
                h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: onLogout, key: "logout" }, "로그아웃")
              ]
            : [
                h(MLink, { href: "/m/signin", className: "m-btn m-btn-secondary", key: "login" }, "로그인"),
                h(MLink, { href: "/m/nid", className: "m-btn m-btn-primary", key: "signup" }, "가입")
              ]
        )
      )
    );
  }

  function MobileSectionHead({ eyebrow, title, action }) {
    return h(
      "div",
      { className: "m-section-head" },
      h("div", null, h("span", { className: "m-eyebrow" }, eyebrow), h("h2", { className: "m-section-title" }, title)),
      action || null
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
          h("h1", { className: "m-title" }, "손안에서", h("br"), h("span", null, "바로 읽고 쓰는"), h("br"), "보드"),
          h("p", { className: "m-copy" }, "모바일 전용 경로 `/m` 아래에서만 동작하는 별도 React 화면입니다."),
          h(
            "div",
            { className: "m-inline", style: { marginTop: "18px" } },
            h(MLink, { href: "/m/boards", className: "m-btn m-btn-primary" }, "보드 보기"),
            h(MLink, { href: "/m/signin", className: "m-btn m-btn-secondary" }, "로그인")
          ),
          h(
            "div",
            { className: "m-stats" },
            h("div", { className: "m-stat" }, h("strong", null, boards.length), h("span", { className: "m-muted" }, "boards")),
            h("div", { className: "m-stat" }, h("strong", null, feed.length), h("span", { className: "m-muted" }, "recent")),
            h("div", { className: "m-stat" }, h("strong", null, session && session.loggedIn ? "ON" : "OFF"), h("span", { className: "m-muted" }, "session"))
          )
        ),
        h(
          "section",
          { className: "m-panel m-stack" },
          h(MobileSectionHead, { eyebrow: "Feed", title: "최근 글" }),
          feed.length
            ? feed.map((post) =>
                h(
                  MLink,
                  {
                    href: `/m/board/${encodeURIComponent(post.gall_id)}/${post.post_no}`,
                    className: "m-feed-card",
                    key: `${post.gall_id}-${post.post_no}`
                  },
                  h("div", { className: "m-meta m-muted" }, h("span", null, post.gall_id), h("span", null, formatDate(post.created_at || post.reg_date || post.writed_at))),
                  h("div", { className: "m-feed-title" }, post.title || "제목 없음"),
                  h("div", { className: "m-meta m-muted" }, h("span", null, post.name || "익명"), h("span", null, `#${post.post_no}`))
                )
              )
            : h("div", { className: "m-empty" }, "최근 글이 없습니다.")
        )
      )
    );
  }

  function BoardsView({ session, boards, query, onChangeQuery, onLogout }) {
    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      return boards.filter((board) => {
        if (!q) return true;
        return String(board.gall_id).toLowerCase().includes(q) || String(board.gall_name).toLowerCase().includes(q);
      });
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
          h(MobileSectionHead, { eyebrow: "Boards", title: "보드 목록", action: h(MLink, { href: "/m", className: "m-btn m-btn-secondary" }, "홈") }),
          h("input", {
            className: "m-search",
            type: "text",
            value: query,
            placeholder: "보드 이름 또는 ID",
            onChange(event) {
              onChangeQuery(event.target.value);
            }
          }),
          h(
            "div",
            { className: "m-stack" },
            filtered.length
              ? filtered.map((board) =>
                  h(
                    MLink,
                    {
                      href: `/m/board/${encodeURIComponent(board.gall_id)}`,
                      className: "m-board-card",
                      key: board.gall_id
                    },
                    h("span", { className: "m-eyebrow" }, "gallery"),
                    h("div", { className: "m-board-title" }, board.gall_name),
                    h("div", { className: "m-muted" }, `ID ${board.gall_id}`),
                    h("div", { className: "m-inline", style: { marginTop: "12px" } }, h("span", { className: "m-chip" }, `${board.post_count ?? 0} posts`))
                  )
                )
              : h("div", { className: "m-empty" }, "검색 결과가 없습니다.")
          )
        )
      )
    );
  }

  function BoardView({ session, gid, board, posts, page, onPrev, onNext, onLogout }) {
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
          h(MobileSectionHead, {
            eyebrow: "Board",
            title: board ? board.gall_name : gid,
            action: h("span", { className: "m-chip m-mono" }, gid)
          }),
          posts.length
            ? posts.map((post) =>
                h(
                  MLink,
                  {
                    href: `/m/board/${encodeURIComponent(gid)}/${post.post_no}`,
                    className: "m-post-row",
                    key: `${gid}-${post.post_no}`
                  },
                  h("div", { className: "m-meta m-muted" }, h("span", { className: "m-mono" }, `#${post.post_no}`), h("span", null, formatDate(post.created_at || post.reg_date || post.writed_at))),
                  h("div", { className: "m-post-title" }, post.title || "제목 없음"),
                  h("div", { className: "m-meta m-muted" }, h("span", null, post.name || "익명"), h("span", null, gid))
                )
              )
            : h("div", { className: "m-empty" }, "게시글이 없습니다."),
          h(
            "div",
            { className: "m-pagination" },
            h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: onPrev }, "이전"),
            h("span", { className: "m-chip" }, `page ${page}`),
            h("button", { type: "button", className: "m-btn m-btn-secondary", onClick: onNext }, "다음")
          ),
          session && session.loggedIn
            ? h(MLink, { href: `/m/board/${encodeURIComponent(gid)}/write`, className: "m-btn m-btn-primary" }, "이 보드에 글쓰기")
            : h(
                "div",
                { className: "m-feedback-error" },
                "로그인 후 글을 작성할 수 있습니다."
              )
        )
      )
    );
  }

  function PostView({ session, gid, postNo, post, onLogout }) {
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
                h("div", { className: "m-meta m-muted", key: "meta" }, h("span", { className: "m-chip m-mono" }, `${gid}/${postNo}`), h("span", null, formatDate(post.created_at || post.reg_date || post.writed_at))),
                h("h1", { className: "m-post-heading", key: "title" }, post.title || "제목 없음"),
                h("div", { className: "m-post-meta m-muted", key: "author" }, h("span", null, post.name || "익명"), h("span", null, post.writer_uid || "-")),
                h("div", { className: "m-post-body", key: "body", dangerouslySetInnerHTML: { __html: post.content || "" } }),
                h("div", { className: "m-inline", style: { marginTop: "18px" }, key: "actions" }, h(MLink, { href: `/m/board/${encodeURIComponent(gid)}`, className: "m-btn m-btn-secondary" }, "목록"), h(MLink, { href: `/m/board/${encodeURIComponent(gid)}/write`, className: "m-btn m-btn-primary" }, "글쓰기"))
              ]
            : h("div", { className: "m-feedback-error" }, "게시글을 불러오지 못했습니다.")
        )
      )
    );
  }

  function WriteView({ session, gid, feedback, onSubmit, onLogout }) {
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const disabled = !session || !session.loggedIn;

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
          h(MobileSectionHead, { eyebrow: "Compose", title: `${gid} 글쓰기`, action: h(MLink, { href: `/m/board/${encodeURIComponent(gid)}`, className: "m-btn m-btn-secondary" }, "보드") }),
          disabled ? h("div", { className: "m-feedback-error" }, "로그인 후 글을 작성할 수 있습니다.") : h("div", { className: "m-feedback-success" }, `${session.nick || session.uid} 계정으로 작성합니다.`),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-write-title" }, "제목"), h("input", { id: "m-write-title", type: "text", disabled, value: title, onChange: (event) => setTitle(event.target.value) })),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-write-content" }, "본문"), h("textarea", { id: "m-write-content", disabled, value: content, onChange: (event) => setContent(event.target.value) })),
          feedback ? h("div", { className: feedback.type === "error" ? "m-feedback-error" : "m-feedback-success" }, feedback.message) : null,
          h("button", {
            type: "button",
            className: "m-btn m-btn-primary",
            disabled,
            onClick() {
              onSubmit({ gid, title: title.trim(), content: content.trim() });
            }
          }, "게시하기")
        ),
        h(
          "aside",
          { className: "m-preview m-card m-stack" },
          h("span", { className: "m-eyebrow" }, "Preview"),
          h("div", { className: "m-preview-box", dangerouslySetInnerHTML: { __html: content.trim() || "아직 작성한 내용이 없습니다." } })
        )
      )
    );
  }

  function AuthView({ mode, feedback, onSubmit, session, onLogout }) {
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
          h("div", { className: "m-muted" }, "모바일 전용 인증 화면입니다."),
          feedback ? h("div", { className: feedback.type === "error" ? "m-feedback-error" : "m-feedback-success" }, feedback.message) : null,
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-uid" }, isLogin ? "아이디 또는 이메일" : "아이디"), h("input", { id: "m-auth-uid", type: "text", value: uid, onChange: (event) => setUid(event.target.value) })),
          isLogin ? null : h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-nick" }, "닉네임"), h("input", { id: "m-auth-nick", type: "text", value: nick, onChange: (event) => setNick(event.target.value) })),
          isLogin ? null : h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-email" }, "이메일"), h("input", { id: "m-auth-email", type: "email", value: email, onChange: (event) => setEmail(event.target.value) })),
          h("div", { className: "m-field" }, h("label", { htmlFor: "m-auth-pw" }, "비밀번호"), h("input", { id: "m-auth-pw", type: "password", value: password, onChange: (event) => setPassword(event.target.value) })),
          h("button", { type: "button", className: "m-btn m-btn-primary", onClick: () => onSubmit({ uid, nick, email, password }) }, isLogin ? "로그인" : "회원가입"),
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
      h(
        "main",
        { className: "m-shell m-stack" },
        h(
          "section",
          { className: "m-auth m-card m-stack" },
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
    const [postDetail, setPostDetail] = useState(null);
    const [authFeedback, setAuthFeedback] = useState(null);
    const [writeFeedback, setWriteFeedback] = useState(null);

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
        api(`/api/board/posts/${encodeURIComponent(route.params.gid)}?page=${page}`).then((data) => {
          setBoardPosts(Array.isArray(data) ? data : []);
        }).catch(() => setBoardPosts([]));
      }
      if (route.name === "post") {
        api(`/api/posts/get/${encodeURIComponent(route.params.gid)}/${encodeURIComponent(route.params.postNo)}`).then((result) => {
          setPostDetail(result && result.success ? result.post : null);
        }).catch(() => setPostDetail(null));
      }
    }, [route, page]);

    useEffect(() => {
      if (route.name !== "board") setPage(1);
      if (route.name !== "login" && route.name !== "signup") setAuthFeedback(null);
      if (route.name !== "write") setWriteFeedback(null);
      window.scrollTo({ top: 0, behavior: "auto" });
    }, [route]);

    function handleLogout() {
      fetch("/logout", { method: "POST", credentials: "include" }).finally(() => {
        setSession({ loggedIn: false });
        navigate("/m", true);
      });
    }

    function handleAuthSubmit(payload) {
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
        setTimeout(() => navigate(`/m/board/${encodeURIComponent(payload.gid)}`), 350);
      }).catch(() => setWriteFeedback({ type: "error", message: "게시글 작성 중 오류가 발생했습니다." }));
    }

    if (route.name === "home") {
      return h(HomeView, { session, boards, feed, onLogout: handleLogout });
    }
    if (route.name === "boards") {
      return h(BoardsView, { session, boards, query, onChangeQuery: setQuery, onLogout: handleLogout });
    }
    if (route.name === "board") {
      const board = boards.find((item) => item.gall_id === route.params.gid) || { gall_id: route.params.gid, gall_name: route.params.gid };
      return h(BoardView, {
        session,
        gid: route.params.gid,
        board,
        posts: boardPosts,
        page,
        onPrev: () => setPage((value) => Math.max(1, value - 1)),
        onNext: () => setPage((value) => value + 1),
        onLogout: handleLogout
      });
    }
    if (route.name === "post") {
      return h(PostView, {
        session,
        gid: route.params.gid,
        postNo: route.params.postNo,
        post: postDetail,
        onLogout: handleLogout
      });
    }
    if (route.name === "write") {
      return h(WriteView, {
        session,
        gid: route.params.gid,
        feedback: writeFeedback,
        onSubmit: handleSubmitPost,
        onLogout: handleLogout
      });
    }
    if (route.name === "login") {
      return h(AuthView, { mode: "login", feedback: authFeedback, onSubmit: handleAuthSubmit, session, onLogout: handleLogout });
    }
    if (route.name === "signup") {
      return h(AuthView, { mode: "signup", feedback: authFeedback, onSubmit: handleAuthSubmit, session, onLogout: handleLogout });
    }
    return h(NotFoundView, { session, onLogout: handleLogout });
  }

  const root = document.getElementById("mobile-app");
  if (root) {
    ReactDOM.createRoot(root).render(h(App));
  }
})();
