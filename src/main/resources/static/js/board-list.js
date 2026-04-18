let cachedBoards = [];

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
