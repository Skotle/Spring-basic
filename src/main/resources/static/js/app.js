const appState = {
  route: { name: "home", params: {} },
  session: null,
  boards: [],
  boardQuery: "",
  boardPage: 1,
  boardPosts: [],
  boardDetail: null,
  postDetail: null,
  feed: [],
  loading: false,
  error: "",
  message: ""
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options
  });
  return response.json();
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

function getApp() {
  return document.getElementById("app");
}

function setTitle(title) {
  document.title = title ? `${title} | irisen` : "irisen";
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
  appState.route = matchRoute(window.location.pathname);
  bootRoute();
}

function topbar() {
  const session = appState.session;
  const authButtons = session?.loggedIn
    ? `
      <span class="chip"><span class="chip-dot"></span>${escapeHtml(session.nick || session.uid)}</span>
      <button class="btn btn-secondary" data-action="logout">로그아웃</button>
    `
    : `
      <a class="btn btn-ghost" href="/signin">로그인</a>
      <a class="btn btn-primary" href="/nid">회원가입</a>
    `;

  return `
    <header class="topbar">
      <div class="frame">
        <div class="topbar-inner">
          <a class="brand" href="/">
            <span class="brand-mark"></span>
            <span>irisen archive</span>
          </a>
          <div class="nav-actions">
            <a class="btn btn-ghost" href="/">홈</a>
            <a class="btn btn-ghost" href="/boards">보드</a>
            ${authButtons}
          </div>
        </div>
      </div>
    </header>
  `;
}

function homeView() {
  const feedMarkup = appState.feed.length
    ? appState.feed.map((post) => `
        <a class="feed-card" href="/board/${encodeURIComponent(post.gall_id)}/${post.post_no}">
          <div class="meta-row muted">
            <span>${escapeHtml(post.gall_id)}</span>
            <span>${formatDate(post.created_at || post.reg_date || post.writed_at)}</span>
          </div>
          <div class="feed-title">${escapeHtml(post.title || "제목 없음")}</div>
          <div class="meta-row muted">
            <span>${escapeHtml(post.name || "익명")}</span>
            <span>#${escapeHtml(post.post_no)}</span>
          </div>
        </a>
      `).join("")
    : `<div class="empty-box">최근 글이 아직 없습니다.</div>`;

  const session = appState.session;
  const sessionPanel = session?.loggedIn
    ? `
      <div class="session-card card">
        <span class="eyebrow">SESSION</span>
        <h2 class="section-title">${escapeHtml(session.nick || session.uid)}</h2>
        <div class="stack">
          <div class="chip mono">uid ${escapeHtml(session.uid)}</div>
          <div class="chip">role ${escapeHtml(session.memberDivision || "user")}</div>
          <div class="chip">icon ${escapeHtml(session.nickIconType || "default")}</div>
        </div>
        <div class="inline-actions" style="margin-top:18px;">
          <a class="btn btn-primary" href="/boards">보드 둘러보기</a>
          <button class="btn btn-secondary" data-action="logout">세션 종료</button>
        </div>
      </div>
    `
    : `
      <div class="session-card card">
        <span class="eyebrow">ENTRY</span>
        <h2 class="section-title">읽고, 쓰고, 바로 이동</h2>
        <p class="hero-copy">로그인 후 게시글 작성까지 한 화면 흐름으로 이어집니다.</p>
        <div class="inline-actions" style="margin-top:18px;">
          <a class="btn btn-primary" href="/signin">로그인</a>
          <a class="btn btn-secondary" href="/nid">회원가입</a>
        </div>
      </div>
    `;

  return `
    ${topbar()}
    <main class="shell">
      <div class="frame">
        <section class="hero">
          <article class="hero-card card">
            <span class="eyebrow">Single Page Board</span>
            <h1 class="hero-title">한 장의 화면에서<br><span>탐색하고 기록하는</span><br>보드 앱</h1>
            <p class="hero-copy">
              기존 여러 페이지를 오가던 흐름 대신, 홈부터 보드 목록, 글 상세, 글쓰기까지
              하나의 앱 안에서 이어지는 구조로 다시 구성했습니다.
            </p>
            <div class="inline-actions" style="margin-top:24px;">
              <a class="btn btn-primary" href="/boards">보드 둘러보기</a>
              <a class="btn btn-ghost" href="/signin">로그인</a>
            </div>
            <div class="hero-metrics">
              <div class="metric">
                <strong>${appState.boards.length}</strong>
                <span>boards indexed</span>
              </div>
              <div class="metric">
                <strong>${appState.feed.length}</strong>
                <span>recent posts visible</span>
              </div>
              <div class="metric">
                <strong>${appState.session?.loggedIn ? "ON" : "OFF"}</strong>
                <span>session state</span>
              </div>
            </div>
          </article>
          ${sessionPanel}
        </section>

        <section class="section">
          <div class="section-head">
            <div>
              <span class="eyebrow">Live Feed</span>
              <h2 class="section-title">최근 올라온 글</h2>
            </div>
            <a class="btn btn-secondary" href="/boards">전체 보드 보기</a>
          </div>
          <section class="feed-layout">
            <div class="panel">${feedMarkup}</div>
            <aside class="panel list">
              <a class="quick-card" href="/boards">
                <div class="board-title">보드 목록</div>
                <div class="muted">관심 있는 갤러리를 바로 찾습니다.</div>
              </a>
              <a class="quick-card" href="/signin">
                <div class="board-title">로그인</div>
                <div class="muted">세션 기반으로 글쓰기 권한을 받습니다.</div>
              </a>
              <a class="quick-card" href="/nid">
                <div class="board-title">회원가입</div>
                <div class="muted">아이디, 닉네임, 이메일로 바로 계정을 만듭니다.</div>
              </a>
            </aside>
          </section>
        </section>
      </div>
    </main>
  `;
}

function boardsView() {
  const query = appState.boardQuery.trim().toLowerCase();
  const boards = appState.boards.filter((board) => {
    if (!query) return true;
    return String(board.gall_id).toLowerCase().includes(query) ||
      String(board.gall_name).toLowerCase().includes(query);
  });

  const boardMarkup = boards.length
    ? boards.map((board) => `
        <a class="board-card" href="/board/${encodeURIComponent(board.gall_id)}">
          <span class="eyebrow">gallery</span>
          <div class="board-title">${escapeHtml(board.gall_name)}</div>
          <p class="muted">보드 ID ${escapeHtml(board.gall_id)}</p>
          <div class="post-stats" style="margin-top:18px;">
            <span class="chip">${escapeHtml(board.post_count ?? 0)} posts</span>
          </div>
        </a>
      `).join("")
    : `<div class="empty-box">검색 조건에 맞는 보드가 없습니다.</div>`;

  return `
    ${topbar()}
    <main class="shell">
      <div class="frame">
        <section class="section">
          <div class="section-head">
            <div>
              <span class="eyebrow">Boards</span>
              <h1 class="section-title">보드 목록</h1>
            </div>
            <a class="btn btn-secondary" href="/">홈으로</a>
          </div>
          <div class="panel">
            <input
              class="searchbar"
              id="board-search"
              type="text"
              placeholder="보드 이름 또는 ID 검색"
              value="${escapeHtml(appState.boardQuery)}"
            >
          </div>
          <section class="board-grid" style="margin-top:18px;">
            ${boardMarkup}
          </section>
        </section>
      </div>
    </main>
  `;
}

function boardView() {
  const gid = appState.route.params.gid;
  const posts = appState.boardPosts;
  const info = appState.boardDetail || { gall_id: gid, gall_name: gid };

  const postMarkup = posts.length
    ? posts.map((post) => `
        <a class="post-row" href="/board/${encodeURIComponent(gid)}/${post.post_no}">
          <div class="post-row-top muted">
            <span class="mono">#${escapeHtml(post.post_no)}</span>
            <span>${formatDate(post.created_at || post.reg_date || post.writed_at)}</span>
          </div>
          <div class="post-title">${escapeHtml(post.title || "제목 없음")}</div>
          <div class="post-row-bottom muted">
            <span>${escapeHtml(post.name || "익명")}</span>
            <span>${escapeHtml(gid)}</span>
          </div>
        </a>
      `).join("")
    : `<div class="empty-box">아직 게시글이 없습니다.</div>`;

  const writeBox = appState.session?.loggedIn
    ? `
      <aside class="panel board-side">
        <span class="eyebrow">Write</span>
        <h3 class="section-title" style="font-size:1.8rem;">새 글 작성</h3>
        <p class="muted">로그인된 계정으로 바로 이 보드에 글을 씁니다.</p>
        <a class="btn btn-primary" href="/board/${encodeURIComponent(gid)}/write">작성 화면 열기</a>
      </aside>
    `
    : `
      <aside class="panel board-side">
        <span class="eyebrow">Auth</span>
        <h3 class="section-title" style="font-size:1.8rem;">글쓰기는 로그인 후</h3>
        <p class="muted">세션이 있어야 게시글 작성 API를 사용할 수 있습니다.</p>
        <div class="inline-actions">
          <a class="btn btn-primary" href="/signin">로그인</a>
          <a class="btn btn-secondary" href="/nid">회원가입</a>
        </div>
      </aside>
    `;

  return `
    ${topbar()}
    <main class="shell">
      <div class="frame">
        <section class="section">
          <div class="section-head">
            <div>
              <span class="eyebrow">Board</span>
              <h1 class="section-title">${escapeHtml(info.gall_name || gid)}</h1>
            </div>
            <div class="board-tools">
              <span class="chip mono">${escapeHtml(gid)}</span>
              <span class="chip">${escapeHtml(info.post_count ?? posts.length)} posts</span>
            </div>
          </div>
          <section class="board-layout">
            <div class="panel board-main">
              ${postMarkup}
              <div class="pagination">
                <button class="btn btn-ghost" data-action="page-prev">이전</button>
                <span class="chip">page ${appState.boardPage}</span>
                <button class="btn btn-ghost" data-action="page-next">다음</button>
              </div>
            </div>
            ${writeBox}
          </section>
        </section>
      </div>
    </main>
  `;
}

function postView() {
  const gid = appState.route.params.gid;
  const postNo = appState.route.params.postNo;
  const post = appState.postDetail;

  if (!post) {
    return `
      ${topbar()}
      <main class="shell">
        <div class="frame">
          <div class="post-detail">
            <div class="post-card">
              <div class="error-box">게시글을 불러오지 못했습니다.</div>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  return `
    ${topbar()}
    <main class="shell">
      <div class="frame">
        <section class="post-detail">
          <article class="post-card">
            <div class="meta-row muted">
              <span class="chip mono">${escapeHtml(gid)} / ${escapeHtml(postNo)}</span>
              <span>${formatDate(post.created_at || post.reg_date || post.writed_at)}</span>
            </div>
            <h1 class="post-heading">${escapeHtml(post.title || "제목 없음")}</h1>
            <div class="post-stats muted">
              <span>${escapeHtml(post.name || "익명")}</span>
              <span>writer ${escapeHtml(post.writer_uid || "-")}</span>
            </div>
            <div class="post-body">${post.content || ""}</div>
            <div class="inline-actions" style="margin-top:24px;">
              <a class="btn btn-secondary" href="/board/${encodeURIComponent(gid)}">목록으로</a>
              <a class="btn btn-primary" href="/board/${encodeURIComponent(gid)}/write">이 보드에 글쓰기</a>
            </div>
          </article>
        </section>
      </div>
    </main>
  `;
}

function writeView() {
  const gid = appState.route.params.gid;
  const disabled = appState.session?.loggedIn ? "" : "disabled";
  const notice = appState.session?.loggedIn
    ? `<div class="success-box">현재 ${escapeHtml(appState.session.nick || appState.session.uid)} 계정으로 작성합니다.</div>`
    : `<div class="error-box">로그인 후 글을 작성할 수 있습니다.</div>`;

  return `
    ${topbar()}
    <main class="shell">
      <div class="frame">
        <section class="section">
          <div class="section-head">
            <div>
              <span class="eyebrow">Compose</span>
              <h1 class="section-title">${escapeHtml(gid)} 글쓰기</h1>
            </div>
            <a class="btn btn-secondary" href="/board/${encodeURIComponent(gid)}">보드로 돌아가기</a>
          </div>
          <section class="write-shell">
            <article class="compose-card card">
              ${notice}
              <div class="composer" style="margin-top:16px;">
                <div class="field">
                  <label for="write-title">제목</label>
                  <input id="write-title" type="text" placeholder="글 제목을 입력하세요" ${disabled}>
                </div>
                <div class="field">
                  <label for="write-content">본문</label>
                  <textarea id="write-content" placeholder="HTML도 입력할 수 있습니다." ${disabled}></textarea>
                </div>
                <div class="inline-actions">
                  <button class="btn btn-primary" data-action="submit-post" ${disabled}>게시하기</button>
                  <a class="btn btn-ghost" href="/board/${encodeURIComponent(gid)}">취소</a>
                </div>
                <div id="write-feedback"></div>
              </div>
            </article>
            <aside class="preview-card card">
              <span class="eyebrow">Preview</span>
              <h3 class="section-title" style="font-size:1.8rem;">미리보기</h3>
              <p class="muted">입력한 본문은 아래에서 즉시 확인됩니다.</p>
              <div class="preview" id="write-preview">아직 작성한 내용이 없습니다.</div>
            </aside>
          </section>
        </section>
      </div>
    </main>
  `;
}

function authView(mode) {
  const isLogin = mode === "login";
  const title = isLogin ? "로그인" : "회원가입";
  const action = isLogin ? "login-submit" : "signup-submit";

  return `
    ${topbar()}
    <main class="shell">
      <div class="frame">
        <section class="auth-wrap">
          <article class="auth-card card">
            <span class="eyebrow">${isLogin ? "Access" : "Join"}</span>
            <h1 class="section-title">${title}</h1>
            <p class="muted">새로 작성한 싱글페이지 인터페이스에서 인증 흐름도 한 화면 안에 맞췄습니다.</p>
            <div id="auth-feedback" style="margin-top:16px;"></div>
            <div class="stack" style="margin-top:16px;">
              <div class="field">
                <label for="auth-uid">${isLogin ? "아이디 또는 이메일" : "아이디"}</label>
                <input id="auth-uid" type="text" placeholder="${isLogin ? "아이디 또는 이메일" : "아이디"}">
              </div>
              ${isLogin ? "" : `
                <div class="field">
                  <label for="auth-nick">닉네임</label>
                  <input id="auth-nick" type="text" placeholder="닉네임">
                </div>
                <div class="field">
                  <label for="auth-email">이메일</label>
                  <input id="auth-email" type="email" placeholder="example@domain.com">
                </div>
              `}
              <div class="field">
                <label for="auth-pw">비밀번호</label>
                <input id="auth-pw" type="password" placeholder="비밀번호">
              </div>
              <div class="inline-actions">
                <button class="btn btn-primary" data-action="${action}">${title}</button>
                <a class="btn btn-secondary" href="${isLogin ? "/nid" : "/signin"}">${isLogin ? "회원가입" : "로그인으로"}</a>
              </div>
            </div>
          </article>
        </section>
      </div>
    </main>
  `;
}

function notFoundView() {
  return `
    ${topbar()}
    <main class="shell">
      <div class="frame">
        <section class="auth-wrap">
          <article class="auth-card card">
            <span class="eyebrow">404</span>
            <h1 class="section-title">페이지를 찾을 수 없습니다.</h1>
            <p class="muted">이 경로는 새 SPA 라우터에 등록되어 있지 않습니다.</p>
            <div class="inline-actions" style="margin-top:20px;">
              <a class="btn btn-primary" href="/">홈으로</a>
              <a class="btn btn-secondary" href="/boards">보드로</a>
            </div>
          </article>
        </section>
      </div>
    </main>
  `;
}

function render() {
  const app = getApp();
  if (!app) return;

  let html = "";
  const { name } = appState.route;

  if (name === "home") {
    setTitle("home");
    html = homeView();
  } else if (name === "boards") {
    setTitle("boards");
    html = boardsView();
  } else if (name === "board") {
    setTitle(appState.route.params.gid);
    html = boardView();
  } else if (name === "post") {
    setTitle(appState.route.params.postNo);
    html = postView();
  } else if (name === "write") {
    setTitle("write");
    html = writeView();
  } else if (name === "login") {
    setTitle("login");
    html = authView("login");
  } else if (name === "signup") {
    setTitle("signup");
    html = authView("signup");
  } else {
    setTitle("404");
    html = notFoundView();
  }

  app.innerHTML = html;
  bindEvents();
}

function bindEvents() {
  const search = document.getElementById("board-search");
  if (search) {
    search.addEventListener("input", (event) => {
      appState.boardQuery = event.target.value;
      render();
    });
  }

  const writeContent = document.getElementById("write-content");
  const preview = document.getElementById("write-preview");
  if (writeContent && preview) {
    writeContent.addEventListener("input", (event) => {
      const value = event.target.value.trim();
      preview.innerHTML = value || "아직 작성한 내용이 없습니다.";
    });
  }

  document.querySelectorAll("[data-action='logout']").forEach((button) => {
    button.addEventListener("click", async () => {
      await fetch("/logout", { method: "POST", credentials: "include" });
      appState.session = { loggedIn: false };
      navigate("/", true);
    });
  });

  const prev = document.querySelector("[data-action='page-prev']");
  if (prev) {
    prev.addEventListener("click", async () => {
      if (appState.boardPage <= 1) return;
      appState.boardPage -= 1;
      await loadBoardPosts(appState.route.params.gid, appState.boardPage);
      render();
    });
  }

  const next = document.querySelector("[data-action='page-next']");
  if (next) {
    next.addEventListener("click", async () => {
      appState.boardPage += 1;
      await loadBoardPosts(appState.route.params.gid, appState.boardPage);
      render();
    });
  }

  const loginButton = document.querySelector("[data-action='login-submit']");
  if (loginButton) {
    loginButton.addEventListener("click", submitLogin);
  }

  const signupButton = document.querySelector("[data-action='signup-submit']");
  if (signupButton) {
    signupButton.addEventListener("click", submitSignup);
  }

  const submitPostButton = document.querySelector("[data-action='submit-post']");
  if (submitPostButton) {
    submitPostButton.addEventListener("click", submitPost);
  }
}

function showBox(id, className, message) {
  const node = document.getElementById(id);
  if (!node) return;
  node.innerHTML = `<div class="${className}">${escapeHtml(message)}</div>`;
}

async function loadSession() {
  appState.session = await api("/api/check-login");
}

async function loadBoards() {
  appState.boards = await api("/api/board/list");
}

async function loadFeed() {
  appState.feed = await api("/api/posts/recommend");
}

async function loadBoardPosts(gid, page = 1) {
  appState.boardPosts = await api(`/api/board/posts/${encodeURIComponent(gid)}?page=${page}`);
  appState.boardDetail = appState.boards.find((board) => board.gall_id === gid) || {
    gall_id: gid,
    gall_name: gid,
    post_count: appState.boardPosts.length
  };
}

async function loadPost(gid, postNo) {
  const result = await api(`/api/posts/get/${encodeURIComponent(gid)}/${encodeURIComponent(postNo)}`);
  appState.postDetail = result.success ? result.post : null;
}

async function submitLogin() {
  const uid = document.getElementById("auth-uid")?.value.trim();
  const pw = document.getElementById("auth-pw")?.value || "";

  if (!uid || !pw) {
    showBox("auth-feedback", "error-box", "아이디와 비밀번호를 모두 입력해주세요.");
    return;
  }

  const result = await api("/login", {
    method: "POST",
    body: JSON.stringify({ userID: uid, password: pw })
  });

  if (!result.success) {
    showBox("auth-feedback", "error-box", result.message || "로그인에 실패했습니다.");
    return;
  }

  await loadSession();
  navigate("/", true);
}

async function submitSignup() {
  const uid = document.getElementById("auth-uid")?.value.trim();
  const nick = document.getElementById("auth-nick")?.value.trim();
  const email = document.getElementById("auth-email")?.value.trim();
  const pw = document.getElementById("auth-pw")?.value || "";

  if (!uid || !nick || pw.length < 4) {
    showBox("auth-feedback", "error-box", "아이디, 닉네임, 4자 이상 비밀번호를 입력해주세요.");
    return;
  }

  const result = await api("/api/signup", {
    method: "POST",
    body: JSON.stringify({
      userID: uid,
      username: nick,
      email,
      password: pw
    })
  });

  if (!result.success) {
    showBox("auth-feedback", "error-box", result.message || "회원가입에 실패했습니다.");
    return;
  }

  showBox("auth-feedback", "success-box", "가입이 완료되었습니다. 로그인 화면으로 이동합니다.");
  setTimeout(() => navigate("/signin"), 500);
}

async function submitPost() {
  const gid = appState.route.params.gid;
  const title = document.getElementById("write-title")?.value.trim();
  const content = document.getElementById("write-content")?.value.trim();

  if (!title || !content) {
    showBox("write-feedback", "error-box", "제목과 본문을 모두 입력해주세요.");
    return;
  }

  const result = await api("/api/posts/write", {
    method: "POST",
    body: JSON.stringify({ gid, title, content })
  });

  if (!result.success) {
    showBox("write-feedback", "error-box", result.message || "게시글 작성에 실패했습니다.");
    return;
  }

  showBox("write-feedback", "success-box", "게시글이 등록되었습니다.");
  setTimeout(() => navigate(`/board/${encodeURIComponent(gid)}`), 400);
}

async function bootRoute() {
  appState.route = matchRoute(window.location.pathname);

  try {
    if (!appState.session) {
      await loadSession();
    }

    if (!appState.boards.length) {
      await loadBoards();
    }

    if (appState.route.name === "home") {
      await loadFeed();
    }

    if (appState.route.name === "board") {
      await loadBoardPosts(appState.route.params.gid, appState.boardPage);
    }

    if (appState.route.name === "post") {
      await loadPost(appState.route.params.gid, appState.route.params.postNo);
    }
  } catch (error) {
    console.error(error);
  }

  render();
  window.scrollTo({ top: 0, behavior: "auto" });
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (!href || !href.startsWith("/") || href.startsWith("//")) return;

  event.preventDefault();

  if (href !== window.location.pathname) {
    if (href.includes("/board/") && !href.endsWith("/write") && href.split("/").filter(Boolean).length === 2) {
      appState.boardPage = 1;
    }
    navigate(href);
  }
});

window.addEventListener("popstate", () => {
  appState.boardPage = 1;
  bootRoute();
});

bootRoute();
