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
      : '<div class="empty-state">최근 글이 없습니다.</div>';

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
