/**
 * library.js (ฉบับแก้ไข: ย้ายโปรไฟล์ไปที่ Header Dropdown มุมขวาบน)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Guard & User Data
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

    // 2. Profile Dropdown Setup (มุมขวาบน)
    const userAvatar = document.getElementById('userAvatarHeader');
    const headerName = document.getElementById('headerUserName');
    const menuName = document.getElementById('menuUserName');
    const menuRole = document.getElementById('menuUserRole');
    const logoutBtn = document.getElementById('logoutBtnHeader');
    const profileTrigger = document.getElementById('profileTrigger');
    const dropdownMenu = document.getElementById('dropdownMenu');

    if (user) {
        // --- กรณีเข้าสู่ระบบแล้ว (Member) ---
        if (headerName) headerName.textContent = user.name || 'ผู้ใช้งาน';
        if (menuName) menuName.textContent = user.name || 'ผู้ใช้งาน';
        if (menuRole) menuRole.textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';

        // แสดงรูปโปรไฟล์
        if (userAvatar) {
            if (user.image_url) {
                userAvatar.innerHTML = `<img src="${user.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            } else {
                userAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
            }
        }

        // ซ่อนเมนู Admin ถ้าไม่ใช่ admin
        if (user.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }

        // Logic เปิด-ปิด Dropdown
        if (profileTrigger && dropdownMenu) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.classList.toggle('active');
            });
        }

        // ปิด Dropdown เมื่อคลิกที่อื่น
        window.addEventListener('click', () => {
            if (dropdownMenu && dropdownMenu.classList.contains('active')) {
                dropdownMenu.classList.remove('active');
            }
        });

        // ปุ่มออกจากระบบ
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                    localStorage.removeItem('easygrowUser');
                    window.location.href = 'index.html';
                }
            });
        }
    } else {
        // --- กรณีเป็นผู้เยี่ยมชม (Guest) ---
        if (headerName) headerName.textContent = 'ผู้เยี่ยมชม';
        if (userAvatar) userAvatar.textContent = '?';
        
        // ซ่อนส่วน Admin ทั้งหมด
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');

        // ปรับ Dropdown Menu ให้แสดงปุ่มเข้าสู่ระบบแทน
        if (dropdownMenu) {
            dropdownMenu.innerHTML = `
                <div style="padding: 15px; text-align: center;">
                    <p style="font-size: 0.8rem; color: #666; margin-bottom: 10px;">กรุณาเข้าสู่ระบบ</p>
                    <a href="index.html" style="background: #4CAF50; color: white; padding: 8px 15px; border-radius: 5px; text-decoration: none; display: block;">เข้าสู่ระบบ</a>
                </div>
            `;
        }
    }

    // ============================================================
    // 3. Load Data & Render (ส่วนคลังผักคงเดิม)
    // ============================================================
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
            if(gridContainer) {
                gridContainer.innerHTML = `<p style="text-align:center; color:red; grid-column:1/-1;">ไม่สามารถโหลดข้อมูลได้ (${error.message})</p>`;
            }
        }
    }

    function renderVegetables(data) {
        if (!gridContainer) return;
        gridContainer.innerHTML = ''; 

        // Promo Card สำหรับ Guest
        if (!user) {
            const promoCard = document.createElement('div');
            promoCard.className = 'veg-card';
            promoCard.style.cssText = 'border: 2px dashed #4CAF50; background-color: #f1f8e9; justify-content: center; align-items: center; cursor: default;';
            promoCard.innerHTML = `
                <div style="padding: 30px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">🔐</div>
                    <h3 style="color: #2e7d32; margin-bottom: 10px;">อยากบันทึกการปลูก?</h3>
                    <p style="color: #555; font-size: 0.9rem; margin-bottom: 20px;">สมัครสมาชิกเพื่อเริ่มบันทึกการเติบโต</p>
                    <a href="register.html" style="background: #4CAF50; color: white; padding: 10px 20px; border-radius: 20px; text-decoration: none; font-weight: bold; display: inline-block;">สมัครสมาชิกฟรี</a>
                </div>
            `;
            gridContainer.appendChild(promoCard);
        }

        if (!data || data.length === 0) {
            if (data.length === 0 && (user || (searchInput && searchInput.value))) {
                const msg = document.createElement('p');
                msg.style.cssText = 'color: #888; grid-column: 1/-1; text-align: center;';
                msg.textContent = 'ไม่พบข้อมูลผัก';
                gridContainer.appendChild(msg);
            }
            return;
        }

        data.forEach(veg => {
            const waterStr = Array.isArray(veg.water) ? veg.water.join('/') : veg.water;
            const imgUrl = veg.image || 'https://via.placeholder.com/300?text=No+Image';

            const card = document.createElement('div');
            card.className = 'veg-card';
            card.onclick = () => window.location.href = `plant-detail.html?id=${veg.id}`;
            card.innerHTML = `
                <div class="veg-img-container">
                    <img src="${imgUrl}" alt="${veg.name}" class="veg-img" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
                </div>
                <div class="veg-content">
                    <h3 class="veg-name">${veg.name}</h3>
                    <ul class="veg-details">
                        <li><span class="detail-icon">⏱️</span>ระยะเวลาเก็บเกี่ยว: ${veg.harvest_time} วัน</li>
                        <li><span class="detail-icon">💧</span>การให้น้ำ: ${waterStr}</li>
                        <li><span class="detail-icon">☀️</span>แสงแดด: ${veg.sunlight}</li>
                    </ul>
                    <span class="season-tag">📅 ฤดูกาลแนะนำ: ${veg.months}</span>
                </div>
            `;
            gridContainer.appendChild(card);
        });
    }

    loadVegetables();

    if (searchInput) {
        searchInput.addEventListener('input', (e) => loadVegetables(e.target.value));
    }
});

// ==========================================
// 🍔 Mobile Menu (ปุ่มขีดสามขีด - ยังคงไว้)
// ==========================================
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