async function fetchLoginState() {
  try {
    return await apiFetch('/api/check-login');
  } catch (error) {
    return { loggedIn: false };
  }
}

function toggleDisplay(element, shouldShow, displayValue = 'block') {
  if (!element) return;
  element.style.display = shouldShow ? displayValue : 'none';
}

function renderState(data) {
  const badge = document.getElementById('statusBadge');
  const statusLbl = document.getElementById('statusLabel');
  const guestView = document.getElementById('guestView');
  const userView = document.getElementById('userView');
  const loginBtn = document.getElementById('loginNavBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const nidBtn = document.getElementById('nidNavBtn') || document.getElementById('signupNavBtn');
  const navNick = document.getElementById('navNick');

  if (badge && statusLbl) {
    badge.classList.toggle('online', !!data.loggedIn);
    statusLbl.textContent = data.loggedIn ? 'online' : 'offline';
  }

  if (data.loggedIn) {
    if (navNick) {
      navNick.textContent = data.nick || data.uid || 'member';
      navNick.style.display = 'inline-flex';
    }

    toggleDisplay(guestView, false);
    toggleDisplay(userView, true);
    toggleDisplay(loginBtn, false, 'inline-flex');
    toggleDisplay(nidBtn, false, 'inline-flex');
    toggleDisplay(logoutBtn, true, 'inline-flex');

    const roleRaw = data.memberDivision ?? 0;
    const isAdmin = roleRaw === 1 || roleRaw === '1' || roleRaw === 'admin';

    const userNick = document.getElementById('userNick');
    const userId = document.getElementById('userId');
    const infoUid = document.getElementById('infoUid');
    const infoNick = document.getElementById('infoNick');
    const infoIconType = document.getElementById('infoIconType');
    const infoDiv = document.getElementById('infoDiv');

    if (userNick) userNick.textContent = data.nick || '—';
    if (userId) userId.textContent = data.uid || '—';
    if (infoUid) infoUid.textContent = data.uid || '—';
    if (infoNick) infoNick.textContent = data.nick || '—';
    if (infoIconType) infoIconType.textContent = data.nickIconType || '(없음)';
    if (infoDiv) {
      infoDiv.innerHTML = `<span class="badge-div badge-${isAdmin ? 1 : 0}">${isAdmin ? 'ADMIN' : 'USER'}</span>`;
    }
  } else {
    toggleDisplay(guestView, true);
    toggleDisplay(userView, false);
    toggleDisplay(loginBtn, true, 'inline-flex');
    toggleDisplay(nidBtn, true, 'inline-flex');
    toggleDisplay(logoutBtn, false, 'inline-flex');
    if (navNick) navNick.style.display = 'none';
  }
}

async function doLogout() {
  await fetch('/logout', { method: 'POST', credentials: 'include' });
  window.location.reload();
}
