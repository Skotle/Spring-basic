async function doLogin() {
    const btn = document.getElementById('loginBtn');
    const uid = document.getElementById('uid');
    const pw = document.getElementById('pw');

    if (!uid.value.trim()) { showError('errorMsg', '아이디를 입력해주세요.'); uid.focus(); return; }
    if (!pw.value) { showError('errorMsg', '비밀번호를 입력해주세요.'); pw.focus(); return; }

    setBtnLoading(btn, true);

    try {
      const data = await apiFetch('/login', {
        method: 'POST',
        body: JSON.stringify({ userID: uid.value.trim(), password: pw.value })
      });

      if (data.success) {
        window.location.href = '/';
      } else {
        showError('errorMsg', data.message || '로그인 실패');
      }
    } catch (e) {
      showError('errorMsg', e.message);
    } finally {
      setBtnLoading(btn, false);
    }
  }