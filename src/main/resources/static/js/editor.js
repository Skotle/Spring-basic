function syncEditorHtml() {
  const editor = document.getElementById('writeEditor');
  const source = document.getElementById('writeContent');

  if (!editor || !source) return '';

  const html = editor.innerHTML.trim();
  source.value = html;
  return html;
}

function updateHtmlPreview() {
  const source = document.getElementById('writeContent');
  const preview = document.getElementById('htmlPreview');

  if (!source || !preview) return;
  preview.innerHTML = source.value;
}

function updateEditorPreview() {
  syncEditorHtml();
  updateHtmlPreview();
}

function focusWriteEditor() {
  const editor = document.getElementById('writeEditor');
  if (editor) editor.focus();
}

function applyEditorCommand(command, value = null) {
  focusWriteEditor();
  document.execCommand(command, false, value);
  updateEditorPreview();
}

function applyBlockTag(tagName) {
  applyEditorCommand('formatBlock', tagName);
}

function insertEditorLink() {
  const url = window.prompt('링크 주소를 입력하세요.');
  if (!url) return;
  applyEditorCommand('createLink', url);
}

async function submitHtmlPost() {
  const gid = document.getElementById('writeGid')?.value;
  const titleInput = document.getElementById('writeTitle');
  const submitBtn = document.getElementById('writeBtn');

  if (!gid || !titleInput) return;

  clearError('writeError');

  if (!titleInput.value.trim()) {
    showError('writeError', '제목을 입력해주세요.');
    titleInput.focus();
    return;
  }

  const htmlContent = syncEditorHtml();
  if (!htmlContent || htmlContent === '<br>' || htmlContent === '<p></p>') {
    showError('writeError', '본문을 입력해주세요.');
    focusWriteEditor();
    return;
  }

  setBtnLoading(submitBtn, true);

  try {
    const result = await apiFetch('/api/posts/write', {
      method: 'POST',
      body: JSON.stringify({
        gid,
        title: titleInput.value.trim(),
        content: htmlContent
      })
    });

    if (!result.success) {
      showError('writeError', result.message || '게시글 작성에 실패했습니다.');
      return;
    }

    if (window.navigateTo) {
      window.navigateTo(`/board/${gid}`);
    } else {
      location.href = `/board/${gid}`;
    }
  } catch (error) {
    showError('writeError', error.message);
  } finally {
    setBtnLoading(submitBtn, false);
  }
}

async function initWritePage(gid) {
  const gidInput = document.getElementById('writeGid');
  const gidBadge = document.getElementById('currentWriteGid');
  const author = document.getElementById('writeAuthor');
  const submitBtn = document.getElementById('writeBtn');
  const editor = document.getElementById('writeEditor');
  const loginState = await fetchLoginState();

  if (gidInput) gidInput.value = gid;
  if (gidBadge) gidBadge.textContent = gid;

  if (!loginState.loggedIn) {
    showError('writeError', '로그인 후 글을 작성할 수 있습니다.');
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  if (author) {
    author.textContent = loginState.nick || loginState.uid;
  }

  if (editor && !editor.innerHTML.trim()) {
    editor.innerHTML = '<p></p>';
  }

  updateEditorPreview();
}
