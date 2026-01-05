/**
 * watering.js - Master Logic & Watering Page Controller
 * - ฉบับอัปเกรด: รองรับ Array ["เช้า","กลางวัน","เย็น"]
 * - แก้ปัญหา: ข้ามวันรีเซ็ตใหม่ / เปลี่ยนช่วงเวลาแจ้งเตือนซ้ำ
 * - ⭐ ปรับปรุง: เพิ่มระบบ Auto-Update Profile ดึงข้อมูลล่าสุดจาก Server
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ==========================================
    // 1. ตรวจสอบสิทธิ์ (Auth Guard)
    // ==========================================
    const storedUser = localStorage.getItem('easygrowUser');
    
    if (!storedUser) { 
        if (window.location.pathname.includes('watering.html')) {
            window.location.href = 'login.html';
            return;
        }
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

    const webLogo = '/images/logo.png';
    const isWateringPage = window.location.pathname.includes('watering.html');

    // ==========================================
    // 2. Logic เฉพาะหน้า watering.html (Controller Mode)
    // ==========================================
    if (isWateringPage) {
        console.log("🚀 Watering Page Loaded (Multi-Slot Support)");

        // 2.1 แก้ไขสีโลโก้ Sidebar
        const sidebarLogoText = document.querySelector('.sidebar .logo-text h2');
        if (sidebarLogoText) {
            sidebarLogoText.style.setProperty('color', '#2e7d32', 'important'); 
            sidebarLogoText.style.fontWeight = '600';
        }

        // 2.2 Setup UI (แสดงผลครั้งแรกจาก LocalStorage ไปก่อนเพื่อความเร็ว)
        setupHeaderUI(user, webLogo);
        setupMobileMenu();

        // ⭐ 2.3 NEW: Auto-Update Profile (Sync with Server) ⭐
        // ดึงข้อมูลล่าสุดจาก Server มาทับ เพื่อให้รูปและชื่อเป็นปัจจุบันเสมอ
        try {
            const resProfile = await fetch(`/api/profile?email=${user.email}`);
            if (resProfile.ok) {
                const data = await resProfile.json();
                const latestUser = data.user;

                // อัปเดตข้อมูลใน RAM และ LocalStorage
                user = { ...user, ...latestUser };
                localStorage.setItem('easygrowUser', JSON.stringify(user));

                // รีเฟรช Header UI อีกรอบด้วยข้อมูลใหม่
                setupHeaderUI(user, webLogo);
                console.log("✅ Profile Updated from Server");
            }
        } catch (err) {
            console.warn("Profile sync failed, using cached data:", err);
        }

        // 2.4 Render การ์ดรดน้ำ (ใช้ Logic ใหม่)
        renderWateringCards(user);
    }

    // ==========================================
    // 3. รันระบบคำนวณและแจ้งเตือน (Global Sync)
    // ==========================================
    // ทำงานทุกหน้าที่มีการ import watering.js
    await window.syncWateringStatus(user.email);
});

/**
 * =========================================================
 * 🛠️ MASTER FUNCTION: คำนวณและแจ้งเตือน (ฉลาดขึ้น)
 * =========================================================
 */
window.syncWateringStatus = async function(email, forceShowPopup = false) {
    try {
        const res = await fetch(`/api/planting-log?email=${email}&_=${Date.now()}`);
        if (!res.ok) return 0;
        const plantingLog = await res.json();

        // 1. เวลาปัจจุบัน
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA');
        const currentHour = now.getHours();

        // 2. ระบุ Slot ปัจจุบัน
        let currentSlotName = "เช้า";
        if (currentHour >= 11 && currentHour < 15) currentSlotName = "กลางวัน";
        else if (currentHour >= 15) currentSlotName = "เย็น";

        let currentCount = 0;

        plantingLog.forEach(plant => {
            if ((plant.status || '').toLowerCase() === 'harvested') return;

            const lastWaterDB = plant.last_watered_date;
            
            // ⭐ รองรับ Array: ["เช้า", "เย็น"] หรือ String "เช้า"
            let neededSlots = [];
            try {
                neededSlots = JSON.parse(plant.watering_time || '[]');
                if (!Array.isArray(neededSlots)) neededSlots = [plant.watering_time || "เช้า"];
            } catch (e) {
                neededSlots = [plant.watering_time || "เช้า"];
            }

            // เช็คว่าพืชต้องการน้ำใน Slot นี้ไหม
            const isTimeMatch = neededSlots.includes(currentSlotName);
            let isNeedWater = false;

            if (!lastWaterDB) {
                isNeedWater = true; // ไม่เคยรด -> เตือน
            } else {
                const lastDateObj = new Date(lastWaterDB);
                const lastWaterLocalStr = lastDateObj.toLocaleDateString('en-CA');

                // กรณี A: รดไป "คนละวัน" (เมื่อวานหรือนานกว่านั้น)
                if (lastWaterLocalStr !== todayStr) {
                    const interval = parseInt(plant.watering_interval_days || 1);
                    const nextDateObj = new Date(lastDateObj);
                    nextDateObj.setDate(lastDateObj.getDate() + interval);
                    const nextDateStr = nextDateObj.toLocaleDateString('en-CA');

                    // ถ้าเลยกำหนด หรือ ถึงกำหนดและเวลาตรง
                    if (todayStr > nextDateStr) isNeedWater = true; 
                    else if (todayStr === nextDateStr && isTimeMatch) isNeedWater = true;
                } 
                // กรณี B: รดไป "วันนี้" (เช็คว่ารด Slot ไหนไป)
                else if (isTimeMatch) {
                    const lastHour = lastDateObj.getHours();
                    let lastWaterSlot = "เช้า";
                    if (lastHour >= 11 && lastHour < 15) lastWaterSlot = "กลางวัน";
                    else if (lastHour >= 15) lastWaterSlot = "เย็น";

                    // ถ้ารดไปคนละ Slot กับปัจจุบัน -> เตือนใหม่
                    if (lastWaterSlot !== currentSlotName) {
                        isNeedWater = true;
                    }
                }
            }

            if (isNeedWater) currentCount++;
        });

        // --- อัปเดต UI Badge ---
        const badge = document.getElementById('waterBadge');
        if (badge) {
            badge.textContent = currentCount;
            badge.style.display = currentCount > 0 ? 'flex' : 'none';
        }

        // --- Notification Logic ---
        const isWateringPage = window.location.pathname.includes('watering.html');
        const lastKnownCount = parseInt(localStorage.getItem('lastWaterCount') || '0');
        const lastAlertSlot = localStorage.getItem('lastAlertSlot');
        const hasWelcomeAlert = sessionStorage.getItem('hasWelcomeAlertRun');

        if (currentCount > 0 && !isWateringPage) {
            let shouldShow = false;
            // 1. งานเพิ่ม
            if (currentCount > lastKnownCount) shouldShow = true;
            // 2. เพิ่งเข้าเว็บ
            else if (!hasWelcomeAlert) shouldShow = true;
            // 3. บังคับโชว์
            else if (forceShowPopup) shouldShow = true;
            // 4. ⭐ เปลี่ยน Slot เวลา (เช้า -> กลางวัน -> เย็น)
            else if (currentSlotName !== lastAlertSlot) shouldShow = true;

            if (shouldShow) {
                showGlobalWateringModal(currentCount, currentSlotName);
                sessionStorage.setItem('hasWelcomeAlertRun', 'true');
                localStorage.setItem('lastAlertSlot', currentSlotName);
            }
        } else {
            const modal = document.getElementById('globalWaterModal');
            if (modal) modal.remove();
        }

        localStorage.setItem('lastWaterCount', currentCount);
        return currentCount;

    } catch (err) {
        console.error("Sync Error:", err);
        return 0;
    }
};

window.markAsWatered = async function(id) {
    try {
        // บันทึกเวลาปัจจุบันลงไป (รวม HH:MM:SS) เพื่อใช้คำนวณ Slot
        const nowIso = new Date().toISOString(); 
        
        const res = await fetch(`/api/planting-log/${id}/water`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastWateredDate: nowIso })
        });

        if (res.ok) {
            const current = parseInt(localStorage.getItem('lastWaterCount') || '0');
            const newCount = Math.max(0, current - 1);
            localStorage.setItem('lastWaterCount', newCount);
            
            // กันไม่ให้เด้งเตือนทันทีหลังกด
            const currentHour = new Date().getHours();
            let currentSlot = "เช้า";
            if (currentHour >= 11 && currentHour < 15) currentSlot = "กลางวัน";
            else if (currentHour >= 15) currentSlot = "เย็น";
            localStorage.setItem('lastAlertSlot', currentSlot);
            sessionStorage.setItem('hasWelcomeAlertRun', 'true');

            alert('บันทึกเรียบร้อย!');
            location.reload();
        } else {
            alert('เกิดข้อผิดพลาดในการบันทึก');
        }
    } catch (err) { alert('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); }
};

// ==========================================
// UI Helpers (Updated for Multi-Slot)
// ==========================================

async function renderWateringCards(user) {
    const grid = document.getElementById('wateringGrid');
    const banner = document.getElementById('bannerTitle');
    if (!grid) return;

    grid.innerHTML = '<p style="text-align:center; padding:40px; color:#666;">⏳ กำลังโหลดรายการพืช...</p>';

    try {
        const res = await fetch(`/api/planting-log?email=${user.email}&_=${Date.now()}`);
        if (!res.ok) throw new Error('Fetch failed');
        const plantingLog = await res.json();
        
        grid.innerHTML = '';

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA');
        const currentHour = now.getHours();

        let currentSlotName = "เช้า";
        if (currentHour >= 11 && currentHour < 15) currentSlotName = "กลางวัน";
        else if (currentHour >= 15) currentSlotName = "เย็น";

        let count = 0;

        plantingLog.forEach(plant => {
            if ((plant.status || '').toLowerCase() === 'harvested') return;

            const lastWaterDB = plant.last_watered_date;
            
            // ⭐ Logic เดียวกับ Sync (Parse Array)
            let neededSlots = [];
            try {
                neededSlots = JSON.parse(plant.watering_time || '[]');
                if (!Array.isArray(neededSlots)) neededSlots = [plant.watering_time || "เช้า"];
            } catch (e) {
                neededSlots = [plant.watering_time || "เช้า"];
            }

            const isTimeMatch = neededSlots.includes(currentSlotName);
            let isDue = false;
            let isOverdue = false;

            if (!lastWaterDB) {
                isDue = true; 
            } else {
                const interval = parseInt(plant.watering_interval_days || 1);
                const lastDateObj = new Date(lastWaterDB);
                const nextDateObj = new Date(lastDateObj);
                nextDateObj.setDate(lastDateObj.getDate() + interval);
                const nextDateStr = nextDateObj.toLocaleDateString('en-CA');
                
                const lastWaterLocalStr = lastDateObj.toLocaleDateString('en-CA');
                
                // เช็คเงื่อนไข
                if (lastWaterLocalStr !== todayStr) {
                    if (todayStr > nextDateStr) {
                        isDue = true; isOverdue = true;
                    } else if (todayStr === nextDateStr && isTimeMatch) {
                        isDue = true;
                    }
                } else if (isTimeMatch) {
                    // รดวันนี้แล้ว แต่คนละช่วงเวลา
                    const lastHour = lastDateObj.getHours();
                    let lastWaterSlot = "เช้า";
                    if (lastHour >= 11 && lastHour < 15) lastWaterSlot = "กลางวัน";
                    else if (lastHour >= 15) lastWaterSlot = "เย็น";

                    if (lastWaterSlot !== currentSlotName) {
                        isDue = true;
                    }
                }
            }

            if (isDue) {
                count++;
                const card = document.createElement('div');
                card.className = 'water-card';
                if (isOverdue) card.style.borderLeft = "5px solid #d32f2f";

                // แสดงเวลาที่ต้องรด (เอา Array มาโชว์สวยๆ)
                const timeText = neededSlots.join(', ');

                card.innerHTML = `
                    <div class="card-top">
                        <h3 class="plant-name">${plant.vegetable_name}</h3>
                        <span class="water-badge" style="background:${isOverdue ? '#ffebee' : '#e3f2fd'}; color:${isOverdue ? '#c62828' : '#1976D2'};">
                            ${isOverdue ? 'เลยกำหนด' : 'ถึงเวลาแล้ว'}
                        </span>
                    </div>
                    <div class="card-details">
                        <div class="detail-row">📍 <span>${plant.location || 'ไม่ระบุตำแหน่ง'}</span></div>
                        
                    </div>
                    <button class="btn-action-water" onclick="markAsWatered(${plant.id})">✅ บันทึกรดน้ำ (${currentSlotName})</button>
                `;
                grid.appendChild(card);
            }
        });

        if (banner) banner.textContent = count > 0 ? `วันนี้มี ${count} รายการที่ต้องดูแล` : `ดูแลสวนครบถ้วนแล้ว!`;
        if (count === 0) grid.innerHTML = `
            <div class="empty-state" style="text-align:center; padding:50px; background:white; border-radius:12px; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
                <div style="font-size:3rem; margin-bottom:15px;">🎉</div>
                <h2 style="color:#2e7d32; margin-bottom:10px;">เยี่ยมมาก!</h2>
                <p style="color:#666;">คุณรดน้ำพืชครบทุกต้นในรอบ${currentSlotName}แล้ว</p>
            </div>`;

    } catch (err) { 
        console.error(err); 
        grid.innerHTML = '<p style="text-align:center; color:red;">ไม่สามารถโหลดข้อมูลได้</p>';
    }
}

function showGlobalWateringModal(count, slot) {
    if (document.getElementById('globalWaterModal')) return;

    const html = `
        <div id="globalWaterModal" class="global-modal-overlay">
            <div class="global-modal-content">
                <div style="font-size:4rem; margin-bottom:15px;">💧</div>
                <h2 style="color:#1565C0; margin-bottom:10px;">ได้เวลารดน้ำ [ช่วง${slot}]</h2>
                <p style="color:#555; margin-bottom:20px;">มีพืช <strong>${count} ต้น</strong> กำลังรอคุณอยู่</p>
                <button onclick="window.location.href='watering.html'" class="global-modal-btn">ไปรดน้ำเดี๋ยวนี้</button>
                <button onclick="document.getElementById('globalWaterModal').remove()" style="background:none; border:none; color:#999; margin-top:15px; cursor:pointer; font-size:0.9rem;">ไว้ทีหลัง</button>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

// Function UI อื่นๆ (Header/Menu) คงเดิม
function setupHeaderUI(user, logo) {
    const hName = document.getElementById('headerUserName');
    const menuName = document.getElementById('menuUserName');
    const menuRole = document.getElementById('menuUserRole');
    const avatar = document.getElementById('userAvatarHeader');
    const logoutBtn = document.getElementById('logoutBtnHeader');
    
    if (hName) hName.textContent = user.name || 'ผู้ใช้งาน';
    if (menuName) menuName.textContent = user.name || 'ผู้ใช้งาน';
    if (menuRole) menuRole.textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';

    if (avatar) {
        avatar.innerHTML = `<img src="${user.image_url || logo}" onerror="this.src='${logo}'" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    }

    if (user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.setProperty('display', 'none', 'important'));
    }

    const trigger = document.getElementById('profileTrigger');
    const menu = document.getElementById('dropdownMenu');
    if (trigger && menu) {
        trigger.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('active'); };
        window.onclick = () => menu.classList.remove('active');
    }

    if (logoutBtn) {
        logoutBtn.onclick = (e) => {
            e.preventDefault();
            if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                localStorage.removeItem('easygrowUser');
                window.location.href = 'login.html';
            }
        };
    }
}

function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('mobileOverlay');
    const sidebar = document.querySelector('.sidebar');
    if (btn && sidebar && overlay) {
        const toggle = () => { sidebar.classList.toggle('active'); overlay.classList.toggle('active'); };
        btn.onclick = toggle;
        overlay.onclick = toggle;
    }
}