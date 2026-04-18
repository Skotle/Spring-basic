async function loadRoles() {
        try {
            const response = await fetch('/api/admin/roles', { credentials: 'include' });
            if (!response.ok) throw new Error();

            const data = await response.json();
            const listEl = document.getElementById('roleList');

            listEl.innerHTML = data.map(role => `
                <tr>
                    <td><span class="badge">${role.role_name}</span></td>
                    <td>${role.description || '설명 없음'}</td>
                    <td>${role.user_count} 명</td>
                </tr>
            `).join('');
        } catch (e) {
            document.querySelector('.admin-table').style.display = 'none';
            document.getElementById('errorBox').style.display = 'block';
        }
    }

    window.onload = loadRoles;