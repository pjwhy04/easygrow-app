/**
 * dashboard.js (ฉบับเชื่อมต่อ Node.js Server & MySQL)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard (ตรวจสอบสิทธิ์)
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(storedUser);

    // Sidebar Setup
    document.getElementById('sidebarUserName').textContent = user.name || 'ผู้ใช้งาน';
    document.getElementById('sidebarUserRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
    const avatarEl = document.getElementById('userAvatar');
    if (user.image_url) {
        avatarEl.innerHTML = `<img src="${user.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatarEl.style.backgroundColor = 'transparent'; // ลบสีพื้นหลังเดิม
    } else {
        avatarEl.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    }

    if (user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
            localStorage.removeItem('easygrowUser');
            window.location.href = 'index.html';
        }
    });

    // ============================================
    // 2. Fetch Data from Server
    // ============================================
    let plantingLog = [];

    try {
        const res = await fetch(`/api/planting-log?email=${user.email}`);
        if (res.ok) {
            plantingLog = await res.json();
        } else {
            console.error("Failed to fetch logs");
        }
    } catch (error) {
        console.error("Network error:", error);
    }

    // ============================================
    // 3. Calculate Summaries
    // ============================================
    
    // Helper: เช็คว่าอยู่ในช่วง 7 วันที่ผ่านมาหรือไม่
    const isWithinLast7Days = (dateString) => {
        if (!dateString) return false;
        const targetDate = new Date(dateString);
        const today = new Date();
        const diffTime = Math.abs(today - targetDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        return diffDays <= 7;
    };

    let readyCount = 0;
    let growingCount = 0;
    let recentPlantedCount = 0;
    let wateringCount = 0;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    plantingLog.forEach(item => {
        const statusLower = (item.status || '').toLowerCase();
        
        // นับสถานะ
        if (statusLower === 'ready') readyCount++;
        if (statusLower === 'growing') growingCount++;
        // ใช้ planted_date จาก DB
        if (statusLower === 'planted' && isWithinLast7Days(item.planted_date)) recentPlantedCount++;

        // นับการรดน้ำ
        if (statusLower !== 'harvested') {
            const lastWaterStr = item.last_watered_date || item.planted_date;
            const lastWaterDate = new Date(lastWaterStr);
            lastWaterDate.setHours(0, 0, 0, 0);

            const interval = item.watering_interval_days || 1;
            const nextWaterDate = new Date(lastWaterDate);
            nextWaterDate.setDate(lastWaterDate.getDate() + interval);

            if (todayDate >= nextWaterDate) {
                wateringCount++;
            }
        }
    });

    // Update DOM (Summary Cards)
    safeSetText('countHarvest', readyCount);
    safeSetText('countGrowing', growingCount);
    safeSetText('countPlanted', recentPlantedCount);
    
    // Update Watering Card
    safeSetText('countWater', wateringCount);
    const waterDesc = document.getElementById('descWater');
    if (waterDesc) {
        waterDesc.textContent = wateringCount > 0 
            ? `วันนี้มี ${wateringCount} ต้นที่ต้องรดน้ำ`
            : "วันนี้ยังไม่มีต้นไม้ที่ต้องรดน้ำ";
    }

    // ============================================
    // 4. Recent Activity List
    // ============================================
    const activityList = document.getElementById('recentActivityList');
    if (activityList) {
        activityList.innerHTML = ''; 

        if (plantingLog.length === 0) {
            activityList.innerHTML = '<li style="padding:20px; text-align:center; color:#888;">ยังไม่มีประวัติการปลูก</li>';
        } else {
            // เรียงลำดับจากใหม่ไปเก่า (ใช้ planted_date)
            const sortedLog = [...plantingLog].sort((a, b) => new Date(b.planted_date) - new Date(a.planted_date));
            const recentItems = sortedLog.slice(0, 5);

            recentItems.forEach(item => {
                const li = document.createElement('li');
                li.className = 'activity-item';

                let statusClass = 'status-planted';
                let statusText = 'เพิ่งปลูก';

                const sLow = (item.status || '').toLowerCase();
                if (sLow === 'growing') { statusClass = 'status-growing'; statusText = 'กำลังโต'; }
                else if (sLow === 'ready') { statusClass = 'status-ready'; statusText = 'พร้อมเก็บ'; }
                else if (sLow === 'harvested') { statusClass = 'status-harvested'; statusText = 'เก็บแล้ว'; }

                const dateObj = new Date(item.planted_date);
                const dateDisplay = isNaN(dateObj) ? '-' : dateObj.toLocaleDateString('th-TH', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });

                // ใช้ vegetable_name จาก DB
                li.innerHTML = `
                    <div class="plant-icon-box">🌱</div>
                    <div class="activity-details">
                        <span class="activity-name">${item.vegetable_name || 'ไม่ระบุชื่อพืช'}</span>
                        <span class="activity-meta">${item.location || '-'} • เริ่มปลูก ${dateDisplay}</span>
                    </div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                `;
                activityList.appendChild(li);
            });
        }
    }
});

// Helper เพื่อป้องกัน Error ถ้า element หาไม่เจอ
function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ==========================================
// 🍔 Mobile Menu Logic
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.querySelector('.sidebar');

    if (mobileBtn && sidebar && mobileOverlay) {
        // ฟังก์ชันเปิด/ปิด เมนู
        const toggleMenu = () => {
            sidebar.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
        };

        // กดปุ่มขีดสามขีด
        mobileBtn.addEventListener('click', toggleMenu);

        // กดที่ว่างๆ (Overlay) เพื่อปิดเมนู
        mobileOverlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            mobileOverlay.classList.remove('active');
        });
    }
});