function filterMobileBoards(keyword) {
  const normalized = String(keyword || "").trim().toLowerCase();
  const cards = Array.from(document.querySelectorAll(".m-board-ssr-card[data-search]"));
  const empty = document.getElementById("mobileBoardSearchEmpty");
  let visibleCount = 0;

  cards.forEach((card) => {
    const matched = !normalized || String(card.dataset.search || "").includes(normalized);
    card.hidden = !matched;
    if (matched) visibleCount += 1;
  });

  document.querySelectorAll("[data-mobile-board-section]").forEach((section) => {
    const hasVisibleCard = Array.from(section.querySelectorAll(".m-board-ssr-card[data-search]")).some((card) => !card.hidden);
    section.hidden = normalized ? !hasVisibleCard : false;
  });

  if (empty) {
    empty.hidden = !normalized || visibleCount > 0;
  }
}

function initMobileBoardsPage() {
  filterMobileBoards(document.getElementById("mobileBoardSearchInput")?.value || "");
}

document.addEventListener("DOMContentLoaded", initMobileBoardsPage);
