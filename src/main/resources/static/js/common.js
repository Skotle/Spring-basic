async function apiFetch(url, options = {}) {
  const defaultOptions = {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const response = await fetch(url, mergedOptions);
    return await response.json();
  } catch (err) {
    console.error('API Error:', err);
    throw new Error('서버와 연결하지 못했습니다.');
  }
}

function showError(elementId, message) {
  const box = document.getElementById(elementId);
  if (!box) return;
  box.textContent = message;
  box.classList.add('show');
}

function clearError(elementId) {
  const box = document.getElementById(elementId);
  if (!box) return;
  box.textContent = '';
  box.classList.remove('show');
}

function setBtnLoading(btnElement, isLoading) {
  if (!btnElement) return;
  btnElement.disabled = isLoading;
  btnElement.classList.toggle('loading', isLoading);
}

function formatDateLabel(value) {
  if (!value) return '시간 정보 없음';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
