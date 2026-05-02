function filterBoards(keyword) {
  const normalized = String(keyword || "").trim().toLowerCase();
  const cards = Array.from(document.querySelectorAll(".board-card[data-search]"));
  const empty = document.getElementById("boardSearchEmpty");
  let visibleCount = 0;

  cards.forEach((card) => {
    const matched = !normalized || String(card.dataset.search || "").includes(normalized);
    card.hidden = !matched;
    if (matched) visibleCount += 1;
  });

  document.querySelectorAll("[data-board-section]").forEach((section) => {
    const hasVisibleCard = Array.from(section.querySelectorAll(".board-card[data-search]")).some((card) => !card.hidden);
    section.hidden = normalized ? !hasVisibleCard : false;
  });

  if (empty) {
    empty.hidden = !normalized || visibleCount > 0;
  }
}

function initBoardsPage() {
  filterBoards(document.getElementById("boardSearchInput")?.value || "");
}

document.addEventListener("DOMContentLoaded", initBoardsPage);
