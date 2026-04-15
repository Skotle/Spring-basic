/**
 * 공통 Fetch 래퍼 함수
 * credentials: 'include' 설정을 기본으로 하여 세션 쿠키를 자동 포함합니다.
 */
async function apiFetch(url, options = {}) {
  const defaultOptions = {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include' // 세션 기반 인증 필수 설정
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, mergedOptions);
    return await response.json();
  } catch (err) {
    console.error("API Error:", err);
    throw new Error("서버와의 연결이 원활하지 않습니다.");
  }
}

/**
 * 에러 메시지 표시 공통 함수
 */
function showError(elementId, message) {
  const box = document.getElementById(elementId);
  if (!box) return;
  box.textContent = message;
  box.classList.add('show');

  // 애니메이션 재트리거
  box.style.animation = 'none';
  box.offsetHeight;
  box.style.animation = null;
}

/**
 * 버튼 로딩 상태 제어
 */
function setBtnLoading(btnElement, isLoading) {
  if (isLoading) {
    btnElement.disabled = true;
    btnElement.classList.add('loading');
  } else {
    btnElement.disabled = false;
    btnElement.classList.remove('loading');
  }
}