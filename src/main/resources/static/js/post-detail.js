async function loadPostDetail(gid, postNo) {
  const titleEl = document.getElementById('postTitle');
  const metaEl = document.getElementById('postMeta');
  const bodyEl = document.getElementById('postBody');

  if (!titleEl || !metaEl || !bodyEl) return;

  try {
    const response = await apiFetch(`/api/posts/get/${gid}/${postNo}`);

    if (!response.success || !response.post) {
      titleEl.textContent = '게시글을 찾을 수 없습니다.';
      metaEl.textContent = `${gid} gallery`;
      bodyEl.textContent = '삭제되었거나 존재하지 않는 게시글입니다.';
      return;
    }

    const post = response.post;
    titleEl.textContent = post.title || `No.${postNo}`;
    metaEl.textContent = `${post.name || '익명'} · ${gid} · No.${post.post_no} · ${formatDateLabel(post.created_at || post.reg_date)}`;
    bodyEl.innerHTML = post.content || '';
  } catch (e) {
    titleEl.textContent = '게시글을 불러오지 못했습니다.';
    metaEl.textContent = `${gid} gallery`;
    bodyEl.textContent = '잠시 후 다시 시도해주세요.';
  }
}
