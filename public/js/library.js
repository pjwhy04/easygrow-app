/**
 * library.js (ฉบับแก้ไข: แสดงรูปโปรไฟล์ใน Sidebar)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth Guard (Guest allowed - เช็คเพื่อโชว์ชื่อใน Sidebar เท่านั้น)
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

    // 2. Sidebar Setup
    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarRole = document.getElementById('sidebarUserRole');
    const sidebarAvatar = document.getElementById('userAvatar');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        // Member View
        if(sidebarName) sidebarName.textContent = user.name || 'ผู้ใช้งาน';
        if(sidebarRole) sidebarRole.textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
        
        // ⭐⭐⭐ แก้ไขส่วนแสดงรูปโปรไฟล์ตรงนี้ครับ ⭐⭐⭐
        if (sidebarAvatar) {
            if (user.image_url) {
                sidebarAvatar.innerHTML = `<img src="${user.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                sidebarAvatar.style.backgroundColor = 'transparent';
            } else {
                sidebarAvatar.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
            }
        }
        // ⭐⭐⭐ จบส่วนแก้ไข ⭐⭐⭐

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
        // Guest View
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
    // 3. Load Data from Server
    // ============================================================
    const gridContainer = document.getElementById('vegetableGrid');
    const searchInput = document.getElementById('searchInput');

    async function loadVegetables(filterText = '') {
        try {
            // เรียก API ไปที่ Server ของเรา
            const response = await fetch('/api/vegetables');
            if (!response.ok) throw new Error('Network Error');
            
            const vegetables = await response.json();

            // กรองข้อมูล (Search Logic)
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

    // 4. Function Render Cards
    function renderVegetables(data) {
        if (!gridContainer) return;
        gridContainer.innerHTML = ''; 

        // ★ Guest Banner Logic ★
        if (!user) {
            const promoCard = document.createElement('div');
            promoCard.className = 'veg-card';
            promoCard.style.border = '2px dashed #4CAF50';
            promoCard.style.backgroundColor = '#f1f8e9';
            promoCard.style.justifyContent = 'center';
            promoCard.style.alignItems = 'center';
            promoCard.style.cursor = 'default';
            promoCard.innerHTML = `
                <div style="padding: 30px; text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">🔐</div>
                    <h3 style="color: #2e7d32; margin: 0 0 10px 0;">อยากบันทึกการปลูก?</h3>
                    <p style="color: #555; font-size: 0.9rem; margin-bottom: 20px;">
                        สมัครสมาชิกเพื่อเริ่มบันทึกการเติบโต<br>และใช้งานระบบแจ้งเตือนรดน้ำ
                    </p>
                    <a href="register.html" style="
                        background: #4CAF50; color: white; 
                        padding: 10px 20px; border-radius: 20px; 
                        text-decoration: none; font-weight: bold;
                        display: inline-block; transition: 0.3s;">
                        สมัครสมาชิกฟรี
                    </a>
                </div>
            `;
            gridContainer.appendChild(promoCard);
        }

        if (!data || data.length === 0) {
            // Show "Not Found" message
            if (data.length === 0 && (user || searchInput.value)) {
                const msg = document.createElement('p');
                msg.style.color = '#888';
                msg.style.gridColumn = '1/-1';
                msg.style.textAlign = 'center';
                msg.textContent = 'ไม่พบข้อมูลผัก';
                gridContainer.appendChild(msg);
            }
            return;
        }

        data.forEach(veg => {
            // Format Array Data
            const waterStr = Array.isArray(veg.water) ? veg.water.join('/') : veg.water;
            
            // Image handling from Server
            const imgUrl = veg.image || 'https://via.placeholder.com/300?text=No+Image';

            const card = document.createElement('div');
            card.className = 'veg-card';
            // Send ID to detail page
            card.onclick = () => {
                window.location.href = `plant-detail.html?id=${veg.id}`;
            };

            card.innerHTML = `
                <div class="veg-img-container">
                    <img src="${imgUrl}" alt="${veg.name}" class="veg-img" onerror="this.src='https://via.placeholder.com/300?text=No+Image'">
                </div>
                <div class="veg-content">
                    <div class="veg-header">
                        <h3 class="veg-name">${veg.name}</h3>
                    </div>
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

    // 5. Initial Render
    loadVegetables();

    // 6. Search Logic
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            loadVegetables(e.target.value);
        });
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