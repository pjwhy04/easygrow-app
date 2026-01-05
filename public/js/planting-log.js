/**
 * planting-log.js
 * - จัดการระบบ Kanban Board (เพิ่ม/แก้ไข/ลบ/เปลี่ยนสถานะ)
 * - ปรับปรุง Header UI, Sidebar และ Auth ให้เสถียรตามมาตรฐานหน้า index.js
 * - ⭐ เพิ่มระบบ Auto-Update Profile (Sync รูปและชื่อล่าสุดจาก Server)
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Planting Log Page Loaded");
    const webLogo = '/images/logo.png'; 

    // ==========================================
    // 0. แก้ไขสีโลโก้ Sidebar (มาตรฐานเดียวกันทุกหน้า)
    // ==========================================
    const sidebarLogoText = document.querySelector('.sidebar .logo-text h2');
    if (sidebarLogoText) {
        sidebarLogoText.style.setProperty('color', '#2e7d32', 'important'); 
        sidebarLogoText.style.fontWeight = '600';
    }

    // ==========================================
    // 1. Auth Guard & User Data (ตรวจสอบสิทธิ์)
    // ==========================================
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { 
        window.location.href = 'login.html'; 
        return; 
    }

    let user = null;
    try {
        user = JSON.parse(storedUser);
    } catch (e) {
        console.error("User data corrupted");
        localStorage.removeItem('easygrowUser');
        window.location.href = 'login.html';
        return;
    }

    // ==========================================
    // 2. Setup Header UI & Profile Auto-Update
    // ==========================================
    const headerUserName = document.getElementById('headerUserName');
    const userAvatarHeader = document.getElementById('userAvatarHeader');
    const menuUserName = document.getElementById('menuUserName');
    const menuUserRole = document.getElementById('menuUserRole');
    const logoutBtnHeader = document.getElementById('logoutBtnHeader');
    
    // Dropdown Elements
    const profileTrigger = document.getElementById('profileTrigger');
    const dropdownMenu = document.getElementById('dropdownMenu');

    // --- ฟังก์ชันอัปเดต UI ส่วนหัว (แยกออกมาเพื่อให้เรียกซ้ำได้เมื่อข้อมูลอัปเดต) ---
    function updateHeaderUI(userData) {
        if (headerUserName) headerUserName.textContent = userData.name || 'ผู้ใช้งาน';
        if (menuUserName) menuUserName.textContent = userData.name || 'ผู้ใช้งาน';
        if (menuUserRole) menuUserRole.textContent = userData.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';

        if (userAvatarHeader) {
            const profileImg = userData.image_url ? userData.image_url : webLogo;
            userAvatarHeader.innerHTML = `
                <img src="${profileImg}" 
                     onerror="this.src='${webLogo}'" 
                     style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }

        // ซ่อนเมนู Admin ถ้าไม่ใช่ Admin
        if (userData.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.setProperty('display', 'none', 'important'));
        }
    }

    // 2.1 แสดงผลครั้งแรกทันทีจาก LocalStorage (เพื่อให้ผู้ใช้ไม่ต้องรอ)
    updateHeaderUI(user);

    // 2.2 ⭐ ดึงข้อมูลล่าสุดจาก Server (Sync) เพื่อให้รูป/ชื่อ เป็นปัจจุบันเสมอ ⭐
    try {
        const resProfile = await fetch(`/api/profile?email=${user.email}`);
        if (resProfile.ok) {
            const data = await resProfile.json();
            const latestUser = data.user;

            // อัปเดตหน้าจอด้วยข้อมูลใหม่
            updateHeaderUI(latestUser);

            // อัปเดต LocalStorage ด้วย (หน้าอื่นจะได้ข้อมูลใหม่ด้วย)
            const updatedStorage = { ...user, ...latestUser };
            localStorage.setItem('easygrowUser', JSON.stringify(updatedStorage));
            user = updatedStorage; // อัปเดตตัวแปร user ในหน่วยความจำปัจจุบัน
        }
    } catch (err) {
        console.warn("ไม่สามารถดึงข้อมูลโปรไฟล์ล่าสุดได้ ใช้ข้อมูลเดิมจากเครื่องแทน", err);
    }

    // 2.3 ตั้งค่า Event Listeners (Dropdown & Logout)
    if (logoutBtnHeader) {
        logoutBtnHeader.onclick = (e) => {
            e.preventDefault();
            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                localStorage.removeItem('easygrowUser');
                window.location.href = 'login.html';
            }
        };
    }

    if (profileTrigger && dropdownMenu) {
        profileTrigger.onclick = (e) => { 
            e.stopPropagation(); 
            dropdownMenu.classList.toggle('active'); 
        };
    }
    window.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.classList.remove('active');
    });

    // Setup Mobile Menu
    setupMobileMenu();

    // ==========================================
    // 3. Kanban Data & Rendering
    // ==========================================
    let vegetables = [];
    let plantingLogs = [];

    async function loadInitialData() {
        try {
            const vRes = await fetch('/api/vegetables');
            if (vRes.ok) {
                vegetables = await vRes.json();
                const select = document.getElementById('vegSelect');
                if (select) {
                    select.innerHTML = '<option value="">-- กรุณาเลือกผัก --</option>';
                    vegetables.forEach(v => {
                        const opt = document.createElement('option');
                        opt.value = v.id;
                        opt.textContent = v.name;
                        select.appendChild(opt);
                    });
                }
            }
            // โหลดข้อมูลบอร์ดหลังได้ข้อมูลผักแล้ว
            renderBoard();
        } catch (e) { 
            console.error("Error loading initial data:", e); 
        }
    }

    async function renderBoard() {
        try {
            const lRes = await fetch(`/api/planting-log?email=${user.email}`);
            if (lRes.ok) {
                plantingLogs = await lRes.json();

                // ⭐ Sync Watering Status (Master Logic) ⭐
                // false = อัปเดตตัวเลขแต่ไม่ต้องเด้ง Pop-up หน้า Kanban เพื่อไม่ให้รบกวนการใช้งาน
                if (window.syncWateringStatus) {
                    await window.syncWateringStatus(user.email, false).catch(e => console.warn(e));
                }

                const columns = {
                    'Planted': document.getElementById('col-planted'),
                    'Growing': document.getElementById('col-growing'),
                    'Ready': document.getElementById('col-ready'),
                    'Harvested': document.getElementById('col-harvested')
                };

                // เคลียร์ข้อมูลเก่า
                Object.values(columns).forEach(c => { if(c) c.innerHTML = ''; });
                
                const stats = { 'Planted': 0, 'Growing': 0, 'Ready': 0, 'Harvested': 0 };

                plantingLogs.forEach(item => {
                    const status = item.status || 'Planted';
                    if (stats[status] !== undefined) stats[status]++;

                    const veg = vegetables.find(v => v.id == item.vegetable_id);
                    const card = document.createElement('div');
                    card.className = 'plant-card';
                    
                    // สร้างการ์ด
                    card.innerHTML = `
                        <div class="card-actions">
                            <button class="action-btn-circle btn-edit-card" onclick="editEntry(${item.id})" title="แก้ไข">✏️</button>
                            <button class="action-btn-circle btn-delete-card" onclick="deleteEntry(${item.id})" title="ลบ">🗑️</button>
                        </div>
                        <div class="card-header">
                            <div class="card-icon">🌱</div>
                            <div class="card-title-group">
                                <h3 class="card-title">${item.vegetable_name}</h3>
                                <span class="card-subtitle">ระยะเวลา: ${veg ? veg.harvest_time : '-'} วัน(หลังปลูก)</span>
                            </div>
                        </div>
                        <div class="card-body" style="font-size: 0.85rem; color: #555; margin-bottom: 15px;">
                            <div class="card-row" style="margin-bottom: 4px;">📅 <strong>เริ่มปลูก:</strong> ${formatDate(item.planted_date)}</div>
                            <div class="card-row" style="margin-bottom: 4px;">⏳ <strong>คาดว่าเก็บได้:</strong> ${formatDate(item.expected_date)}</div>
                            <div class="card-row">📍 <strong>สถานที่ปลูก:</strong> ${item.location || '-'}</div>
                        </div>
                        <select class="status-select" onchange="updateStatus(${item.id}, this.value)">
                            <option value="Planted" ${status === 'Planted' ? 'selected' : ''}>🌱 เพิ่งปลูก</option>
                            <option value="Growing" ${status === 'Growing' ? 'selected' : ''}>📈 กำลังโต</option>
                            <option value="Ready" ${status === 'Ready' ? 'selected' : ''}>🧺 พร้อมเก็บ</option>
                            <option value="Harvested" ${status === 'Harvested' ? 'selected' : ''}>✅ เก็บแล้ว</option>
                        </select>`;
                    
                    if (columns[status]) columns[status].appendChild(card);
                });

                updateUIStats(stats, plantingLogs.length);
            }
        } catch (e) { 
            console.error("Error rendering board:", e); 
        }
    }

    // ==========================================
    // 4. Modal & CRUD Handling
    // ==========================================
    const modal = document.getElementById('entryModal');
    const form = document.getElementById('addEntryForm');
    const openBtn = document.getElementById('openModalBtn');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');

    if (openBtn) {
        openBtn.addEventListener('click', () => {
            document.getElementById('editEntryId').value = '';
            if (form) form.reset();
            // ตั้งค่าวันที่ปัจจุบันเป็นค่าเริ่มต้น
            const today = new Date().toISOString().split('T')[0];
            const dateInput = document.getElementById('plantedDate');
            if (dateInput) dateInput.value = today;
            
            if (modal) modal.style.display = 'flex';
        });
    }

    const closeFn = () => { if(modal) modal.style.display = 'none'; };
    if (closeBtn) closeBtn.addEventListener('click', closeFn);
    if (cancelBtn) cancelBtn.addEventListener('click', closeFn);
    window.onclick = (e) => { if (e.target === modal) closeFn(); };

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const editId = document.getElementById('editEntryId').value;
            const vegId = document.getElementById('vegSelect').value;
            const vegInfo = vegetables.find(v => v.id == vegId);

            // คำนวณวันเก็บเกี่ยวอัตโนมัติ
            const pDateVal = document.getElementById('plantedDate').value;
            const pDate = new Date(pDateVal);
            const harvestDays = vegInfo ? parseInt(vegInfo.harvest_time) || 60 : 60;
            const eDate = new Date(pDate);
            eDate.setDate(pDate.getDate() + harvestDays);

            const payload = {
                ownerEmail: user.email,
                vegetableId: vegId,
                vegetableName: vegInfo ? vegInfo.name : '',
                plantedDate: pDateVal,
                expectedDate: eDate.toISOString().split('T')[0],
                location: document.getElementById('location').value,
                notes: document.getElementById('notes').value,
                status: 'Planted' // ค่าเริ่มต้น
            };

            const url = editId ? `/api/planting-log/${editId}/details` : '/api/planting-log';
            const method = editId ? 'PUT' : 'POST';

            try {
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) { 
                    closeFn(); 
                    renderBoard(); 
                } else {
                    alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
                }
            } catch (err) {
                console.error(err);
                alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
            }
        });
    }

    // ==========================================
    // 5. Global Actions (Window Functions)
    // ==========================================
    window.updateStatus = async (id, status) => {
        try {
            await fetch(`/api/planting-log/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            renderBoard();
        } catch (err) { console.error(err); }
    };

    window.deleteEntry = async (id) => {
        if (confirm('ยืนยันการลบรายการปลูกนี้ใช่ไหม?')) {
            try {
                await fetch(`/api/planting-log/${id}`, { method: 'DELETE' });
                renderBoard();
            } catch (err) { console.error(err); }
        }
    };

    window.editEntry = (id) => {
        const item = plantingLogs.find(l => l.id === id);
        if (!item) return;
        
        document.getElementById('editEntryId').value = item.id;
        document.getElementById('vegSelect').value = item.vegetable_id;
        document.getElementById('plantedDate').value = item.planted_date.split('T')[0];
        document.getElementById('location').value = item.location;
        document.getElementById('notes').value = item.notes;
        
        if (modal) modal.style.display = 'flex';
    };

    // --- Helper Functions ---

    function formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('th-TH');
    }

    function updateUIStats(stats, total) {
        setText('count-planted', stats['Planted']);
        setText('count-growing', stats['Growing']);
        setText('count-ready', stats['Ready']);
        setText('count-harvested', stats['Harvested']);

        setText('summary-total', total);
        setText('summary-growing', stats['Growing']);
        setText('summary-ready', stats['Ready']);
        setText('summary-harvested', stats['Harvested']);
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setupMobileMenu() {
        const mobileBtn = document.getElementById('mobileMenuBtn');
        const mobileOverlay = document.getElementById('mobileOverlay');
        const sidebar = document.querySelector('.sidebar');
        if (mobileBtn && sidebar && mobileOverlay) {
            const toggle = () => { sidebar.classList.toggle('active'); mobileOverlay.classList.toggle('active'); };
            mobileBtn.onclick = toggle;
            mobileOverlay.onclick = toggle;
        }
    }

    // เริ่มโหลดข้อมูล
    loadInitialData();
});