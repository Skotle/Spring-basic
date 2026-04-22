const appRoot = document.getElementById('spa-root');

const viewTemplates = {
  home: () => `
    <nav>
      <a class="nav-logo" href="/">
        <span class="dot"></span>
        <span>irisen</span>
      </a>
      <div class="nav-right">
        <div class="status-badge" id="statusBadge">
          <span class="indicator"></span>
          <span id="statusLabel">checking</span>
        </div>
        <span class="status-badge nick-text" id="navNick" style="display:none"></span>
        <button class="btn btn-ghost" id="logoutBtn" style="display:none" onclick="doLogout()">로그아웃</button>
        <a class="btn btn-ghost" href="/signin" id="loginNavBtn">로그인</a>
        <a class="btn btn-primary" href="/nid" id="nidNavBtn">가입</a>
      </div>
    </nav>

    <main class="page-shell">
      <section class="home-grid">
        <article class="panel hero-panel">
          <span class="eyebrow">HOME</span>
          <div class="hero-copy">
            <h1>irisen board</h1>
            <p class="body-copy">로그인, 보드 이동, 최근 글 확인.</p>
          </div>
          <div class="hero-actions">
            <a class="btn btn-primary" href="/boards">보드 보기</a>
            <a class="btn btn-ghost" href="/signin">로그인</a>
          </div>
        </article>

        <aside class="panel session-panel">
          <div class="guest-view" id="guestView">
            <h2>guest</h2>
            <p>로그인 전용 상태입니다.</p>
            <div class="cta">
              <a class="btn btn-primary" href="/signin">로그인</a>
              <a class="btn btn-ghost" href="/nid">가입</a>
            </div>
          </div>

          <div class="user-view" id="userView" style="display:none;">
            <p class="greeting">session</p>
            <h2><strong id="userNick"></strong> <span id="userId"></span></h2>

            <div class="info-card">
              <div class="info-card-header">세션 정보</div>
              <div class="info-rows">
                <div class="info-row">
                  <span class="info-key">uid</span>
                  <span class="info-val" id="infoUid">-</span>
                </div>
                <div class="info-row">
                  <span class="info-key">nick</span>
                  <span class="info-val" id="infoNick">-</span>
                </div>
                <div class="info-row">
                  <span class="info-key">icon</span>
                  <span class="info-val" id="infoIconType">-</span>
                </div>
                <div class="info-row">
                  <span class="info-key">role</span>
                  <span class="info-val" id="infoDiv">-</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section class="section-head">
        <div>
          <span class="eyebrow">FEED</span>
          <h2 class="title-md" style="margin-top: 10px;">최근 글</h2>
        </div>
        <a class="btn btn-ghost" href="/boards">전체 보드</a>
      </section>

      <section class="feed-layout">
        <article class="panel">
          <div id="liveFeed" class="feed-list">
            <div class="empty-state">불러오는 중입니다.</div>
          </div>
        </article>

        <aside class="panel">
          <div class="quick-list">
            <a class="quick-item" href="/boards">
              <div class="quick-title">보드</div>
              <div class="quick-meta">
                <span>목록 이동</span>
                <span>GO</span>
              </div>
            </a>
            <a class="quick-item" href="/signin">
              <div class="quick-title">로그인</div>
              <div class="quick-meta">
                <span>세션 시작</span>
                <span>AUTH</span>
              </div>
            </a>
            <a class="quick-item" href="/nid">
              <div class="quick-title">가입</div>
              <div class="quick-meta">
                <span>계정 생성</span>
                <span>NEW</span>
              </div>
            </a>
          </div>
        </aside>
      </section>
    </main>
  `,

  login: () => `
    <nav>
      <a class="nav-logo" href="/">
        <span class="dot"></span>
        <span>irisen</span>
      </a>
      <div class="nav-right">
        <a class="btn btn-ghost" href="/">홈</a>
        <a class="btn btn-primary" href="/nid">가입</a>
      </div>
    </nav>

    <div class="page">
      <div class="card">
        <div class="eyebrow">LOGIN</div>
        <h1 class="title-md" style="margin-top: 14px;">로그인</h1>

        <div class="form">
          <div id="errorMsg" class="error-msg"></div>
          <div class="field">
            <label for="uid">아이디 또는 이메일</label>
            <input id="uid" type="text" placeholder="uid 입력" autocomplete="username"/>
          </div>
          <div class="field">
            <label for="pw">비밀번호</label>
            <input id="pw" type="password" placeholder="비밀번호 입력" autocomplete="current-password"/>
          </div>
          <button class="btn btn-primary" id="loginBtn" type="button" onclick="doLogin()">
            <span class="btn-label">로그인</span>
            <span class="spinner"></span>
          </button>
        </div>
      </div>
    </div>
  `,

  signup: () => `
    <nav>
      <a class="nav-logo" href="/">
        <span class="dot"></span>
        <span>irisen</span>
      </a>
      <div class="nav-right">
        <a class="btn btn-ghost" href="/">홈</a>
        <a class="btn btn-primary" href="/signin">로그인</a>
      </div>
    </nav>

    <div class="page">
      <div class="card">
        <div class="eyebrow">SIGN UP</div>
        <h1 class="title-md" style="margin-top: 14px;">가입</h1>

        <div class="form">
          <div id="errorMsg" class="error-msg"></div>
          <div class="field">
            <label for="uid">아이디</label>
            <input id="uid" type="text" placeholder="사용자 ID 입력"/>
          </div>
          <div class="field">
            <label for="nick">닉네임</label>
            <input id="nick" type="text" placeholder="닉네임 입력"/>
          </div>
          <div class="field">
            <label for="email">이메일</label>
            <input id="email" type="email" placeholder="example@domain.com"/>
          </div>
          <div class="field">
            <label for="pw">비밀번호</label>
            <input id="pw" type="password" placeholder="4자 이상 입력"/>
          </div>
          <button class="btn btn-primary" id="signupBtn" type="button" onclick="doSignup()">
            <span class="btn-label">가입</span>
            <span class="spinner"></span>
          </button>
        </div>
      </div>
    </div>
  `,

  boards: () => `
    <nav>
      <a class="nav-logo" href="/">
        <span class="dot"></span>
        <span>irisen</span>
      </a>
      <div class="nav-right">
        <a class="btn btn-ghost" href="/">홈</a>
        <a class="btn btn-primary" href="/signin">로그인</a>
      </div>
    </nav>

    <main class="page-shell section-shell">
      <section class="panel">
        <div class="eyebrow">BOARD</div>
        <h1 class="title-md" style="margin-top: 14px;">보드 목록</h1>
        <div class="search-row">
          <input id="boardSearchInput" type="text" placeholder="보드 검색" oninput="filterBoards(this.value)">
        </div>
      </section>

      <section id="boardList" class="board-grid"></section>
    </main>
  `,

  board: (gid) => `
    <nav>
      <a class="nav-logo" href="/boards">
        <span class="dot"></span>
        <span>irisen</span>
      </a>
      <div class="nav-right">
        <span id="currentGid" class="status-badge online"></span>
        <span id="currentPageLabel" class="status-badge">1 page</span>
      </div>
    </nav>

    <main class="page-shell">
      <div class="boardContainer">
        <div class="boardBox" style="width: 100%;">
          <div class="board-header">
            <span class="board-name" id="boardTitle">보드</span>
            <a class="btn btn-primary" id="writePageLink" href="/board/${gid}/write">글쓰기</a>
          </div>

          <div class="board-preview" id="postContainer"></div>

          <div class="pagination">
            <button class="btn btn-ghost" onclick="changePage(-1)">이전</button>
            <button class="btn btn-ghost" onclick="changePage(1)">다음</button>
          </div>
        </div>

        <aside class="compose-card" id="composerCard" hidden>
          <div class="board-header">
            <span class="board-name">HTML 작성</span>
            <span class="board-desc" id="composerMeta"></span>
          </div>
          <div class="utility-row" style="margin-top: 8px;">
            <a class="btn btn-primary" id="writePageLinkAside" href="/board/${gid}/write">작성 페이지 열기</a>
          </div>
        </aside>
      </div>

      <div class="panel" id="loginHint" style="margin-top: 20px;">
        <div class="board-name">로그인 후 글쓰기 가능</div>
        <div class="utility-row" style="margin-top: 12px;">
          <a class="btn btn-primary" href="/signin">로그인</a>
          <a class="btn btn-ghost" href="/nid">가입</a>
        </div>
      </div>
    </main>
  `,

  post: () => `
    <nav>
      <a class="nav-logo" href="/boards">
        <span class="dot"></span>
        <span>irisen</span>
      </a>
      <div class="nav-right">
        <span id="currentPostPath" class="status-badge"></span>
        <button class="btn btn-ghost" id="backToBoardBtn" type="button">목록</button>
      </div>
    </nav>

    <main class="page-shell">
      <section class="post-shell">
        <article class="post-card">
          <div class="board-header">
            <span class="board-name" id="postGalleryLabel">gallery</span>
            <span class="board-desc" id="postMeta">불러오는 중</span>
          </div>
          <h1 id="postTitle">게시글</h1>
          <div class="post-body" id="postBody">불러오는 중입니다.</div>
          <div class="utility-row" style="margin-top: 18px;">
            <button class="btn btn-ghost" type="button" onclick="history.back()">뒤로</button>
            <button class="btn btn-primary" type="button" id="writePostBtn">보드로</button>
          </div>
        </article>
      </section>
    </main>
  `,

  write: () => `
    <nav>
      <a class="nav-logo" href="/boards">
        <span class="dot"></span>
        <span>irisen</span>
      </a>
      <div class="nav-right">
        <span id="currentWriteGid" class="status-badge"></span>
        <a class="btn btn-ghost" id="backToBoardLink" href="/boards">보드</a>
      </div>
    </nav>

    <main class="page-shell">
      <section class="write-shell">
        <div class="write-layout">
          <article class="write-card">
            <div class="board-header">
              <span class="board-name">글쓰기</span>
              <span class="board-desc" id="writeAuthor"></span>
            </div>

            <div class="form" style="margin-top: 0;">
              <div id="writeError" class="error-msg"></div>
              <input id="writeGid" type="hidden">
              <textarea id="writeContent" hidden></textarea>

              <div class="field">
                <label for="writeTitle">제목</label>
                <input id="writeTitle" type="text" placeholder="제목">
              </div>

              <div class="field">
                <label>본문</label>
                <div class="write-toolbar">
                  <div class="toolbar-group">
                    <button class="btn btn-ghost toolbar-btn" type="button" onclick="applyEditorCommand('bold')"><strong>B</strong></button>
                    <button class="btn btn-ghost toolbar-btn" type="button" onclick="applyEditorCommand('italic')"><em>I</em></button>
                    <button class="btn btn-ghost toolbar-btn" type="button" onclick="applyEditorCommand('underline')"><u>U</u></button>
                  </div>
                  <div class="toolbar-group">
                    <button class="btn btn-ghost" type="button" onclick="applyBlockTag('H2')">제목</button>
                    <button class="btn btn-ghost" type="button" onclick="applyBlockTag('P')">본문</button>
                    <button class="btn btn-ghost" type="button" onclick="applyBlockTag('BLOCKQUOTE')">인용</button>
                  </div>
                  <div class="toolbar-group">
                    <button class="btn btn-ghost" type="button" onclick="applyEditorCommand('insertUnorderedList')">목록</button>
                    <button class="btn btn-ghost" type="button" onclick="applyEditorCommand('insertOrderedList')">번호</button>
                    <button class="btn btn-ghost" type="button" onclick="insertEditorLink()">링크</button>
                  </div>
                </div>
                <div
                  id="writeEditor"
                  class="editor-surface"
                  contenteditable="true"
                  data-placeholder="여기에 글을 입력하세요"
                  oninput="updateEditorPreview()"></div>
              </div>

              <div class="write-toolbar">
                <button class="btn btn-primary" id="writeBtn" type="button" onclick="submitHtmlPost()">
                  <span class="btn-label">등록</span>
                  <span class="spinner"></span>
                </button>
                <button class="btn btn-ghost" type="button" onclick="applyEditorCommand('removeFormat')">서식 지우기</button>
              </div>
            </div>
          </article>

          <aside class="preview-card">
            <div class="board-header">
              <span class="board-name">미리보기</span>
              <span class="board-desc">html 출력</span>
            </div>
            <p class="write-help">작성 내용은 HTML로 저장됩니다.</p>
            <div id="htmlPreview" class="preview-surface" style="margin-top: 14px;"></div>
          </aside>
        </div>
      </section>
    </main>
  `,

  notFound: () => `
    <div class="page">
      <div class="card">
        <div class="eyebrow">404</div>
        <h1 class="title-md" style="margin-top: 14px;">페이지를 찾을 수 없습니다.</h1>
        <div class="cta" style="margin-top: 24px;">
          <a class="btn btn-primary" href="/">홈으로</a>
          <a class="btn btn-ghost" href="/boards">보드로</a>
        </div>
      </div>
    </div>
  `
};

function matchRoute(pathname) {
  if (pathname === '/') return { name: 'home', args: [] };
  if (pathname === '/signin') return { name: 'login', args: [] };
  if (pathname === '/nid') return { name: 'signup', args: [] };
  if (pathname === '/boards' || pathname === '/board_main') return { name: 'boards', args: [] };

  let match = pathname.match(/^\/board\/([^/]+)\/write$/);
  if (match) return { name: 'write', args: [decodeURIComponent(match[1])] };

  match = pathname.match(/^\/board\/([^/]+)\/([^/]+)$/);
  if (match) return { name: 'post', args: [decodeURIComponent(match[1]), decodeURIComponent(match[2])] };

  match = pathname.match(/^\/board\/([^/]+)$/);
  if (match) return { name: 'board', args: [decodeURIComponent(match[1])] };

  return { name: 'notFound', args: [] };
}

function updateDocumentTitle(name, args) {
  const titleMap = {
    home: 'irisen',
    login: '로그인',
    signup: '회원가입',
    boards: '보드 목록',
    board: `${args[0]} board`,
    post: `${args[0]} / ${args[1]}`,
    write: `${args[0]} 글쓰기`,
    notFound: '404'
  };
  document.title = titleMap[name] || 'irisen';
}

function renderCurrentRoute() {
  if (!appRoot) return;

  const { name, args } = matchRoute(window.location.pathname);
  const template = viewTemplates[name];
  appRoot.innerHTML = template ? template(...args) : viewTemplates.notFound();
  updateDocumentTitle(name, args);
  window.scrollTo({ top: 0, behavior: 'instant' });

  switch (name) {
    case 'home':
      initHomePage();
      break;
    case 'boards':
      initBoardsPage();
      break;
    case 'board':
      initBoardMainPage();
      break;
    case 'post':
      initPostPage();
      break;
    case 'write':
      initPostWritePage();
      break;
    default:
      break;
  }
}

function navigateTo(path, options = {}) {
  const { replace = false } = options;
  if (replace) {
    window.history.replaceState({}, '', path);
  } else {
    window.history.pushState({}, '', path);
  }
  renderCurrentRoute();
}

window.navigateTo = navigateTo;

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;
  if (link.target === '_blank' || link.hasAttribute('download')) return;

  const href = link.getAttribute('href');
  if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return;
  if (!href.startsWith('/')) return;

  event.preventDefault();
  navigateTo(href);
});

window.addEventListener('popstate', renderCurrentRoute);
renderCurrentRoute();
