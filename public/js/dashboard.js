/**
 * dashboard.js
 * - จัดการหน้าแดชบอร์ด สถิติ และกิจกรรมล่าสุด
 * - ปรับปรุง Header UI และ Mobile Menu ให้เหมือน index.js
 * - ⭐ ปรับปรุง: เพิ่มระบบดึงรูปโปรไฟล์ล่าสุดจาก Server (Auto Sync)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ⭐ กำหนดพาธโลโก้เว็บสำหรับใช้เป็นรูปสำรอง ⭐
    const webLogo = '/images/logo.png'; 

    // ==========================================
    // 0. แก้ไขสีโลโก้ Sidebar (เพื่อให้เหมือนหน้าอื่น)
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
    // 2. ตั้งค่าโปรไฟล์และ Header UI
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
            userAvatarHeader.style.backgroundColor = 'transparent';
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
        }
    } catch (err) {
        console.warn("ไม่สามารถดึงข้อมูลโปรไฟล์ล่าสุดได้ ใช้ข้อมูลเดิมจากเครื่องแทน", err);
    }

    // 2.3 ปุ่มออกจากระบบ
    if (logoutBtnHeader) {
        logoutBtnHeader.onclick = (e) => {
            e.preventDefault();
            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                localStorage.removeItem('easygrowUser');
                window.location.href = 'login.html'; // Dashboard ต้องเด้งไป Login ไม่ใช่ index
            }
        };
    }

    // 2.4 Profile Dropdown Toggle
    if (profileTrigger && dropdownMenu) {
        profileTrigger.onclick = (e) => { 
            e.stopPropagation(); 
            dropdownMenu.classList.toggle('active'); 
        };
    }
    
    // คลิกที่อื่นเพื่อปิดเมนู
    window.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.classList.remove('active');
    });

    // ==========================================
    // 3. Mobile Menu Logic
    // ==========================================
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar && mobileOverlay) {
        const toggleMenu = () => { sidebar.classList.toggle('active'); mobileOverlay.classList.toggle('active'); };
        mobileBtn.onclick = toggleMenu;
        mobileOverlay.onclick = toggleMenu;
    }

    // ==========================================
    // 4. ดึงข้อมูลและคำนวณสถิติหน้า Dashboard
    // ==========================================
    let plantingLog = [];
    try {
        const res = await fetch(`/api/planting-log?email=${user.email}`);
        if (res.ok) {
            plantingLog = await res.json();
        }
    } catch (error) {
        console.error("Network error fetching logs:", error);
    }

    // คำนวณสถิติ
    let totalCount = plantingLog.length;
    let growingCount = 0;
    let readyCount = 0;
    let harvestedCount = 0;

    plantingLog.forEach(item => {
        const statusLower = (item.status || '').toLowerCase();
        if (statusLower === 'growing') growingCount++;
        else if (statusLower === 'ready') readyCount++;
        else if (statusLower === 'harvested') harvestedCount++;
    });

    // อัปเดต UI สถิติ
    safeSetText('countTotal', totalCount);
    safeSetText('countGrowing', growingCount);
    safeSetText('countHarvest', readyCount);
    safeSetText('countHarvested', harvestedCount);

    // ==========================================
    // 5. เรียกใช้ Master Logic จาก watering.js
    // ==========================================
    if (window.syncWateringStatus) {
        try {
            // false = ขอแค่ตัวเลข ไม่ต้องเด้ง Popup แจ้งเตือนหน้า Dashboard (รก)
            const wateringCount = await window.syncWateringStatus(user.email, false);
            safeSetText('countWater', wateringCount);
        } catch (err) {
            console.warn("Watering sync failed:", err);
            safeSetText('countWater', 0);
        }
    }

    // ============================================
    // 6. แสดงรายการกิจกรรมล่าสุด (Activity List)
    // ============================================
    renderRecentActivity(plantingLog);
});

// --- Helper Functions ---

function renderRecentActivity(logs) {
    const activityList = document.getElementById('recentActivityList');
    if (!activityList) return;

    activityList.innerHTML = ''; 
    if (!logs || logs.length === 0) {
        activityList.innerHTML = '<li style="padding:20px; text-align:center; color:#888;">ยังไม่มีประวัติการปลูก</li>';
        return;
    }

    // เรียงจากใหม่ไปเก่า และตัดมาแค่ 5 อัน
    const recentItems = [...logs]
        .sort((a, b) => new Date(b.planted_date) - new Date(a.planted_date))
        .slice(0, 5); 

    recentItems.forEach(item => {
        const li = document.createElement('li');
        li.className = 'activity-item';
        
        let statusClass = 'status-planted';
        let statusText = 'เพิ่งปลูก';
        const sLow = (item.status || '').toLowerCase();
        
        if (sLow === 'growing') { statusClass = 'status-growing'; statusText = 'กำลังโต'; }
        else if (sLow === 'ready') { statusClass = 'status-ready'; statusText = 'พร้อมเก็บ'; }
        else if (sLow === 'harvested') { statusClass = 'status-harvested'; statusText = 'เก็บแล้ว'; }

        // แปลงวันที่ให้สวยงาม
        const dateObj = new Date(item.planted_date);
        const dateDisplay = isNaN(dateObj.getTime()) ? '-' : dateObj.toLocaleDateString('th-TH', { 
            year: 'numeric', month: 'short', day: 'numeric' 
        });

        li.innerHTML = `
            <div class="plant-icon-box">🌱</div>
            <div class="activity-details">
                <span class="activity-name">${item.vegetable_name || 'ไม่ระบุชื่อพืช'}</span>
                <span class="activity-meta">${item.location || 'แปลงปลูก'} • เริ่มปลูก ${dateDisplay}</span>
            </div>
            <span class="status-badge ${statusClass}">${statusText}</span>
        `;
        activityList.appendChild(li);
    });
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}