/**
 * watering.js (ฉบับเชื่อมต่อ Node.js Server & MySQL)
 * - เพิ่ม: แสดงรูปโปรไฟล์ใน Sidebar
 * - เพิ่ม: เมนูมือถือ
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(storedUser);

    // Sidebar Setup
    document.getElementById('sidebarUserName').textContent = user.name || 'ผู้ใช้งาน';
    document.getElementById('sidebarUserRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
    
    // ⭐ แก้ไข: ส่วนแสดงรูปโปรไฟล์ (ถ้ามีรูปให้โชว์รูป ไม่มีให้โชว์ตัวอักษร)
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
        if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
            localStorage.removeItem('easygrowUser');
            window.location.href = 'index.html';
        }
    });

    // 2. Load Data from Server & Render
    renderWateringPage(user);
    
    // 3. Mobile Menu Setup
    setupMobileMenu();
});

// ============================================
// Main Logic
// ============================================

async function renderWateringPage(user) {
    const grid = document.getElementById('wateringGrid');
    const bannerTitle = document.getElementById('bannerTitle');
    
    if (grid) grid.innerHTML = '<p style="text-align:center;">กำลังโหลดข้อมูล...</p>';

    try {
        // ดึงข้อมูลการปลูกจาก Server
        const res = await fetch(`/api/planting-log?email=${user.email}`);
        if (!res.ok) throw new Error('Network Error');
        
        const plantingLog = await res.json();
        
        if (grid) grid.innerHTML = '';
        
        // ตั้งเวลาวันนี้ให้เป็น 00:00:00 เพื่อเทียบแค่วันที่
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0); 

        let needsWaterCount = 0;

        plantingLog.forEach(plant => {
            // ข้ามต้นที่เก็บเกี่ยวไปแล้ว
            if (plant.status && plant.status.toLowerCase() === 'harvested') return;

            // ใช้ planted_date เป็นค่าเริ่มต้นถ้า last_watered_date เป็น null
            const lastWaterStr = plant.last_watered_date || plant.planted_date;
            const lastWaterDate = new Date(lastWaterStr);
            lastWaterDate.setHours(0,0,0,0);

            const interval = plant.watering_interval_days || 1; 

            // คำนวณวันที่ต้องรดน้ำถัดไป
            const nextWaterDate = new Date(lastWaterDate);
            nextWaterDate.setDate(lastWaterDate.getDate() + interval);

            // เช็คว่าตรงกับ "วันนี้" หรือ "เลยกำหนดมาแล้ว"
            if (todayDate.getTime() >= nextWaterDate.getTime()) {
                needsWaterCount++;
                
                const card = document.createElement('div');
                card.className = 'water-card';
                card.innerHTML = `
                    <div class="card-top">
                        <h3 class="plant-name">${plant.vegetable_name}</h3>
                        <span class="water-badge" style="background:#e3f2fd; color:#1976D2;">ถึงรอบรดน้ำ</span>
                    </div>
                    <div class="card-details">
                        <div class="detail-row">
                            <span class="detail-icon">📍</span> 
                            <span>${plant.location || '-'}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-icon">💧</span> 
                            <span>เว้นระยะ: ทุก ${interval} วัน</span>
                        </div>
                    </div>
                    <button class="btn-action-water" onclick="markAsWatered(${plant.id})">
                        ✅ รดน้ำแล้ว
                    </button>
                `;
                if(grid) grid.appendChild(card);
            }
        });

        // อัปเดต Banner
        if (bannerTitle) {
            const bannerSub = document.getElementById('bannerSub');
            
            if (needsWaterCount > 0) {
                bannerTitle.textContent = `วันนี้มี ${needsWaterCount} ต้นที่ต้องรดน้ำ`;
                bannerTitle.style.color = "#1565C0";
                if(bannerSub) {
                    bannerSub.style.display = 'inline';
                    bannerSub.textContent = "รีบรดน้ำก่อนหมดวันนะครับ!";
                }
            } else {
                bannerTitle.textContent = `วันนี้ไม่มีรายการต้องรดน้ำ`;
                bannerTitle.style.color = "#2e7d32"; 
                if(bannerSub) bannerSub.style.display = 'none';
                
                if(grid) {
                    grid.innerHTML = `
                        <div class="empty-state">
                            <h2 style="margin:0 0 10px 0;">🎉 พักผ่อนได้!</h2>
                            <p>ไม่มีต้นไม้ที่ครบกำหนดรดน้ำในวันนี้</p>
                        </div>
                    `;
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
        if(grid) grid.innerHTML = `<p style="color:red; text-align:center;">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>`;
    }
}

// Global function (สำหรับการกดปุ่ม)
window.markAsWatered = async function(id) {
    try {
        // สร้างวันที่ปัจจุบัน YYYY-MM-DD
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // ส่งไปอัปเดตที่ Server
        const res = await fetch(`/api/planting-log/${id}/water`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastWateredDate: todayStr })
        });

        if (res.ok) {
            alert('บันทึกการรดน้ำเรียบร้อย!');
            // รีโหลดหน้าเพื่อคำนวณใหม่ (รายการที่รดแล้วจะหายไป)
            location.reload(); 
        } else {
            alert('บันทึกไม่สำเร็จ');
        }
    } catch (error) {
        console.error('Update Error:', error);
        alert('ติดต่อเซิร์ฟเวอร์ไม่ได้');
    }
};

// ==========================================
// 🍔 Mobile Menu Logic
// ==========================================
function setupMobileMenu() {
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
}