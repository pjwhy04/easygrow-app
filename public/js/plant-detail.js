/**
 * plant-detail.js (ฉบับสมบูรณ์: รองรับรูปโปรไฟล์ + API)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const storedUser = localStorage.getItem('easygrowUser');
    let user = null;

    if (storedUser) {
        try {
            user = JSON.parse(storedUser);
        } catch (e) {
            console.error("User data corrupted, logging out.");
            localStorage.removeItem('easygrowUser');
        }
    }
    
    // Sidebar Setup
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    const sidebarAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        if(sidebarName) sidebarName.textContent = user.name || 'ผู้ใช้งาน';
        if(sidebarRole) sidebarRole.textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
        
        // ⭐ แก้ไข: แสดงรูปโปรไฟล์ถ้ามี
        if (sidebarAvatar) {
            if (user.image_url) {
                sidebarAvatar.innerHTML = `<img src="${user.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                sidebarAvatar.style.backgroundColor = 'transparent';
            } else {
                sidebarAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
            }
        }

        if (user.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }

        if(logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                    localStorage.removeItem('easygrowUser');
                    window.location.href = 'index.html';
                }
            });
        }
    } else {
        // Guest Mode
        if(sidebarName) sidebarName.textContent = 'ผู้เยี่ยมชม';
        if(sidebarRole) sidebarRole.textContent = 'Guest';
        if(sidebarAvatar) sidebarAvatar.textContent = '?';

        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');

        if(logoutBtn) {
            logoutBtn.innerHTML = '🔑'; 
            logoutBtn.title = "เข้าสู่ระบบ";
            logoutBtn.onclick = () => window.location.href = 'index.html';
        }
    }

    // ============================================================
    // 3. Load Data & Render (จาก Server)
    // ============================================================
    
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('id');
    const container = document.getElementById('detailContainer');

    if (!urlId) {
        container.innerHTML = '<p style="text-align:center; padding:50px;">ไม่พบรหัสข้อมูลผัก</p>';
        return;
    }

    try {
        const response = await fetch('/api/vegetables');
        if (!response.ok) throw new Error('Network Error');
        
        const vegetables = await response.json();
        // แปลง ID เป็น String เพื่อเทียบกัน
        const veg = vegetables.find(v => v.id == urlId);

        if (!veg) {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h2>ไม่พบข้อมูลผัก 😕</h2>
                    <a href="vegetable-library.html" style="color: #4CAF50; font-weight:bold; text-decoration:none;">← กลับไปที่คลังข้อมูล</a>
                </div>
            `;
            return;
        }

        // Format Data
        const waterStr = Array.isArray(veg.water) ? veg.water.join(', ') : veg.water;
        const regionStr = Array.isArray(veg.regions) ? veg.regions.join(', ') : veg.regions;
        const steps = (veg.steps && veg.steps.length > 0) ? veg.steps : ['ไม่มีข้อมูลขั้นตอนการปลูก'];
        const moreTips = (veg.moreTips && veg.moreTips.length > 0) ? veg.moreTips : ['-'];
        const imgUrl = veg.image || 'https://via.placeholder.com/800x400?text=No+Image';

        container.innerHTML = `
            <div class="top-section">
                <img src="${imgUrl}" alt="${veg.name}" class="plant-hero-img" onerror="this.src='https://via.placeholder.com/800x400?text=No+Image'">
                
                <div class="plant-info-col">
                    <div class="plant-header">
                        <h1>${veg.name}</h1>
                    </div>
                    
                    <p class="plant-desc">${veg.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                    
                    <div class="info-grid">
                        <div class="info-card">
                            <div class="info-icon-circle">⏱️</div>
                            <div class="info-text">
                                <h4>ระยะเวลาการเก็บเกี่ยว</h4>
                                <p>${veg.harvest_time} วัน</p>
                            </div>
                        </div>
                        <div class="info-card">
                            <div class="info-icon-circle">💧</div>
                            <div class="info-text">
                                <h4>การให้น้ำ</h4>
                                <p>${waterStr}</p>
                            </div>
                        </div>
                        <div class="info-card">
                            <div class="info-icon-circle">☀️</div>
                            <div class="info-text">
                                <h4>แสงแดด</h4>
                                <p>${veg.sunlight}</p>
                            </div>
                        </div>
                        <div class="info-card">
                            <div class="info-icon-circle">📅</div>
                            <div class="info-text">
                                <h4>ฤดูกาลแนะนำ</h4>
                                <p>${veg.months}</p>
                            </div>
                        </div>
                    </div>

                    <div style="margin-bottom:20px; background:#f9f9f9; padding:15px; border-radius:10px;">
                        <strong>พื้นที่ที่เหมาะสม:</strong> ${regionStr}
                    </div>

                    <button id="addToLogBtn" class="add-log-btn">
                        🌱 เพิ่มในบันทึกการปลูก
                    </button>
                </div>
            </div>

            <div class="bottom-section">
                <div class="content-card">
                    <h3> ขั้นตอนการปลูก</h3>
                    <ul class="tips-list">
                        ${steps.map((step, index) => `
                            <li>
                                <span class="step-num">${index + 1}</span>
                                <span>${step}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="content-card">
                    <h3> เคล็ดลับเพิ่มเติม</h3>
                    <ul class="tips-list">
                        ${moreTips.map(tip => `
                            <li>
                                <span>• ${tip}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;

        // ============================================================
        // 4. Logic for "Add to Planting Log"
        // ============================================================
        const addBtn = document.getElementById('addToLogBtn');
        addBtn.addEventListener('click', async () => {
            // เช็ค Login
            if (!user) {
                if(confirm('คุณต้องเข้าสู่ระบบก่อนเพื่อบันทึกการปลูก\nต้องการเข้าสู่ระบบตอนนี้หรือไม่?')) {
                    window.location.href = 'index.html';
                }
                return;
            }

            // เปลี่ยนสถานะปุ่ม
            const originalText = addBtn.textContent;
            addBtn.textContent = '⏳ กำลังบันทึก...';
            addBtn.disabled = true;

            try {
                // คำนวณวันเก็บเกี่ยว (Expected Date)
                const today = new Date();
                const expectedDate = new Date();
                
                // ดึงตัวเลขวันเก็บเกี่ยวจากข้อมูลผัก (เช่น "45-60 วัน" เอาเลข 45)
                let daysToAdd = 60; // Default
                if (veg.harvest_time) {
                    const match = veg.harvest_time.match(/(\d+)/);
                    if (match) daysToAdd = parseInt(match[0]);
                }
                expectedDate.setDate(today.getDate() + daysToAdd);

                // เตรียมข้อมูลส่งให้ Server
                const payload = {
                    ownerEmail: user.email,
                    vegetableId: veg.id,
                    vegetableName: veg.name,
                    status: 'Planted',
                    plantedDate: today.toISOString().split('T')[0], // YYYY-MM-DD
                    expectedDate: expectedDate.toISOString().split('T')[0],
                    location: 'แปลงปลูกทั่วไป', // ค่าเริ่มต้น
                    notes: '',
                    wateringIntervalDays: 1
                };

                // ยิง API
                const res = await fetch('/api/planting-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    addBtn.textContent = '✅ บันทึกแล้ว!';
                    addBtn.style.backgroundColor = '#2e7d32'; 
                    setTimeout(() => {
                        alert(`สำเร็จ! เพิ่ม ${veg.name} ลงในบันทึกการปลูกเรียบร้อยแล้ว`);
                    }, 100);
                } else {
                    throw new Error('Server responded with error');
                }

            } catch (error) {
                console.error('Save Error:', error);
                alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
                addBtn.textContent = originalText;
                addBtn.disabled = false;
            }
        });

    } catch (error) {
        console.error('Fetch Error:', error);
        container.innerHTML = `<p style="text-align:center; color:red; padding:50px;">เกิดข้อผิดพลาดในการโหลดข้อมูล (${error.message})</p>`;
    }
});

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