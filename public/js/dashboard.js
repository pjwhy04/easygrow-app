/**
 * dashboard.js (ฉบับแก้ไข: 5 สถานะ และคำนวณจำนวนจริง)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(storedUser);

    // Sidebar Setup
    document.getElementById('sidebarUserName').textContent = user.name || 'ผู้ใช้งาน';
    document.getElementById('sidebarUserRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
    const avatarEl = document.getElementById('userAvatar');
    if (user.image_url) {
        avatarEl.innerHTML = `<img src="${user.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatarEl.style.backgroundColor = 'transparent';
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
    // 2. Fetch Data
    // ============================================
    let plantingLog = [];
    try {
        const res = await fetch(`/api/planting-log?email=${user.email}`);
        if (res.ok) {
            plantingLog = await res.json();
        }
    } catch (error) {
        console.error("Network error:", error);
    }

    // ============================================
    // 3. Calculate Summaries (คำนวณแบบ 5 สถานะ)
    // ============================================
    let totalCount = plantingLog.length; // จำนวนทั้งหมดที่มีในระบบ
    let growingCount = 0;
    let readyCount = 0;
    let harvestedCount = 0;
    let wateringCount = 0;

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    plantingLog.forEach(item => {
        const statusLower = (item.status || '').toLowerCase();
        
        // นับตามสถานะจริง
        if (statusLower === 'growing') growingCount++;
        if (statusLower === 'ready') readyCount++;
        if (statusLower === 'harvested') harvestedCount++;

        // นับการรดน้ำ (เฉพาะต้นที่ยังไม่ได้เก็บเกี่ยว)
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

    // อัปเดตตัวเลขบนหน้าจอ (Mapping ID ให้ตรงกับ HTML ใหม่)
    safeSetText('countTotal', totalCount);
    safeSetText('countGrowing', growingCount);
    safeSetText('countHarvest', readyCount);
    safeSetText('countHarvested', harvestedCount);
    safeSetText('countWater', wateringCount);

    // ============================================
    // 4. Recent Activity List
    // ============================================
    const activityList = document.getElementById('recentActivityList');
    if (activityList) {
        activityList.innerHTML = ''; 
        if (plantingLog.length === 0) {
            activityList.innerHTML = '<li style="padding:20px; text-align:center; color:#888;">ยังไม่มีประวัติการปลูก</li>';
        } else {
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

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Mobile Menu Logic (เหมือนเดิม)
document.addEventListener('DOMContentLoaded', () => {
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