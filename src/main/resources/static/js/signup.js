async function doSignup() {
  const btn = document.getElementById('signupBtn');
  const uid = document.getElementById('uid');
  const nick = document.getElementById('nick');
  const email = document.getElementById('email');
  const pw = document.getElementById('pw');

  clearError('errorMsg');

  if (!uid.value.trim()) {
    showError('errorMsg', '아이디를 입력해주세요.');
    uid.focus();
    return;
  }

  if (!nick.value.trim()) {
    showError('errorMsg', '닉네임을 입력해주세요.');
    nick.focus();
    return;
  }

  if (email.value.trim() && !email.value.includes('@')) {
    showError('errorMsg', '올바른 이메일 형식을 입력해주세요.');
    email.focus();
    return;
  }

  if (pw.value.length < 4) {
    showError('errorMsg', '비밀번호는 4자 이상이어야 합니다.');
    pw.focus();
    return;
  }

  setBtnLoading(btn, true);

  try {
    const data = await apiFetch('/api/signup', {
      method: 'POST',
      body: JSON.stringify({
        userID: uid.value.trim(),
        username: nick.value.trim(),
        email: email.value.trim(),
        password: pw.value
      })
    });

    if (data.success) {
      alert('가입이 완료되었습니다. 로그인해주세요.');
      if (window.navigateTo) {
        window.navigateTo('/signin');
      } else {
        window.location.href = '/signin';
      }
      return;
    }

    showError('errorMsg', data.message || '가입에 실패했습니다.');
  } catch (e) {
    showError('errorMsg', e.message);
  } finally {
    setBtnLoading(btn, false);
  }
}
