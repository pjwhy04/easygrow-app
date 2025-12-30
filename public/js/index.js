/**
 * index.js (Fixed Guest Dropdown)
 * - แก้ไขให้ Guest กดรูปโปรไฟล์แล้วเมนูเด้งขึ้นมา (ย้าย onclick ออกมานอกเงื่อนไข)
 * - ระบบอื่นๆ ยังคงเดิมไม่เปลี่ยนแปลง
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ⭐ กำหนดพาธโลโก้เว็บสำหรับใช้เป็นรูปสำรองทั่วทั้งไฟล์ ⭐
    const webLogo = '/images/logo.png'; 

    // ==========================================
    // 0. แก้ไขสีโลโก้ Sidebar
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
    // 2. ตั้งค่าโปรไฟล์และ Master Notification Logic
    // ==========================================
    const profileTrigger = document.getElementById('profileTrigger');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const userAvatarHeader = document.getElementById('userAvatarHeader');
    const headerUserName = document.getElementById('headerUserName');
    const menuUserName = document.getElementById('menuUserName');
    const menuUserRole = document.getElementById('menuUserRole');
    const logoutBtnHeader = document.getElementById('logoutBtnHeader');

    if (user) {
        // --- กรณี Login แล้ว ---
        if (headerUserName) headerUserName.textContent = user.name || 'ผู้ใช้งาน';
        if (menuUserName) menuUserName.textContent = user.name || 'ผู้ใช้งาน';
        if (menuUserRole) menuUserRole.textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';

        if (userAvatarHeader) {
            const profileImgPath = user.image_url ? user.image_url : webLogo;
            userAvatarHeader.innerHTML = `
                <img src="${profileImgPath}" 
                     onerror="this.src='${webLogo}'" 
                     style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            userAvatarHeader.style.backgroundColor = 'transparent';
        }

        if (user.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }

        // ⭐ เรียกใช้ Master Logic จาก watering.js
        if (window.syncWateringStatus) {
            await window.syncWateringStatus(user.email, false);
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
        
        // สร้างปุ่ม Login ให้ Guest
        if (dropdownMenu) {
            dropdownMenu.innerHTML = `
                <div style="padding: 15px; text-align: center;">
                    <p style="font-size: 0.9rem; color: #666; margin-bottom: 10px;">กรุณาเข้าสู่ระบบ</p>
                    <a href="login.html" style="background: #4CAF50; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; display: block; font-weight: bold; font-size: 0.9rem;">เข้าสู่ระบบ</a>
                </div>`;
        }
        
        // ซ่อนเมนู Admin
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    // ⭐ FIX: ย้าย Event Listener ออกมานอกเงื่อนไข เพื่อให้ Guest กดได้ด้วย ⭐
    if (profileTrigger && dropdownMenu) {
        profileTrigger.onclick = (e) => { 
            e.stopPropagation(); // ป้องกันไม่ให้ Event ทะลุไปปิดเมนูทันที
            dropdownMenu.classList.toggle('active'); 
        };
    }
    
    // คลิกที่อื่นเพื่อปิดเมนู
    window.addEventListener('click', () => {
        if (dropdownMenu) dropdownMenu.classList.remove('active');
    });

    // ==========================================
    // 3. จัดการข้อมูลคลังผัก (Vegetable Library)
    // ==========================================
    const gridContainer = document.getElementById('vegetableGrid');
    const searchInput = document.getElementById('searchInput');

    async function loadVegetables(filterText = '') {
        try {
            const response = await fetch('/api/vegetables');
            if (!response.ok) throw new Error('Network Error');
            const vegetables = await response.json();

            const filtered = vegetables.filter(veg => 
                veg.name.toLowerCase().includes(filterText.toLowerCase())
            );

            renderVegetables(filtered);
        } catch (error) {
            console.error('Error loading vegetables:', error);
            if(gridContainer) gridContainer.innerHTML = `<p style="text-align:center; color:red; grid-column:1/-1; padding: 40px;">ไม่สามารถโหลดข้อมูลได้ในขณะนี้</p>`;
        }
    }

    function renderVegetables(data) {
        if (!gridContainer) return;
        gridContainer.innerHTML = ''; 

        // Promo Card สำหรับ Guest
        if (!user) {
            const promoCard = document.createElement('div');
            promoCard.className = 'veg-card';
            promoCard.style.cssText = 'border: 2px dashed #4CAF50; background-color: #f1f8e9; justify-content: center; align-items: center; cursor: default; height: 320px;';
            promoCard.innerHTML = `
                <div style="padding: 30px; text-align: center;">
                    <div style="font-size: 3.5rem; margin-bottom: 15px;">🌱</div>
                    <h3 style="color: #2e7d32; margin-bottom: 10px;">อยากเริ่มสวนของคุณไหม?</h3>
                    <p style="color: #555; font-size: 0.9rem; margin-bottom: 25px;">สมัครสมาชิกเพื่อบันทึกรายการปลูก <br>และรับการแจ้งเตือนรดน้ำ</p>
                    <a href="register.html" style="background: #4CAF50; color: white; padding: 12px 25px; border-radius: 25px; text-decoration: none; font-weight: bold; display: inline-block; transition: 0.3s;">สมัครสมาชิกฟรี</a>
                </div>`;
            gridContainer.appendChild(promoCard);
        }

        if (!data || data.length === 0) {
            if (user || (searchInput && searchInput.value)) {
                gridContainer.innerHTML = '<p style="color: #888; grid-column: 1/-1; text-align: center; padding: 80px;">ไม่พบข้อมูลผักที่คุณค้นหา</p>';
            }
            return;
        }

        data.forEach(veg => {
            const waterStr = Array.isArray(veg.water) ? veg.water.join('/') : veg.water;
            const imgUrl = veg.image || webLogo;

            const card = document.createElement('div');
            card.className = 'veg-card';
            card.onclick = () => window.location.href = `plant-detail.html?id=${veg.id}`;
            card.innerHTML = `
                <div class="veg-img-container">
                    <img src="${imgUrl}" alt="${veg.name}" class="veg-img" onerror="this.src='${webLogo}'">
                </div>
                <div class="veg-content">
                    <h3 class="veg-name">${veg.name}</h3>
                    <ul class="veg-details">
                        <li><span class="detail-icon">⏱️</span>ระยะเวลาเก็บเกี่ยว: ${veg.harvest_time} วัน</li>
                        <li><span class="detail-icon">💧</span>การรดน้ำ: ${waterStr}</li>
                        <li><span class="detail-icon">☀️</span>แสงแดด: ${veg.sunlight}</li>
                    </ul>
                    <span class="season-tag">📅 ฤดูกาล: ${veg.months}</span>
                </div>`;
            gridContainer.appendChild(card);
        });
    }

    loadVegetables();

    if (searchInput) {
        searchInput.addEventListener('input', (e) => loadVegetables(e.target.value));
    }

    // ==========================================
    // 🍔 Mobile Menu Logic
    // ==========================================
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar && mobileOverlay) {
        const toggleMenu = () => { sidebar.classList.toggle('active'); mobileOverlay.classList.toggle('active'); };
        mobileBtn.onclick = toggleMenu;
        mobileOverlay.onclick = toggleMenu;
    }
});