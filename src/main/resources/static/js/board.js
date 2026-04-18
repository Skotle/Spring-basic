let cachedBoards = [];
let currentBoardState = {
  gid: '',
  currentPage: 1,
  loggedIn: false,
  nick: '',
  uid: ''
};

async function fetchLoginState() {
  try {
    return await apiFetch('/api/check-login');
  } catch (error) {
    return { loggedIn: false };
  }
}

function toggleDisplay(element, shouldShow, displayValue = 'block') {
  if (!element) return;
  element.style.display = shouldShow ? displayValue : 'none';
}

function renderBoardCards(boards) {
  const listEl = document.getElementById('boardList');
  if (!listEl) return;

  if (!boards.length) {
    listEl.innerHTML = '<div class="empty-state">조건에 맞는 보드가 없습니다.</div>';
    return;
  }

  listEl.innerHTML = boards.map(board => `
    <a class="board-card" href="/board/${board.gall_id}">
      <div class="board-name"># ${board.gall_name}</div>
      <div class="board-stats">Total Posts: ${board.post_count ?? 0}</div>
      <div class="utility-row" style="margin-top: 12px;">
        <span class="status-badge">${board.gall_id}</span>
      </div>
    </a>
  `).join('');
}

async function loadBoardList() {
  const listEl = document.getElementById('boardList');
  if (!listEl) return;

  try {
    const boards = await apiFetch('/api/board/list');
    cachedBoards = boards;
    renderBoardCards(boards);
  } catch (e) {
    listEl.innerHTML = '<div class="empty-state">보드 목록을 불러오는데 실패했습니다.</div>';
  }
}

function filterBoards(keyword) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) {
    renderBoardCards(cachedBoards);
    return;
  }

  const filtered = cachedBoards.filter(board =>
    String(board.gall_id).toLowerCase().includes(normalized) ||
    String(board.gall_name).toLowerCase().includes(normalized)
  );

  renderBoardCards(filtered);
}

function renderPosts(posts, gid) {
  const postContainer = document.getElementById('postContainer');
  if (!postContainer) return;

  if (!posts.length) {
    postContainer.innerHTML = '<div class="empty-state">등록된 게시글이 없습니다.</div>';
    return;
  }

  postContainer.innerHTML = posts.map(post => `
    <a class="post-row" href="/board/${gid}/${post.post_no}">
      <div class="post-row-top">
        <span>#${post.post_no}</span>
        <span>${formatDateLabel(post.created_at || post.reg_date)}</span>
      </div>
      <div class="post-row-title">${post.title || '제목 없음'}</div>
      <div class="post-row-top">
        <span>${post.name || '익명'}</span>
        <span>${gid}</span>
      </div>
    </a>
  `).join('');
}

async function loadPosts(gid, page = 1) {
  const postContainer = document.getElementById('postContainer');
  const currentPageEl = document.getElementById('currentPageLabel');

  if (!postContainer) return;
  if (currentPageEl) currentPageEl.textContent = `${page} page`;

  try {
    const posts = await apiFetch(`/api/board/posts/${gid}?page=${page}`);
    renderPosts(posts, gid);
  } catch (e) {
    postContainer.innerHTML = '<div class="empty-state">게시글을 불러오지 못했습니다.</div>';
  }
}

async function loadPostDetail(gid, postNo) {
  const titleEl = document.getElementById('postTitle');
  const metaEl = document.getElementById('postMeta');
  const bodyEl = document.getElementById('postBody');

  if (!titleEl || !metaEl || !bodyEl) return;

  try {
    const response = await apiFetch(`/api/board/posts/${gid}/${postNo}`);

    if (!response.success || !response.post) {
      titleEl.textContent = '게시글을 찾을 수 없습니다.';
      metaEl.textContent = `${gid} gallery`;
      bodyEl.textContent = '삭제되었거나 존재하지 않는 게시글입니다.';
      return;
    }

    const post = response.post;
    titleEl.textContent = post.title || `No.${postNo}`;
    metaEl.textContent = `${post.name || '익명'} · ${gid} · No.${post.post_no} · ${formatDateLabel(post.created_at || post.reg_date)}`;
    bodyEl.textContent = post.content || '';
  } catch (e) {
    titleEl.textContent = '게시글을 불러오지 못했습니다.';
    metaEl.textContent = `${gid} gallery`;
    bodyEl.textContent = '잠시 후 다시 시도해주세요.';
  }
}

async function loadRecommendedPosts() {
  const liveFeed = document.getElementById('liveFeed');
  const recomBoard = document.getElementById('RecomBoardPreview');

  try {
    const posts = await apiFetch('/api/posts/recommend');
    const normalized = posts.slice(0, 5);

    const markup = normalized.length
      ? normalized.map(post => `
          <a class="feed-item" href="/board/${post.gall_id}/${post.post_no}">
            <div class="feed-meta">
              <span>${post.gall_id}</span>
              <span>#${post.post_no}</span>
            </div>
            <div class="feed-title">${post.title || '제목 없음'}</div>
            <div class="feed-meta">
              <span>${post.name || '익명'}</span>
              <span>${formatDateLabel(post.created_at || post.reg_date)}</span>
            </div>
          </a>
        `).join('')
      : '<div class="empty-state">실시간 게시글이 없습니다.</div>';

    if (liveFeed) liveFeed.innerHTML = markup;

    if (recomBoard) {
      recomBoard.innerHTML = normalized.length
        ? normalized.slice(0, 3).map(post => `
            <a class="preview-item" href="/board/${post.gall_id}/${post.post_no}">
              [${post.gall_id}] ${post.title || '제목 없음'}
            </a>
          `).join('')
        : '<div class="preview-item">게시글이 없습니다.</div>';
    }
  } catch (error) {
    if (liveFeed) liveFeed.innerHTML = '<div class="empty-state">최근 글을 불러오지 못했습니다.</div>';
    if (recomBoard) recomBoard.innerHTML = '<div class="preview-item">실시간 글을 불러오지 못했습니다.</div>';
  }
}

function renderState(data) {
  const badge = document.getElementById('statusBadge');
  const statusLbl = document.getElementById('statusLabel');
  const guestView = document.getElementById('guestView');
  const userView = document.getElementById('userView');
  const loginBtn = document.getElementById('loginNavBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const nidBtn = document.getElementById('nidNavBtn') || document.getElementById('signupNavBtn');
  const navNick = document.getElementById('navNick');

  if (badge && statusLbl) {
    badge.classList.toggle('online', !!data.loggedIn);
    statusLbl.textContent = data.loggedIn ? 'online' : 'offline';
  }

  if (data.loggedIn) {
    if (navNick) {
      navNick.textContent = data.nick || data.uid || 'member';
      navNick.style.display = 'inline-flex';
    }

    toggleDisplay(guestView, false);
    toggleDisplay(userView, true);
    toggleDisplay(loginBtn, false, 'inline-flex');
    toggleDisplay(nidBtn, false, 'inline-flex');
    toggleDisplay(logoutBtn, true, 'inline-flex');

    const roleRaw = data.memberDivision ?? 0;
    const isAdmin = roleRaw === 1 || roleRaw === '1' || roleRaw === 'admin';

    const userNick = document.getElementById('userNick');
    const userId = document.getElementById('userId');
    const infoUid = document.getElementById('infoUid');
    const infoNick = document.getElementById('infoNick');
    const infoIconType = document.getElementById('infoIconType');
    const infoDiv = document.getElementById('infoDiv');

    if (userNick) userNick.textContent = data.nick || '—';
    if (userId) userId.textContent = data.uid || '—';
    if (infoUid) infoUid.textContent = data.uid || '—';
    if (infoNick) infoNick.textContent = data.nick || '—';
    if (infoIconType) infoIconType.textContent = data.nickIconType || '(없음)';
    if (infoDiv) {
      infoDiv.innerHTML = `<span class="badge-div badge-${isAdmin ? 1 : 0}">${isAdmin ? 'ADMIN' : 'USER'}</span>`;
    }
  } else {
    toggleDisplay(guestView, true);
    toggleDisplay(userView, false);
    toggleDisplay(loginBtn, true, 'inline-flex');
    toggleDisplay(nidBtn, true, 'inline-flex');
    toggleDisplay(logoutBtn, false, 'inline-flex');
    if (navNick) navNick.style.display = 'none';
  }
}

async function doLogout() {
  await fetch('/logout', { method: 'POST', credentials: 'include' });
  window.location.reload();
}

async function initHomePage() {
  await loadRecommendedPosts();
  const loginState = await fetchLoginState();
  renderState(loginState);
}

async function submitPost() {
  const titleInput = document.getElementById('writeTitle');
  const contentInput = document.getElementById('writeContent');
  const submitBtn = document.getElementById('writeBtn');

  if (!titleInput || !contentInput) return;

  clearError('writeError');

  if (!titleInput.value.trim()) {
    showError('writeError', '제목을 입력해주세요.');
    titleInput.focus();
    return;
  }

  if (!contentInput.value.trim()) {
    showError('writeError', '본문을 입력해주세요.');
    contentInput.focus();
    return;
  }

  setBtnLoading(submitBtn, true);

  try {
    const result = await apiFetch('/api/board/write', {
      method: 'POST',
      body: JSON.stringify({
        gid: currentBoardState.gid,
        title: titleInput.value.trim(),
        content: contentInput.value.trim()
      })
    });

    if (!result.success) {
      showError('writeError', result.message || '게시글 작성에 실패했습니다.');
      return;
    }

    titleInput.value = '';
    contentInput.value = '';
    currentBoardState.currentPage = 1;
    await loadPosts(currentBoardState.gid, 1);
  } catch (error) {
    showError('writeError', error.message);
  } finally {
    setBtnLoading(submitBtn, false);
  }
}

function changePage(step) {
  const nextPage = currentBoardState.currentPage + step;
  if (nextPage < 1) return;

  currentBoardState.currentPage = nextPage;
  loadPosts(currentBoardState.gid, currentBoardState.currentPage);
}

async function initBoardPage(gid) {
  currentBoardState.gid = gid;
  currentBoardState.currentPage = 1;

  const gidBadge = document.getElementById('currentGid');
  const boardTitle = document.getElementById('boardTitle');
  const composerCard = document.getElementById('composerCard');
  const composerMeta = document.getElementById('composerMeta');
  const loginHint = document.getElementById('loginHint');

  if (gidBadge) gidBadge.textContent = gid;
  if (boardTitle) boardTitle.textContent = `${gid.toUpperCase()} Gallery`;

  const loginState = await fetchLoginState();
  currentBoardState.loggedIn = !!loginState.loggedIn;
  currentBoardState.nick = loginState.nick || '';
  currentBoardState.uid = loginState.uid || '';

  if (composerCard) composerCard.hidden = !loginState.loggedIn;
  if (loginHint) loginHint.style.display = loginState.loggedIn ? 'none' : 'block';
  if (composerMeta) {
    composerMeta.textContent = loginState.loggedIn
      ? `${loginState.nick || loginState.uid} 님으로 게시글을 작성합니다.`
      : '로그인 후 글쓰기 기능을 사용할 수 있습니다.';
  }

  await loadPosts(gid, 1);
}
