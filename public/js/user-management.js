/**
 * user-management.js
 * จัดการข้อมูล User และ Permissions สำหรับ Admin
 * - ย้ายโปรไฟล์ไปที่ Header Dropdown มุมขวาบน พร้อมระบบรูปสำรอง (Logo Fallback)
 * - ระบบจัดการผู้ใช้งาน (CRUD) สำหรับผู้ดูแลระบบ
 * - ⭐ ปรับปรุง: เรียกใช้ Master Logic จาก watering.js สำหรับระบบแจ้งเตือนรดน้ำ ⭐
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ⭐ กำหนดพาธโลโก้เว็บสำหรับใช้เป็นรูปสำรอง ⭐
    const webLogo = '/images/logo.png'; 

    // ==========================================
    // 1. Auth & Admin Guard
    // ==========================================
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) {
        window.location.href = 'login.html'; 
        return;
    }
    const currentUser = JSON.parse(storedUser);

    // ตรวจสอบสิทธิ์ Admin
    if (currentUser.role !== 'admin') {
        alert('ไม่อนุญาตให้เข้าถึง: สำหรับผู้ดูแลระบบเท่านั้น');
        window.location.href = 'dashboard.html';
        return;
    }

    // ==========================================
    // 2. Header Profile Setup (มุมขวาบน)
    // ==========================================
    setupHeaderUI(currentUser, webLogo);

    // ==========================================
    // ⭐ 3. CENTRALIZED WATERING CHECK (Master Logic) ⭐
    // ==========================================
    // เรียกใช้ฟังก์ชันแม่จาก watering.js เพื่ออัปเดต Badge และเช็ค Pop-up เพียงจุดเดียว
    // 🔴 แก้ไข: เปลี่ยน true เป็น false เพื่อไม่ให้บังคับ Pop-up เด้งทุกครั้งที่เข้าหน้านี้
    if (window.syncWateringStatus) {
        await window.syncWateringStatus(currentUser.email, false);
    }

    // ==========================================
    // 4. Fetch & Render Users (ระบบจัดการผู้ใช้)
    // ==========================================
    const tableBody = document.getElementById('userTableBody');
    const searchInput = document.getElementById('searchUser');
    let allUsers = []; 

    async function fetchAndRenderUsers(filterText = '') {
        try {
            const res = await fetch('/api/users');
            if (!res.ok) throw new Error('Network response was not ok');
            
            allUsers = await res.json();
            renderTable(allUsers, filterText);
            updateStats(allUsers);

        } catch (error) {
            console.error('Error fetching users:', error);
            if(tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red; padding:20px;">โหลดข้อมูลไม่สำเร็จ</td></tr>';
        }
    }

    function updateStats(users) {
        const total = users.length;
        const admins = users.filter(u => u.role === 'admin').length;
        const regular = users.filter(u => u.role === 'user').length;

        const safeSet = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
        safeSet('statTotal', total);
        safeSet('statAdmins', admins);
        safeSet('statRegular', regular);
    }

    function renderTable(users, filterText) {
        if(!tableBody) return;
        tableBody.innerHTML = '';

        const filtered = users.filter(u => 
            u.name.toLowerCase().includes(filterText.toLowerCase()) || 
            u.email.toLowerCase().includes(filterText.toLowerCase())
        );

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">ไม่พบข้อมูลผู้ใช้งาน</td></tr>';
            return;
        }

        filtered.forEach(user => {
            const tr = document.createElement('tr');
            const tableImg = user.image_url ? user.image_url : webLogo;
            const isCurrentUser = user.email === currentUser.email;
            const roleSelectDisabled = isCurrentUser ? 'disabled' : '';
            const roleClass = user.role === 'admin' ? 'role-admin' : 'role-user';

            const dateObj = new Date(user.created_at);
            const joinedDate = isNaN(dateObj) ? '-' : dateObj.toLocaleDateString('th-TH', {
                year: 'numeric', month: '2-digit', day: '2-digit'
            });

            tr.innerHTML = `
                <td>
                    <div class="user-cell" style="display:flex; align-items:center; gap:10px;">
                        <img src="${tableImg}" onerror="this.src='${webLogo}'" style="width:35px; height:35px; border-radius:50%; object-fit:cover; background:#eee;">
                        <span class="user-name-text">${user.name}</span>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <select class="role-select ${roleClass}" onchange="changeUserRole(${user.id}, this.value)" ${roleSelectDisabled}
                        style="padding:5px 10px; border-radius:20px; border:1px solid #ddd; cursor:pointer; outline:none;">
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option>
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>ผู้ใช้งานทั่วไป</option>
                    </select>
                </td>
                <td>${joinedDate}</td>
                <td><span style="background:#f1f8e9; padding:2px 8px; border-radius:10px; color:#33691e; font-weight:bold;">${user.plant_count || 0}</span></td>
                <td>
                    ${!isCurrentUser ? `<button class="action-btn" onclick="deleteUser(${user.id})" title="ลบผู้ใช้" style="background:none; border:none; cursor:pointer; font-size:1.1rem;">🗑️</button>` : '<span style="color:#ccc; font-size:0.8rem;">(คุณ)</span>'}
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    fetchAndRenderUsers();

    if(searchInput) {
        searchInput.addEventListener('input', (e) => renderTable(allUsers, e.target.value));
    }

    // ==========================================
    // 5. Actions & Modal Logic
    // ==========================================
    window.changeUserRole = async function(userId, newRole) {
        try {
            const res = await fetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            if (res.ok) fetchAndRenderUsers(searchInput.value); 
            else alert('เปลี่ยนสถานะไม่สำเร็จ');
        } catch (error) { alert('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้'); }
    };

    window.deleteUser = async function(userId) {
        if(confirm('คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานรายนี้? ข้อมูลการปลูกทั้งหมดของผู้ใช้จะถูกลบออกด้วย')) {
            try {
                const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
                if (res.ok) { alert('ลบผู้ใช้งานสำเร็จ'); fetchAndRenderUsers(searchInput.value); }
                else alert('ลบไม่สำเร็จ');
            } catch (error) { alert('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้'); }
        }
    };

    // Modal Add User
    const modal = document.getElementById('userModal');
    const form = document.getElementById('addUserForm');
    const btnAdd = document.getElementById('btnAddUser');
    const btnCancel = document.getElementById('btnCancel');
    
    const closeModal = () => { if(modal) modal.style.display = 'none'; };
    if(btnAdd) btnAdd.onclick = () => { if(form) form.reset(); if(modal) modal.style.display = 'flex'; };
    if(btnCancel) btnCancel.onclick = closeModal;
    window.onclick = (e) => { if (e.target === modal) closeModal(); };

    if(form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('newUserName').value;
            const email = document.getElementById('newUserEmail').value;
            const role = document.getElementById('newUserRole').value;
            try {
                const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, role, password: 'password1234' })
                });
                if (res.ok) { alert('เพิ่มสำเร็จ! รหัสผ่าน: password1234'); closeModal(); fetchAndRenderUsers(searchInput.value); }
                else { const data = await res.json(); alert('เพิ่มไม่สำเร็จ: ' + (data.error || 'มีข้อผิดพลาด')); }
            } catch (error) { alert('เซิร์ฟเวอร์ขัดข้อง'); }
        };
    }

    // ==========================================
    // 6. UI Helpers & Mobile Menu
    // ==========================================
    function setupHeaderUI(user, logo) {
        const hName = document.getElementById('headerUserName');
        const hAvatar = document.getElementById('userAvatarHeader');
        const mName = document.getElementById('menuUserName');
        const mRole = document.getElementById('menuUserRole');
        const trigger = document.getElementById('profileTrigger');
        const menu = document.getElementById('dropdownMenu');
        const logout = document.getElementById('logoutBtnHeader');

        if (hName) hName.textContent = user.name || 'ผู้ดูแลระบบ';
        if (mName) mName.textContent = user.name || 'ผู้ใช้งาน';
        if (mRole) mRole.textContent = 'ผู้ดูแลระบบ';

        if (hAvatar) {
            const profileImg = user.image_url ? user.image_url : logo;
            hAvatar.innerHTML = `<img src="${profileImg}" onerror="this.src='${logo}'" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }

        if (trigger && menu) {
            trigger.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('active'); };
            window.addEventListener('click', () => menu.classList.remove('active'));
        }

        if (logout) {
            logout.onclick = () => {
                if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                    localStorage.removeItem('easygrowUser');
                    window.location.href = 'login.html';
                }
            };
        }
    }

    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar && mobileOverlay) {
        const toggleMenu = () => { sidebar.classList.toggle('active'); mobileOverlay.classList.toggle('active'); };
        mobileBtn.onclick = toggleMenu;
        mobileOverlay.onclick = toggleMenu;
    }
});