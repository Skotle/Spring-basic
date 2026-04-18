const currentBoardState = {
  gid: '',
  currentPage: 1,
  loggedIn: false,
  nick: '',
  uid: ''
};

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
    console.log(posts)
    renderPosts(posts, gid);
  } catch (e) {
    postContainer.innerHTML = '<div class="empty-state">게시글을 불러오지 못했습니다.</div>';
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
