/**
 * profile.js 
 * - จัดการข้อมูลโปรไฟล์ (View/Edit)
 * - จัดการรูปภาพ (Upload) พร้อมระบบรูปสำรองเป็นโลโก้เว็บ (/images/logo.png)
 * - ⭐ ปรับปรุง: เรียกใช้ Master Logic จาก watering.js สำหรับระบบแจ้งเตือนรดน้ำ ⭐
 * - ควบคุม Header Dropdown มุมขวาบน (เรียบเนียน ไม่มีไอคอน/จุด)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ⭐ กำหนดพาธโลโก้เว็บสำหรับใช้เป็นรูปสำรอง ⭐
    const DEFAULT_LOGO = '/images/logo.png';

    // ==========================================
    // 1. Auth Guard & Initial Data
    // ==========================================
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    const currentUser = JSON.parse(storedUser);

    // ==========================================
    // 2. Setup Header & Master Notification Logic
    // ==========================================
    // ตั้งค่าส่วนหัว (Header)
    setupHeaderProfile(currentUser, DEFAULT_LOGO);
    
    // ⭐ CENTRALIZED WATERING CHECK (Master Logic) ⭐
    // เรียกใช้ฟังก์ชันจาก watering.js เพื่ออัปเดต Badge และเช็ค Pop-up เพียงจุดเดียว
    // 🔴 แก้ไข: เปลี่ยน true เป็น false เพื่อป้องกัน Popup เด้งรบกวนทุกครั้งที่โหลดหน้า
    if (window.syncWateringStatus) {
        await window.syncWateringStatus(currentUser.email, false);
    }

    // ==========================================
    // 3. Load Profile Page Data (แสดงข้อมูลในหน้า Profile)
    // ==========================================
    await loadProfileData(currentUser.email, DEFAULT_LOGO);

    // ==========================================
    // 4. Event Listeners
    // ==========================================
    
    // ปุ่มเลือกรูปภาพ
    const profileUpload = document.getElementById('profileUpload');
    if (profileUpload) {
        profileUpload.addEventListener('change', (e) => handleImageUpload(e, currentUser.email, DEFAULT_LOGO));
    }
    
    // ฟอร์มบันทึกการแก้ไขข้อมูล
    const updateForm = document.getElementById('updateProfileForm');
    if (updateForm) {
        updateForm.addEventListener('submit', (e) => handleProfileUpdate(e, currentUser.email));
    }

    // ==========================================
    // 5. Mobile Menu Logic (Sidebar)
    // ==========================================
    setupMobileMenu();
});

// ==========================================
// 📥 Functions: Load & Render
// ==========================================

/**
 * ดึงข้อมูลโปรไฟล์และสถิติจาก Server มาแสดงในหน้า Profile
 */
async function loadProfileData(email, defaultLogo) {
    try {
        const res = await fetch(`/api/profile?email=${email}`);
        const data = await res.json();
        
        if (res.ok) {
            const { user, stats } = data;

            // --- ฝั่งซ้าย (Card โปรไฟล์) ---
            if (document.getElementById('displayHugeName')) document.getElementById('displayHugeName').textContent = user.name;
            if (document.getElementById('displayRole')) document.getElementById('displayRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
            if (document.getElementById('displayEmailSmall')) document.getElementById('displayEmailSmall').textContent = user.email;
            
            const dateObj = new Date(user.created_at);
            const joinDate = dateObj.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            if (document.getElementById('displayJoinDate')) document.getElementById('displayJoinDate').textContent = joinDate;
            
            if (document.getElementById('displayTotalPlants')) document.getElementById('displayTotalPlants').textContent = stats.total || 0;

            // แสดงรูปในหน้า Profile (Fallback เป็นโลโก้เว็บ)
            const imgDisplay = document.getElementById('profileImageDisplay');
            if (imgDisplay) {
                imgDisplay.src = user.image_url || defaultLogo;
                imgDisplay.onerror = () => { imgDisplay.src = defaultLogo; };
            }

            // --- ฝั่งขวา (View Mode) ---
            if (document.getElementById('displayName')) document.getElementById('displayName').textContent = user.name;
            if (document.getElementById('displayEmail')) document.getElementById('displayEmail').textContent = user.email;

            // สถิติ 4 ช่อง
            safeSetText('statGrowing', stats.growing || 0);
            safeSetText('statTotal', stats.total || 0);
            safeSetText('statReady', stats.ready || 0);
            safeSetText('statHarvested', stats.harvested || 0);
            safeSetText('bannerTotal', stats.total || 0);

            if (document.getElementById('editName')) document.getElementById('editName').value = user.name;
        }
    } catch (err) {
        console.error("Load Profile Error:", err);
    }
}

/**
 * ตั้งค่า Header Profile (มุมขวาบน) และระบบ Dropdown
 */
function setupHeaderProfile(user, defaultLogo) {
    const headerName = document.getElementById('headerUserName');
    const headerAvatar = document.getElementById('userAvatarHeader');
    const menuName = document.getElementById('menuUserName');
    const menuRole = document.getElementById('menuUserRole');
    const profileTrigger = document.getElementById('profileTrigger');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const logoutBtn = document.getElementById('logoutBtnHeader');

    if (user) {
        if (headerName) headerName.textContent = user.name;
        if (menuName) menuName.textContent = user.name;
        if (menuRole) menuUserRole.textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';

        if (headerAvatar) {
            const profileImg = user.image_url || defaultLogo;
            headerAvatar.innerHTML = `
                <img src="${profileImg}" 
                     onerror="this.src='${defaultLogo}'" 
                     style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }

        if (profileTrigger && dropdownMenu) {
            profileTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdownMenu.classList.toggle('active');
            });
            window.addEventListener('click', () => dropdownMenu.classList.remove('active'));
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('คุณต้องการออกจากระบบหรือไม่?')) {
                    localStorage.removeItem('easygrowUser');
                    window.location.href = 'login.html';
                }
            });
        }

        if (user.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
        }
    }
}

/**
 * สลับโหมด แก้ไข / ดูข้อมูล
 */
window.toggleEditMode = function(showEdit) {
    const view = document.getElementById('viewMode');
    const edit = document.getElementById('editMode');
    if (view) view.style.display = showEdit ? 'none' : 'block';
    if (edit) edit.style.display = showEdit ? 'block' : 'none';
}

// ==========================================
// 📤 Functions: Update & Upload
// ==========================================

async function handleImageUpload(e, email, defaultLogo) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('profileImage', file);
    formData.append('email', email);

    try {
        const res = await fetch('/api/profile/upload-image', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (res.ok) {
            alert('อัปโหลดรูปสำเร็จ!');
            const mainImg = document.getElementById('profileImageDisplay');
            if (mainImg) {
                mainImg.src = data.imageUrl;
                mainImg.onerror = () => { mainImg.src = defaultLogo; };
            }
            const headerAvatar = document.getElementById('userAvatarHeader');
            if (headerAvatar) {
                headerAvatar.innerHTML = `
                    <img src="${data.imageUrl}" onerror="this.src='${defaultLogo}'" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            }
            const storedUser = JSON.parse(localStorage.getItem('easygrowUser'));
            storedUser.image_url = data.imageUrl;
            localStorage.setItem('easygrowUser', JSON.stringify(storedUser));
        } else {
            alert('อัปโหลดล้มเหลว: ' + (data.error || 'Unknown error'));
        }
    } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
}

async function handleProfileUpdate(e, email) {
    e.preventDefault();
    const name = document.getElementById('editName').value;
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword && newPassword !== confirmNewPassword) {
        alert('รหัสผ่านใหม่ไม่ตรงกัน');
        return;
    }
    if (newPassword && !currentPassword) {
        alert('กรุณาใส่รหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยน');
        return;
    }

    try {
        const res = await fetch('/api/profile/update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, currentPassword, newPassword })
        });
        const result = await res.json();

        if (res.ok) {
            alert('บันทึกข้อมูลสำเร็จ');
            const storedUser = JSON.parse(localStorage.getItem('easygrowUser'));
            storedUser.name = name;
            localStorage.setItem('easygrowUser', JSON.stringify(storedUser));
            location.reload(); 
        } else {
            alert(result.error || 'บันทึกไม่สำเร็จ');
        }
    } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    }
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

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