// login.js - 메인 로그인 처리 (입력 + 요청 + 응답 통합)


async function doLogin() {
  const btn = document.getElementById('loginBtn');

  // 1. 입력 검증
  if (!validateLoginInput()) {
    return;
  }

  // 2. 버튼 로딩 상태로 변경
  setBtnLoading(btn, true);
  clearError('errorMsg');   // 이전 에러 메시지 제거

  try {
    // 3. API 요청
    const uid = document.getElementById('uid').value;
    const pw = document.getElementById('pw').value;

    const data = await loginRequest(uid, pw);

    // 4. 응답 처리
    if (data.success) {
      window.location.href = '/';        // 로그인 성공 시 메인 페이지로 이동
    } else {
      showError('errorMsg', data.message || '로그인에 실패했습니다.');
    }
  } catch (e) {
    showError('errorMsg', e.message || '서버와의 통신 중 오류가 발생했습니다.');
  } finally {
    setBtnLoading(btn, false);
  }
}

// 이벤트 리스너 등록 (사용 예시)
document.getElementById('loginBtn').addEventListener('click', doLogin);

// Enter 키 지원
document.getElementById('pw').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    doLogin();
  }
});