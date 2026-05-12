(() => {
  const STORAGE_KEY = "irisen.recentBoards";
  const MAX_ITEMS = 10;

  const safeParse = (value) => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const readRecentBoards = () => safeParse(window.localStorage.getItem(STORAGE_KEY))
      .filter((item) => item && item.gid)
      .slice(0, MAX_ITEMS);

  const writeRecentBoards = (items) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  };

  const removeRecentBoard = (gid) => {
    const target = String(gid || "").trim();
    if (!target) return;
    writeRecentBoards(readRecentBoards().filter((item) => item.gid !== target));
    window.dispatchEvent(new CustomEvent("irisen:recent-boards-updated"));
    renderRecentBoards();
  };

  const boardFromPath = () => {
    const match = window.location.pathname.match(/^\/board\/([^/]+)/);
    if (!match) return null;
    const gid = decodeURIComponent(match[1]);
    const title =
        document.querySelector(".dc-board-title")?.textContent ||
        document.querySelector(".post-board-name")?.textContent ||
        document.querySelector("[data-board-name]")?.getAttribute("data-board-name") ||
        gid;
    return { gid, name: title.trim() || gid };
  };

  const rememberCurrentBoard = () => {
    const board = boardFromPath();
    if (!board) return;
    const current = readRecentBoards().filter((item) => item.gid !== board.gid);
    writeRecentBoards([{ ...board, visitedAt: Date.now() }, ...current]);
  };

  const renderRecentBoards = () => {
    const topbarInner = document.querySelector(".topbar-inner");
    const topbarNav = document.querySelector(".topbar-nav");
    if (!topbarInner || !topbarNav) return;

    const items = readRecentBoards();
    let strip = topbarInner.querySelector(".recent-board-strip");
    if (!items.length) {
      strip?.remove();
      return;
    }

    if (!strip) {
      strip = document.createElement("div");
      strip.className = "recent-board-strip";
      topbarNav.insertAdjacentElement("afterend", strip);
    }

    strip.replaceChildren();
    const label = document.createElement("span");
    label.className = "recent-board-label";
    label.textContent = "최근 방문";
    strip.appendChild(label);

    items.forEach((item, index) => {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "recent-board-separator";
        separator.textContent = "×";
        strip.appendChild(separator);
      }

      const link = document.createElement("a");
      link.className = "recent-board-link";
      link.href = `/board/${encodeURIComponent(item.gid)}`;
      link.textContent = item.name || item.gid;
      link.title = item.gid;
      const itemWrap = document.createElement("span");
      itemWrap.className = "recent-board-item";
      itemWrap.appendChild(link);

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "recent-board-delete";
      deleteButton.textContent = "×";
      deleteButton.title = `${item.name || item.gid} 방문기록 삭제`;
      deleteButton.setAttribute("aria-label", `${item.name || item.gid} 방문기록 삭제`);
      deleteButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        removeRecentBoard(item.gid);
      });
      itemWrap.appendChild(deleteButton);
      strip.appendChild(itemWrap);
    });
  };

  const init = () => {
    rememberCurrentBoard();
    renderRecentBoards();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
