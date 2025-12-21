/**
 * library.js (ฉบับสมบูรณ์: ย้ายเมนูไปขวาบน + รูปต้นอ่อนเริ่มต้น + ระบบโปรโมท)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Authentication
    const storedUser = localStorage.getItem('easygrowUser');
    let user = null;
    if (storedUser) {
        try {
            user = JSON.parse(storedUser);
        } catch (e) {
            localStorage.removeItem('easygrowUser');
        }
    }

    // 2. Element Selection
    const headerProfile = document.getElementById('headerProfile');
    const promoActions = document.getElementById('promoActions');
    const gridContainer = document.getElementById('vegetableGrid');
    const searchInput = document.getElementById('searchInput');

    // เส้นทางรูปภาพต้นอ่อน (โลโก้เว็บ) สำหรับใช้เป็นรูปเริ่มต้น
    const sproutIcon = "/images/logo.png"; 

    // ============================================================
    // 3. Setup Top Header & Profile (ย้ายมาจาก Sidebar)
    // ============================================================
    function setupHeader() {
        if (!headerProfile) return;

        if (user) {
            // กรณีเป็นสมาชิก: แสดงชื่อ, บทบาท และรูปโปรไฟล์ (ถ้าไม่มีใช้ต้นอ่อน)
            const avatarUrl = user.image_url ? user.image_url : sproutIcon;
            
            headerProfile.innerHTML = `
                <div class="user-info-top">
                    <h4>${user.name || 'ชาวสวน'}</h4>
                    <span>${user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน'}</span>
                </div>
                <div class="profile-avatar-top" onclick="window.location.href='profile.html'">
                    <img src="${avatarUrl}" alt="Profile" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <button id="logoutBtnTop" class="btn-logout-top" title="ออกจากระบบ">ออก</button>
            `;

            // เพิ่ม Event ออกจากระบบ
            document.getElementById('logoutBtnTop').onclick = () => {
                if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                    localStorage.removeItem('easygrowUser');
                    window.location.href = 'index.html';
                }
            };

            // ซ่อนเมนู Admin ใน Sidebar ถ้าไม่ใช่ Admin
            if (user.role !== 'admin') {
                document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            }
        } else {
            // กรณีผู้เยี่ยมชม: แสดงปุ่มเข้าสู่ระบบ และปุ่มสมัครใน Banner
            headerProfile.innerHTML = `
                <a href="index.html" style="text-decoration:none; color:#4CAF50; font-weight:bold; font-size:0.9rem;">เข้าสู่ระบบ</a>
            `;
            
            if (promoActions) {
                promoActions.innerHTML = `
                    <a href="register.html" class="btn-promo-reg">เข้าร่วมสมาชิกฟรี</a>
                `;
            }
            
            // ซ่อนเมนู Admin สำหรับ Guest
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }
    }

    // ============================================================
    // 4. Load Data from Server
    // ============================================================
    async function loadVegetables(filterText = '') {
        try {
            const response = await fetch('/api/vegetables');
            if (!response.ok) throw new Error('Network Error');
            
            const vegetables = await response.json();

            // กรองข้อมูลตามที่พิมพ์ในช่องค้นหา
            const filtered = vegetables.filter(veg => 
                veg.name.toLowerCase().includes(filterText.toLowerCase())
            );

            renderVegetables(filtered);

        } catch (error) {
            console.error('Error loading vegetables:', error);
            if (gridContainer) {
                gridContainer.innerHTML = `<p style="text-align:center; color:red; grid-column:1/-1;">ไม่สามารถโหลดข้อมูลได้ในขณะนี้</p>`;
            }
        }
    }

    // ============================================================
    // 5. Function Render Cards
    // ============================================================
    function renderVegetables(data) {
        if (!gridContainer) return;
        gridContainer.innerHTML = ''; 

        if (!data || data.length === 0) {
            gridContainer.innerHTML = '<p style="color:#888; grid-column:1/-1; text-align:center; padding:40px;">ไม่พบข้อมูลผักที่คุณค้นหา</p>';
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

    // ============================================================
    // 6. Initial Actions & Search Listener
    // ============================================================
    setupHeader();
    loadVegetables();

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            loadVegetables(e.target.value);
        });
    }
});

// ==========================================
// 🍔 Mobile Menu Logic (Sidebar Toggle)
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