// 보드(갤러리) 목록을 가져와서 화면에 렌더링
async function loadBoardList() {
    const listEl = document.getElementById('boardList');
    if (!listEl) return;

    try {
        const boards = await apiFetch('/api/board/list');
        listEl.innerHTML = boards.map(board => `
            <div class="board-card" onclick="location.href='/board/${board.gall_id}'">
                <div class="board-name"># ${board.gall_name}</div>
                <div class="board-stats">Total Posts: ${board.post_count}</div>
            </div>
        `).join('');
    } catch (e) {
        listEl.innerHTML = `<p class="error-msg show">보드 목록을 불러오는데 실패했습니다.</p>`;
    }
}

// 특정 보드의 게시글 목록을 가져와서 렌더링 (페이징 포함)
async function loadPosts(gid, page = 1) {
    const postContainer = document.getElementById('postContainer');
    if (!postContainer) return;

    try {
        const posts = await apiFetch(`/api/board/posts/${gid}?page=${page}`);
        if (posts.length === 0) {
            postContainer.innerHTML = '<div class="preview-item">등록된 게시글이 없습니다.</div>';
            return;
        }

        postContainer.innerHTML = posts.map(post => `
            <div class="preview-item" onclick="location.href='/board/${gid}/${post.post_no}'">
                <span class="p-no">#${post.post_no}</span>
                <span class="p-title">${post.title}</span>
                <span class="p-writer">${post.name}</span>
            </div>
        `).join('');
    } catch (e) {
        postContainer.innerHTML = `<p class="error-msg show">게시글을 불러오지 못했습니다.</p>`;
    }
}