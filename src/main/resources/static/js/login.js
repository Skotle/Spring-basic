async function doLogin() {
  const btn = document.getElementById('loginBtn');
  const uid = document.getElementById('uid');
  const pw = document.getElementById('pw');

  clearError('errorMsg');

  if (!uid.value.trim()) {
    showError('errorMsg', '아이디를 입력해주세요.');
    uid.focus();
    return;
  }

  if (!pw.value) {
    showError('errorMsg', '비밀번호를 입력해주세요.');
    pw.focus();
    return;
  }

  setBtnLoading(btn, true);

  try {
    const data = await apiFetch('/login', {
      method: 'POST',
      body: JSON.stringify({ userID: uid.value.trim(), password: pw.value })
    });

    if (data.success) {
      window.location.href = '/';
      return;
    }

    showError('errorMsg', data.message || '로그인에 실패했습니다.');
  } catch (e) {
    showError('errorMsg', e.message);
  } finally {
    setBtnLoading(btn, false);
  }
}
