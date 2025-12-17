/**
 * user-management.js
 * จัดการข้อมูล User และ Permissions สำหรับ Admin
 * (ฉบับเชื่อมต่อ Database MySQL + Mobile Support)
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. Auth & Admin Guard
    // ==========================================
    const storedUser = localStorage.getItem('easygrowUser');
    
    if (!storedUser) {
        window.location.href = 'index.html'; 
        return;
    }

    const currentUser = JSON.parse(storedUser);

    // ตรวจสอบสิทธิ์ Admin (ถ้าไม่ใช่ Admin ห้ามเข้า)
    if (currentUser.role !== 'admin') {
        alert('ไม่อนุญาตให้เข้าถึง: สำหรับผู้ดูแลระบบเท่านั้น');
        window.location.href = 'dashboard.html';
        return;
    }

    // Sidebar Info Setup
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    const avatarEl = document.getElementById('userAvatar');

    if(sidebarName) sidebarName.textContent = currentUser.name;
    if(sidebarRole) sidebarRole.textContent = 'ผู้ดูแลระบบ';
    
    // Show Profile Image in Sidebar
    if (currentUser.image_url) {
        avatarEl.innerHTML = `<img src="${currentUser.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatarEl.style.backgroundColor = 'transparent';
    } else {
        avatarEl.textContent = currentUser.name.charAt(0).toUpperCase();
    }

    // Logout Logic
    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                localStorage.removeItem('easygrowUser');
                window.location.href = 'index.html';
            }
        });
    }

    // ==========================================
    // 2. Fetch & Render Users (From MySQL)
    // ==========================================
    const tableBody = document.getElementById('userTableBody');
    const searchInput = document.getElementById('searchUser');
    let allUsers = []; // เก็บข้อมูลเพื่อใช้ Filter

    async function fetchAndRenderUsers(filterText = '') {
        try {
            const res = await fetch('/api/users');
            if (!res.ok) throw new Error('Network response was not ok');
            
            allUsers = await res.json();
            renderTable(allUsers, filterText);
            updateStats(allUsers);

        } catch (error) {
            console.error('Error fetching users:', error);
            if(tableBody) tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">โหลดข้อมูลไม่สำเร็จ (ตรวจสอบ server.js)</td></tr>';
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
            
            // Avatar (Image OR Text)
            let avatarHTML = '';
            if (user.image_url) {
                avatarHTML = `<img src="${user.image_url}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">`;
            } else {
                avatarHTML = `<div class="table-avatar">${user.name.charAt(0).toUpperCase()}</div>`;
            }
            
            // Format Date
            const dateObj = new Date(user.created_at);
            const joinedDate = isNaN(dateObj) ? '-' : dateObj.toLocaleDateString('th-TH', {
                year: 'numeric', month: '2-digit', day: '2-digit'
            });

            // Prevent editing self
            const isCurrentUser = user.email === currentUser.email;
            const roleSelectDisabled = isCurrentUser ? 'disabled' : '';
            const roleClass = user.role === 'admin' ? 'role-admin' : 'role-user';

            tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        ${avatarHTML}
                        <span class="user-name-text">${user.name}</span>
                    </div>
                </td>
                <td>${user.email}</td>
                <td>
                    <select 
                        class="role-select ${roleClass}" 
                        onchange="changeUserRole(${user.id}, this.value)"
                        ${roleSelectDisabled}
                    >
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option>
                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>ผู้ใช้งานทั่วไป</option>
                    </select>
                </td>
                <td>${joinedDate}</td>
                <td><span style="background:#f1f8e9; padding:2px 8px; border-radius:10px; color:#33691e; font-weight:bold;">${user.plant_count || 0}</span></td>
                <td>
                    ${!isCurrentUser ? `<button class="action-btn" onclick="deleteUser(${user.id})" title="ลบผู้ใช้">🗑️</button>` : '<span style="color:#ccc; font-size:0.8rem;">(คุณ)</span>'}
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    // Initial Load
    fetchAndRenderUsers();

    // Search Handler
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderTable(allUsers, e.target.value);
        });
    }

    // ==========================================
    // 3. Actions (Role & Delete)
    // ==========================================
    window.changeUserRole = async function(userId, newRole) {
        try {
            const res = await fetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });

            if (res.ok) {
                // อัปเดตสีของ Select ทันที (UX)
                fetchAndRenderUsers(searchInput.value);
            } else {
                alert('เปลี่ยนสถานะไม่สำเร็จ');
            }
        } catch (error) {
            console.error(error);
            alert('Error connecting to server');
        }
    };

    window.deleteUser = async function(userId) {
        if(confirm('คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้งานรายนี้? (ข้อมูลการปลูกของเขาอาจค้างอยู่ในระบบ)')) {
            try {
                const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
                if (res.ok) {
                    alert('ลบผู้ใช้งานสำเร็จ');
                    fetchAndRenderUsers(searchInput.value);
                } else {
                    alert('ลบไม่สำเร็จ');
                }
            } catch (error) {
                console.error(error);
                alert('Error connecting to server');
            }
        }
    };

    // ==========================================
    // 4. Add User Modal
    // ==========================================
    const modal = document.getElementById('userModal');
    const form = document.getElementById('addUserForm');
    const btnAdd = document.getElementById('btnAddUser');
    const btnCancel = document.getElementById('btnCancel');
    
    const closeModal = () => { if(modal) modal.style.display = 'none'; };

    if(btnAdd) {
        btnAdd.addEventListener('click', () => {
            if(form) form.reset();
            if(modal) modal.style.display = 'flex';
        });
    }

    if(btnCancel) btnCancel.addEventListener('click', closeModal);

    // Close on outside click
    window.onclick = (e) => { if (e.target === modal) closeModal(); };

    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('newUserName').value;
            const email = document.getElementById('newUserEmail').value;
            const role = document.getElementById('newUserRole').value;

            try {
                const res = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, role, password: 'password1234' }) // Default Pass
                });

                if (res.ok) {
                    alert('เพิ่มผู้ใช้งานสำเร็จ! (รหัสผ่านเริ่มต้น: password1234)');
                    closeModal();
                    fetchAndRenderUsers(searchInput.value);
                } else {
                    const data = await res.json();
                    alert('เพิ่มไม่สำเร็จ: ' + (data.error || 'Unknown Error'));
                }
            } catch (error) {
                console.error(error);
                alert('Error connecting to server');
            }
        });
    }

    // ==========================================
    // Mobile Menu Logic
    // ==========================================
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.querySelector('.sidebar');

    if (mobileBtn && sidebar && mobileOverlay) {
        const toggleMenu = () => {
            sidebar.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
        };
        mobileBtn.addEventListener('click', toggleMenu);
        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            mobileOverlay.classList.remove('active');
        });
    }
});