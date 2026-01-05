/**
 * plant-detail.js
 * - Header UI & Sidebar Logic ปรับปรุงให้เหมือน index.js 100%
 * - รองรับ Guest (แสดงปุ่ม Login ใน Dropdown)
 * - รองรับ User (แสดงเมนู Logout)
 * - ⭐ ปรับปรุง: เพิ่มระบบ Auto-Sync รูปโปรไฟล์ล่าสุดจาก Server
 * - แสดงรายละเอียดผักตาม ID
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Plant Detail Page Loaded");
    
    // ⭐ กำหนดพาธโลโก้เว็บสำหรับใช้เป็นรูปสำรอง ⭐
    const webLogo = '/images/logo.png'; 

    // ==========================================
    // 0. แก้ไขสีโลโก้ Sidebar (เหมือน index.js)
    // ==========================================
    const sidebarLogoText = document.querySelector('.sidebar .logo-text h2');
    if (sidebarLogoText) {
        sidebarLogoText.style.setProperty('color', '#2e7d32', 'important'); 
        sidebarLogoText.style.fontWeight = '600';
    }

    // ==========================================
    // 1. ตรวจสอบสถานะผู้ใช้งาน (Auth & Data)
    // ==========================================
    const storedUser = localStorage.getItem('easygrowUser');
    let user = null;

    if (storedUser) {
        try {
            user = JSON.parse(storedUser);
        } catch (e) {
            console.error("User data corrupted");
            localStorage.removeItem('easygrowUser');
        }
    }

    // ==========================================
    // 2. ตั้งค่าโปรไฟล์และ Header UI
    // ==========================================
    const profileTrigger = document.getElementById('profileTrigger');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const userAvatarHeader = document.getElementById('userAvatarHeader');
    const headerUserName = document.getElementById('headerUserName');
    const menuUserName = document.getElementById('menuUserName');
    const menuUserRole = document.getElementById('menuUserRole');
    const logoutBtnHeader = document.getElementById('logoutBtnHeader');

    // --- ฟังก์ชันอัปเดต UI ส่วนหัว (แยกออกมาเพื่อให้เรียกซ้ำได้เมื่อข้อมูลอัปเดต) ---
    function updateHeaderUI(userData) {
        if (headerUserName) headerUserName.textContent = userData.name || 'ผู้ใช้งาน';
        if (menuUserName) menuUserName.textContent = userData.name || 'ผู้ใช้งาน';
        if (menuUserRole) menuUserRole.textContent = userData.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';

        if (userAvatarHeader) {
            const profileImgPath = userData.image_url ? userData.image_url : webLogo;
            userAvatarHeader.innerHTML = `
                <img src="${profileImgPath}" 
                     onerror="this.src='${webLogo}'" 
                     style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            userAvatarHeader.style.backgroundColor = 'transparent';
        }

        // ซ่อนเมนู Admin ถ้าไม่ใช่ Admin
        if (userData.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.setProperty('display', 'none', 'important'));
        }
    }

    if (user) {
        // --- 2.1 กรณี Login แล้ว: แสดงผลข้อมูลเดิมจาก LocalStorage ก่อน (เพื่อความเร็ว) ---
        updateHeaderUI(user);

        // --- 2.2 ⭐ ดึงข้อมูลล่าสุดจาก Server (Sync) เพื่อให้รูป/ชื่อ เป็นปัจจุบันเสมอ ⭐ ---
        try {
            const resProfile = await fetch(`/api/profile?email=${user.email}`);
            if (resProfile.ok) {
                const data = await resProfile.json();
                const latestUser = data.user;

                // อัปเดตหน้าจอ
                updateHeaderUI(latestUser);

                // อัปเดต LocalStorage และตัวแปร user ในหน่วยความจำ
                const updatedStorage = { ...user, ...latestUser };
                localStorage.setItem('easygrowUser', JSON.stringify(updatedStorage));
                user = updatedStorage; // อัปเดตตัวแปร user เพื่อให้ปุ่ม Add to log ใช้ข้อมูลล่าสุด
            }
        } catch (err) {
            console.warn("ไม่สามารถดึงข้อมูลโปรไฟล์ล่าสุดได้ ใช้ข้อมูลเดิมจากเครื่องแทน", err);
        }

        // --- 2.3 ตั้งค่าอื่นๆ สำหรับ User ---
        // เรียกใช้ Master Logic จาก watering.js (ถ้ามี)
        if (window.syncWateringStatus) {
            await window.syncWateringStatus(user.email, false).catch(e => console.warn("Sync Error:", e));
        }

        // ปุ่มออกจากระบบ
        if (logoutBtnHeader) {
            logoutBtnHeader.onclick = (e) => {
                e.preventDefault();
                if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                    localStorage.removeItem('easygrowUser');
                    window.location.href = 'login.html';
                }
            };
        }

    } else {
        // --- กรณีผู้เยี่ยมชม (Guest) ---
        if (headerUserName) headerUserName.textContent = 'ผู้เยี่ยมชม';
        if (userAvatarHeader) {
            userAvatarHeader.innerHTML = `<img src="${webLogo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }
        
        // สร้างปุ่ม Login ให้ Guest ใน Dropdown
        if (dropdownMenu) {
            dropdownMenu.innerHTML = `
                <div style="padding: 15px; text-align: center;">
                    <p style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">กรุณาเข้าสู่ระบบ</p>
                    <a href="login.html" style="background: #4CAF50; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: block; font-weight: bold; font-size: 0.9rem;">เข้าสู่ระบบ</a>
                </div>`;
        }
        
        // ซ่อนเมนู Admin สำหรับ Guest
        document.querySelectorAll('.admin-only').forEach(el => el.style.setProperty('display', 'none', 'important'));
    }

    // Toggle Dropdown (ใช้ได้ทั้ง User/Guest)
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
    // 4. ส่วนโหลดข้อมูลผัก (Detail Logic)
    // ==========================================
    const container = document.getElementById('detailContainer');
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('id');

    if (!container) return;

    if (!urlId) {
        container.innerHTML = '<div style="text-align:center; padding:50px; color:red;">❌ ไม่พบรหัสข้อมูลผัก (ID Missing)</div>';
        return;
    }

    try {
        container.innerHTML = '<p style="text-align:center; padding:50px;">⏳ กำลังโหลดข้อมูล...</p>';
        
        const response = await fetch('/api/vegetables');
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        const vegetables = await response.json();
        const veg = vegetables.find(v => v.id == urlId);

        if (!veg) {
            container.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h2>😕 ไม่พบข้อมูลผักนี้</h2>
                    <a href="index.html" style="color: #4CAF50; font-weight:bold;">← กลับหน้าหลัก</a>
                </div>`;
            return;
        }

        // ส่ง user ที่อัปเดตแล้วเข้าไป render
        renderPlantDetails(veg, container, webLogo, user);

    } catch (error) {
        console.error('Data Load Error:', error);
        container.innerHTML = `
            <div style="text-align:center; color:red; padding:50px;">
                <h3>❌ เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
                <p>${error.message}</p>
                <a href="index.html" style="margin-top:20px; display:inline-block;">กลับหน้าหลัก</a>
            </div>`;
    }
});

// --- Helper Functions ---

function renderPlantDetails(veg, container, webLogo, userObj) {
    const waterStr = Array.isArray(veg.water) ? veg.water.join(', ') : (veg.water || '-');
    const regionStr = Array.isArray(veg.regions) ? veg.regions.join(', ') : (veg.regions || '-');
    const steps = (veg.steps && veg.steps.length > 0) ? veg.steps : ['ไม่มีข้อมูลขั้นตอนการปลูก'];
    const moreTips = (veg.moreTips && veg.moreTips.length > 0) ? veg.moreTips : ['-'];
    const plantImg = veg.image ? veg.image : webLogo;

    container.innerHTML = `
        <div class="top-section">
            <div class="img-wrapper" style="text-align:center;">
                <img src="${plantImg}" alt="${veg.name}" class="plant-hero-img" 
                     onerror="this.onerror=null;this.src='${webLogo}'">
            </div>
            <div class="plant-info-col">
                <div class="plant-header"><h1>${veg.name}</h1></div>
                <p class="plant-desc">${veg.description || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                
                <div class="info-grid">
                    <div class="info-card">
                        <div class="info-icon-circle">⏱️</div>
                        <div class="info-text"><h4>ระยะเวลาเก็บเกี่ยว</h4><p>${veg.harvest_time} วัน</p></div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon-circle">💧</div>
                        <div class="info-text"><h4>การรดน้ำ</h4><p>${waterStr}</p></div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon-circle">☀️</div>
                        <div class="info-text"><h4>แสงแดด</h4><p>${veg.sunlight || '-'}</p></div>
                    </div>
                    <div class="info-card">
                        <div class="info-icon-circle">📅</div>
                        <div class="info-text"><h4>ฤดูกาลแนะนำ</h4><p>${veg.months || '-'}</p></div>
                    </div>
                </div>

                <div style="margin:20px 0; background:#f0f7f0; padding:15px; border-radius:10px;">
                    <strong>📍 พื้นที่แนะนำ:</strong> ${regionStr}
                </div>

                <button id="addToLogBtn" class="add-log-btn" style="
                    background: #4CAF50; color: white; border: none; padding: 12px 24px; 
                    border-radius: 50px; font-size: 1rem; cursor: pointer; width: 100%; font-weight: bold;">
                    🌱 เพิ่มในบันทึกการปลูก
                </button>
            </div>
        </div>

        <div class="bottom-section" style="margin-top: 30px;">
            <div class="content-card" style="margin-bottom: 20px;">
                <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">ขั้นตอนการปลูก</h3>
                <ul class="tips-list" style="list-style: none; padding: 0;">
                    ${steps.map((step, index) => `
                        <li style="margin-bottom: 10px; display: flex; align-items: start;">
                            <span style="background:#4CAF50; color:white; width:25px; height:25px; 
                                   border-radius:50%; display:inline-flex; align-items:center; 
                                   justify-content:center; margin-right:10px; flex-shrink:0;">${index + 1}</span>
                            <span>${step}</span>
                        </li>`).join('')}
                </ul>
            </div>
            
            <div class="content-card">
                <h3 style="border-bottom: 2px solid #eee; padding-bottom: 10px;">เคล็ดลับเพิ่มเติม</h3>
                <ul class="tips-list" style="list-style: none; padding: 0;">
                    ${moreTips.map(tip => `<li style="margin-bottom: 5px;">• ${tip}</li>`).join('')}
                </ul>
            </div>
        </div>`;

    const addBtn = document.getElementById('addToLogBtn');
    if (addBtn) {
        // ใช้ userObj ที่ส่งเข้ามา ซึ่งจะเป็นค่าล่าสุดถ้า fetch เสร็จทัน
        // หรือถ้ายังไม่เสร็จก็จะเป็นค่าจาก LocalStorage ซึ่งก็ยังใช้ email เดิมได้
        addBtn.onclick = () => handleAddToLog(veg, userObj, addBtn);
    }
}

async function handleAddToLog(veg, currentUser, btn) {
    // Logic ตรวจสอบ User ก่อนบันทึก
    if (!currentUser) {
        if (confirm('🔒 กรุณาเข้าสู่ระบบก่อนบันทึกการปลูก\n\nกด "ตกลง" เพื่อไปหน้าเข้าสู่ระบบ')) {
            window.location.href = 'login.html';
        }
        return;
    }

    const originalText = btn.textContent;
    btn.textContent = '⏳ กำลังบันทึก...';
    btn.disabled = true;

    try {
        // เพิ่ม Logic: ถ้า user มีการอัปเดตระหว่างหน้านี้ ให้เช็คจาก LocalStorage อีกรอบเพื่อความชัวร์
        // (เผื่อกรณีที่ส่ง currentUser มาเป็น null หรือเก่าเกินไป)
        let finalUser = currentUser;
        const freshStore = localStorage.getItem('easygrowUser');
        if(freshStore) finalUser = JSON.parse(freshStore);

        const payload = {
            ownerEmail: finalUser.email, // แก้ไข: ใช้ ownerEmail ตามที่ API server.js ต้องการ
            vegetableId: veg.id,
            vegetableName: veg.name,
            status: 'Growing',
            plantedDate: new Date().toISOString(),
            expectedDate: new Date(Date.now() + veg.harvest_time * 24 * 60 * 60 * 1000).toISOString(),
            location: 'แปลงผัก',
            notes: '',
            wateringIntervalDays: 1
        };

        const response = await fetch('/api/planting-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert('✅ บันทึกการปลูกเรียบร้อยแล้ว!');
            if (window.syncWateringStatus) await window.syncWateringStatus(finalUser.email, false);
            window.location.href = 'planting-log.html';
        } else {
            throw new Error('Save failed');
        }
    } catch (err) {
        console.error(err);
        alert('❌ ไม่สามารถบันทึกข้อมูลได้');
        btn.textContent = originalText;
        btn.disabled = false;
    }
}