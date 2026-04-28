(function () {
  const state = {
    tab: "inbox",
    inbox: [],
    sent: [],
    feedback: null
  };

  const listEl = document.getElementById("requestList");
  const feedbackEl = document.getElementById("requestFeedback");
  const inboxTabEl = document.getElementById("tabInbox");
  const sentTabEl = document.getElementById("tabSent");
  const reloadBtn = document.getElementById("reloadRequests");
  const sendStaffBtn = document.getElementById("sendStaffRequest");
  const sendSideBtn = document.getElementById("sendSideRequest");

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
      throw new Error(data?.message || `요청 실패 (${response.status})`);
    }
    if (data && data.success === false) {
      throw new Error(data.message || "요청 처리에 실패했습니다.");
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

  function formatDate(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function kindLabel(value) {
    if (value === "manager") return "매니저";
    if (value === "submanager") return "부매니저";
    if (value === "side_board") return "사이드 보드";
    return "요청";
  }

  function statusLabel(value) {
    if (value === "pending") return "대기";
    if (value === "accepted" || value === "approved") return "수락";
    if (value === "rejected") return "거절";
    if (value === "processed") return "처리됨";
    return value || "-";
  }

  function requestTitle(item) {
    const kind = kindLabel(item.request_kind);
    const boardName = item.gall_name || item.gall_id || item.ref_id || "-";
    if (item.direction === "sent") {
      const target = item.target_uid || item.reviewed_by || "관리자";
      return `${kind} 요청 발신: ${boardName} -> ${target}`;
    }
    const requester = item.requester_nick || item.requester_uid || "요청자";
    return `${kind} 요청 수신: ${boardName} / ${requester}`;
  }

  function requestMeta(item) {
    const parts = [];
    if (item.gall_id || item.ref_id) parts.push(`보드 ${item.gall_id || item.ref_id}`);
    if (item.requester_uid) parts.push(`요청자 ${item.requester_nick || item.requester_uid}`);
    if (item.target_uid) parts.push(`대상 ${item.target_uid}`);
    if (item.reviewed_by) parts.push(`처리자 ${item.reviewed_by_nick || item.reviewed_by}`);
    parts.push(formatDate(item.created_at));
    return parts.filter(Boolean).join(" · ");
  }

  function setFeedback(type, message) {
    state.feedback = message ? { type, message } : null;
    render();
  }

  async function loadRequests() {
    const result = await api("/api/admin/requests");
    state.inbox = Array.isArray(result?.data?.inbox) ? result.data.inbox : [];
    state.sent = Array.isArray(result?.data?.sent) ? result.data.sent : [];
    render();
  }

  async function acceptRequest(alarmId) {
    await api(`/api/admin/requests/${encodeURIComponent(alarmId)}/accept`, { method: "POST" });
    setFeedback("ok", "요청을 수락했습니다.");
    await loadRequests();
  }

  async function rejectRequest(alarmId) {
    await api(`/api/admin/requests/${encodeURIComponent(alarmId)}/reject`, { method: "POST" });
    setFeedback("ok", "요청을 거절했습니다.");
    await loadRequests();
  }

  async function sendStaffRequest() {
    const gallId = document.getElementById("staffGallId").value.trim();
    const targetUid = document.getElementById("staffTargetUid").value.trim();
    const role = document.getElementById("staffRole").value;

    if (!gallId || !targetUid) {
      setFeedback("error", "보드 ID와 대상 UID를 입력해주세요.");
      return;
    }

    await api("/api/admin/requests/staff", {
      method: "POST",
      body: JSON.stringify({ gallId, targetUid, role })
    });
    setFeedback("ok", "운영진 요청을 보냈습니다.");
    await loadRequests();
  }

  async function sendSideBoardRequest() {
    const gallId = document.getElementById("sideGallId").value.trim();
    const gallName = document.getElementById("sideGallName").value.trim();
    const reason = document.getElementById("sideReason").value.trim();

    if (!gallId || !gallName || !reason) {
      setFeedback("error", "사이드 보드 ID, 이름, 요청 사유를 모두 입력해주세요.");
      return;
    }

    await api("/api/admin/requests/side-board", {
      method: "POST",
      body: JSON.stringify({ gallId, gallName, reason })
    });
    setFeedback("ok", "사이드 보드 요청을 보냈습니다.");
    await loadRequests();
  }

  function renderFeedback() {
    feedbackEl.innerHTML = state.feedback
      ? `<div class="feedback ${escapeHtml(state.feedback.type)}">${escapeHtml(state.feedback.message)}</div>`
      : "";
  }

  function renderTabs() {
    inboxTabEl.classList.toggle("active", state.tab === "inbox");
    sentTabEl.classList.toggle("active", state.tab === "sent");
    inboxTabEl.textContent = `받은 요청 ${state.inbox.filter((item) => item.status === "pending").length}`;
    sentTabEl.textContent = `보낸 요청 ${state.sent.length}`;
  }

  function renderList() {
    const items = state.tab === "inbox" ? state.inbox : state.sent;
    if (!items.length) {
      listEl.innerHTML = `<div class="empty">${state.tab === "inbox" ? "받은 요청이 없습니다." : "보낸 요청이 없습니다."}</div>`;
      return;
    }

    listEl.innerHTML = items.map((item) => {
      const status = item.status || "processed";
      const actionable = state.tab === "inbox" && item.actionable && status === "pending";
      return `
        <article class="request-card ${escapeHtml(status)}">
          <div class="request-head">
            <div>
              <span class="badge">${escapeHtml(kindLabel(item.request_kind))}</span>
              <h2>${escapeHtml(requestTitle(item))}</h2>
            </div>
            <span class="badge ${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
          </div>
          <div class="meta">${escapeHtml(requestMeta(item))}</div>
          ${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}
          ${item.content && !item.reason ? `<p class="hint">${escapeHtml(item.content)}</p>` : ""}
          ${actionable ? `
            <div class="toolbar">
              <button class="primary" type="button" data-accept="${escapeHtml(item.alarm_id)}">수락</button>
              <button class="danger" type="button" data-reject="${escapeHtml(item.alarm_id)}">거절</button>
            </div>
          ` : ""}
        </article>
      `;
    }).join("");

    listEl.querySelectorAll("[data-accept]").forEach((node) => {
      node.addEventListener("click", () => {
        acceptRequest(node.getAttribute("data-accept")).catch((error) => setFeedback("error", error.message));
      });
    });
    listEl.querySelectorAll("[data-reject]").forEach((node) => {
      node.addEventListener("click", () => {
        rejectRequest(node.getAttribute("data-reject")).catch((error) => setFeedback("error", error.message));
      });
    });
  }

  function render() {
    renderFeedback();
    renderTabs();
    renderList();
  }

  inboxTabEl.addEventListener("click", () => {
    state.tab = "inbox";
    render();
  });
  sentTabEl.addEventListener("click", () => {
    state.tab = "sent";
    render();
  });
  reloadBtn.addEventListener("click", () => {
    loadRequests().catch((error) => setFeedback("error", error.message));
  });
  sendStaffBtn.addEventListener("click", () => {
    sendStaffRequest().catch((error) => setFeedback("error", error.message));
  });
  sendSideBtn.addEventListener("click", () => {
    sendSideBoardRequest().catch((error) => setFeedback("error", error.message));
  });

  loadRequests().catch((error) => setFeedback("error", error.message));
})();
