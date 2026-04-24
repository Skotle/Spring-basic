(function () {
  const state = {
    boards: [],
    filteredBoards: [],
    selectedGid: null,
    manageData: null,
    searchResults: [],
    feedback: null
  };

  const boardListEl = document.getElementById("boardList");
  const detailTitleEl = document.getElementById("detailTitle");
  const detailBodyEl = document.getElementById("detailBody");
  const boardSearchEl = document.getElementById("boardSearch");
  const reloadBtn = document.getElementById("reloadBoards");

  async function api(url, options) {
    const response = await fetch(url, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      ...options
    });

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.message || `Request failed (${response.status})`);
    }

    return data;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function setFeedback(type, message) {
    state.feedback = message ? { type, message } : null;
    renderDetail();
  }

  function isMainBoard(board) {
    return String(board?.gall_type || "").toLowerCase() === "main";
  }

  function filterBoards() {
    const q = boardSearchEl.value.trim().toLowerCase();
    state.filteredBoards = state.boards.filter((board) => {
      return !q
        || String(board.gall_id).toLowerCase().includes(q)
        || String(board.gall_name).toLowerCase().includes(q);
    });
    renderBoardList();
  }

  async function loadBoards() {
    state.boards = await api("/api/admin/boards");
    filterBoards();
  }

  async function loadManageData(gid) {
    state.selectedGid = gid;
    state.manageData = null;
    state.searchResults = [];
    renderBoardList();
    detailTitleEl.textContent = `${gid} 불러오는 중`;
    detailBodyEl.innerHTML = `<p class="hint">운영진 정보를 불러오는 중입니다.</p>`;

    const result = await api(`/api/admin/boards/${encodeURIComponent(gid)}`);
    state.manageData = result.data;
    state.feedback = null;
    renderBoardList();
    renderDetail();
  }

  async function searchUsers(query) {
    if (!query.trim()) {
      state.searchResults = [];
      renderDetail();
      return;
    }

    state.searchResults = await api(`/api/admin/users/search?q=${encodeURIComponent(query.trim())}`);
    renderDetail();
  }

  async function assignManager(targetUid) {
    if (!state.selectedGid || !targetUid) return;
    try {
      await api(`/api/admin/boards/${encodeURIComponent(state.selectedGid)}/manager`, {
        method: "POST",
        body: JSON.stringify({ targetUid })
      });
      setFeedback("ok", "매니저 임명 요청 알림을 보냈습니다.");
      await loadManageData(state.selectedGid);
    } catch (error) {
      setFeedback("error", error.message);
    }
  }

  async function appointSubmanager(targetUid) {
    if (!state.selectedGid || !targetUid) return;
    try {
      await api(`/api/admin/boards/${encodeURIComponent(state.selectedGid)}/submanagers`, {
        method: "POST",
        body: JSON.stringify({ targetUid })
      });
      setFeedback("ok", "부매니저 임명 요청 알림을 보냈습니다.");
      await loadManageData(state.selectedGid);
    } catch (error) {
      setFeedback("error", error.message);
    }
  }

  async function revokeSubmanager(targetUid) {
    if (!state.selectedGid || !targetUid) return;
    try {
      await api(`/api/admin/boards/${encodeURIComponent(state.selectedGid)}/submanagers/${encodeURIComponent(targetUid)}`, {
        method: "DELETE"
      });
      setFeedback("ok", "부매니저를 해제했습니다.");
      await loadManageData(state.selectedGid);
    } catch (error) {
      setFeedback("error", error.message);
    }
  }

  function renderBoardList() {
    if (!state.filteredBoards.length) {
      boardListEl.innerHTML = `<div class="hint">검색 결과가 없습니다.</div>`;
      return;
    }

    boardListEl.innerHTML = state.filteredBoards.map((board) => {
      const active = board.gall_id === state.selectedGid ? " active" : "";
      const managerText = board.manager_nick || board.manager_uid || "미지정";
      const manageText = isMainBoard(board)
        ? "main 보드 · 운영진 관리 제외"
        : `매니저 ${managerText} · 부매니저 ${board.submanager_count ?? 0}명`;

      return `
        <article class="board-card${active}" data-gid="${escapeHtml(board.gall_id)}">
          <strong>${escapeHtml(board.gall_name)}</strong>
          <div class="meta">${escapeHtml(board.gall_id)} · 글 ${escapeHtml(board.post_count ?? 0)}개</div>
          <div class="meta">${escapeHtml(manageText)}</div>
        </article>
      `;
    }).join("");

    boardListEl.querySelectorAll("[data-gid]").forEach((node) => {
      node.addEventListener("click", () => loadManageData(node.getAttribute("data-gid")));
    });
  }

  function renderDetail() {
    if (!state.manageData) {
      detailTitleEl.textContent = "보드를 선택하세요";
      detailBodyEl.innerHTML = `<p class="hint">왼쪽 목록에서 보드를 선택하면 현재 매니저와 부매니저를 관리할 수 있습니다.</p>`;
      return;
    }

    const board = state.manageData.board || {};
    const manager = state.manageData.manager;
    const submanagers = Array.isArray(state.manageData.submanagers) ? state.manageData.submanagers : [];
    const eligible = !!state.manageData.managedBoardEligible;
    detailTitleEl.textContent = `${board.gall_name || board.gall_id} 운영진`;

    detailBodyEl.innerHTML = `
      <div class="badge-row">
        <span class="badge">보드 ${escapeHtml(board.gall_id)}</span>
        <span class="badge">gall_type ${escapeHtml(board.gall_type || "-")}</span>
        <span class="badge">현재 매니저 ${escapeHtml(manager ? (manager.nick || manager.uid) : "미지정")}</span>
      </div>

      ${eligible ? "" : `<div class="feedback error">gall_type 이 main 인 보드는 매니저/부매니저 관리 대상이 아닙니다.</div>`}

      <div class="field">
        <label for="userSearch">사용자 검색</label>
        <input id="userSearch" type="text" placeholder="uid 또는 닉네임" ${eligible ? "" : "disabled"}>
      </div>

      <div id="searchResults" class="result-list">
        ${eligible && state.searchResults.length
          ? state.searchResults.map((user) => `
              <div class="result-item">
                <strong>${escapeHtml(user.nick || user.uid)}</strong>
                <div class="meta">${escapeHtml(user.uid)} · ${escapeHtml(user.email || "-")}</div>
                <div class="toolbar">
                  <button class="secondary" type="button" data-manager="${escapeHtml(user.uid)}">매니저 요청</button>
                  <button class="primary" type="button" data-submanager="${escapeHtml(user.uid)}">부매니저 요청</button>
                </div>
              </div>
            `).join("")
          : `<div class="hint">${eligible ? "사용자를 검색하면 여기서 바로 지정할 수 있습니다." : "main 보드는 운영진 관리가 비활성화됩니다."}</div>`}
      </div>

      <section class="stack">
        <h3>부매니저 목록</h3>
        ${submanagers.length
          ? submanagers.map((sub) => `
              <div class="sub-item">
                <div>
                  <strong>${escapeHtml(sub.nick || sub.uid)}</strong>
                  <div class="meta">${escapeHtml(sub.uid)} · 임명자 ${escapeHtml(sub.appointed_by_nick || sub.appointed_by || "-")}</div>
                </div>
                ${eligible ? `<button class="danger" type="button" data-revoke="${escapeHtml(sub.uid)}">해제</button>` : ""}
              </div>
            `).join("")
          : `<div class="hint">등록된 부매니저가 없습니다.</div>`}
      </section>

      ${state.feedback ? `<div class="feedback ${state.feedback.type}">${escapeHtml(state.feedback.message)}</div>` : ""}
    `;

    const searchEl = document.getElementById("userSearch");
    if (searchEl) {
      searchEl.addEventListener("input", (event) => {
        if (!eligible) return;
        const value = event.target.value;
        window.clearTimeout(searchEl._timer);
        searchEl._timer = window.setTimeout(() => searchUsers(value), 200);
      });
    }

    detailBodyEl.querySelectorAll("[data-manager]").forEach((node) => {
      node.addEventListener("click", () => assignManager(node.getAttribute("data-manager")));
    });

    detailBodyEl.querySelectorAll("[data-submanager]").forEach((node) => {
      node.addEventListener("click", () => appointSubmanager(node.getAttribute("data-submanager")));
    });

    detailBodyEl.querySelectorAll("[data-revoke]").forEach((node) => {
      node.addEventListener("click", () => revokeSubmanager(node.getAttribute("data-revoke")));
    });
  }

  boardSearchEl.addEventListener("input", filterBoards);
  reloadBtn.addEventListener("click", () => {
    setFeedback(null, null);
    loadBoards().catch((error) => {
      boardListEl.innerHTML = `<div class="feedback error">${escapeHtml(error.message)}</div>`;
    });
  });

  loadBoards().catch((error) => {
    boardListEl.innerHTML = `<div class="feedback error">${escapeHtml(error.message)}</div>`;
  });
})();
