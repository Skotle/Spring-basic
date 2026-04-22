function initBoardsPage() {
  loadBoardList();
}

function initBoardMainPage() {
  const path = window.location.pathname.split('/').filter(Boolean);
  const gid = path[path.length - 1];
  const writePageLink = document.getElementById('writePageLink');
  const writePageLinkAside = document.getElementById('writePageLinkAside');

  if (writePageLink) {
    writePageLink.href = `/board/${gid}/write`;
  }

  if (writePageLinkAside) {
    writePageLinkAside.href = `/board/${gid}/write`;
  }

  initBoardPage(gid);
}

function initPostPage() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const gid = pathParts[pathParts.length - 2];
  const postNo = pathParts[pathParts.length - 1];
  const currentPostPath = document.getElementById('currentPostPath');
  const postGalleryLabel = document.getElementById('postGalleryLabel');
  const backToBoardBtn = document.getElementById('backToBoardBtn');
  const writePostBtn = document.getElementById('writePostBtn');

  if (currentPostPath) {
    currentPostPath.textContent = `${gid}/${postNo}`;
  }

  if (postGalleryLabel) {
    postGalleryLabel.textContent = `${gid.toUpperCase()} Gallery`;
  }

  if (backToBoardBtn) {
    backToBoardBtn.addEventListener('click', () => {
      if (window.navigateTo) {
        window.navigateTo(`/board/${gid}`);
      } else {
        location.href = `/board/${gid}`;
      }
    });
  }

  if (writePostBtn) {
    writePostBtn.addEventListener('click', () => {
      if (window.navigateTo) {
        window.navigateTo(`/board/${gid}`);
      } else {
        location.href = `/board/${gid}`;
      }
    });
  }

  loadPostDetail(gid, postNo);
}

function initPostWritePage() {
  const pathParts = window.location.pathname.split('/').filter(Boolean);
  const gid = pathParts[pathParts.length - 2];
  const backToBoardLink = document.getElementById('backToBoardLink');

  if (backToBoardLink) {
    backToBoardLink.href = `/board/${gid}`;
  }

  initWritePage(gid);
}
