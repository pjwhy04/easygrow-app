document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { window.location.href = 'index.html'; return; }
    const currentUser = JSON.parse(storedUser);

    // 2. Setup Sidebar (เรียกฟังก์ชันที่ปรับปรุงแล้ว)
    setupSidebar(currentUser);

    // 3. Fetch Profile Data (ดึงข้อมูลล่าสุดจาก Server)
    await loadProfileData(currentUser.email);

    // 4. Event Listeners
    // ปุ่มอัปโหลดรูป
    const profileUpload = document.getElementById('profileUpload');
    if (profileUpload) {
        profileUpload.addEventListener('change', (e) => handleImageUpload(e, currentUser.email));
    }
    
    // ฟอร์มแก้ไขข้อมูล
    const updateForm = document.getElementById('updateProfileForm');
    if (updateForm) {
        updateForm.addEventListener('submit', (e) => handleProfileUpdate(e, currentUser.email));
    }

    // ปุ่ม Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if(confirm('ออกจากระบบ?')) { localStorage.removeItem('easygrowUser'); window.location.href='index.html'; }
    });

    // ==========================================
    // 🍔 Mobile Menu Logic (รวมไว้ที่นี่เลย)
    // ==========================================
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

// ==========================================
// 📥 Functions: Load & Render
// ==========================================

async function loadProfileData(email) {
    try {
        const res = await fetch(`/api/profile?email=${email}`);
        const data = await res.json();
        
        if (res.ok) {
            const { user, stats } = data;

            // --- Left Card ---
            document.getElementById('displayHugeName').textContent = user.name;
            document.getElementById('displayRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน';
            document.getElementById('displayEmailSmall').textContent = user.email;
            
            const joinDate = new Date(user.created_at).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            document.getElementById('displayJoinDate').textContent = joinDate;
            
            document.getElementById('displayTotalPlants').textContent = stats.total || 0;

            // Image Handling (แสดงรูปในหน้า Profile)
            const imgDisplay = document.getElementById('profileImageDisplay');
            if (user.image_url) {
                imgDisplay.src = user.image_url;
                // อัปเดตรูปใน Sidebar ด้วย (เผื่อรูปเปลี่ยนแต่ยังไม่ได้รีเฟรช)
                updateSidebarImage(user.image_url);
            } else {
                imgDisplay.src = 'https://via.placeholder.com/150?text=User';
            }

            // --- Right Card (View Mode) ---
            document.getElementById('displayName').textContent = user.name;
            document.getElementById('displayEmail').textContent = user.email;

            // Stats
            document.getElementById('statGrowing').textContent = stats.growing || 0;
            document.getElementById('statTotal').textContent = stats.total || 0;
            document.getElementById('statReady').textContent = stats.ready || 0;
            document.getElementById('statHarvested').textContent = stats.harvested || 0;
            document.getElementById('bannerTotal').textContent = stats.total || 0;

            // Setup Edit Form Values
            document.getElementById('editName').value = user.name;
        }
    } catch (err) {
        console.error("Load Profile Error:", err);
    }
}

// Helper: สลับหน้าแก้ไข/ดูข้อมูล
window.toggleEditMode = function(showEdit) {
    document.getElementById('viewMode').style.display = showEdit ? 'none' : 'block';
    document.getElementById('editMode').style.display = showEdit ? 'block' : 'none';
}

// Helper: แสดงผล Sidebar (ชื่อ + รูป)
function setupSidebar(user) {
    document.getElementById('sidebarUserName').textContent = user.name || 'ผู้ใช้งาน';
    document.getElementById('sidebarUserRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
    
    // จัดการรูปภาพใน Sidebar
    updateSidebarImage(user.image_url, user.name);

    // Show/Hide Admin menus
    if (user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

// Helper: อัปเดต HTML ของรูปภาพใน Sidebar
function updateSidebarImage(imageUrl, name) {
    // ⭐ แก้ตรงนี้: ให้มันหาทั้ง userAvatar (หน้าทั่วไป) หรือ sidebarAvatar (หน้า Profile)
    const avatarEl = document.getElementById('userAvatar') || document.getElementById('sidebarAvatar');
    
    if (!avatarEl) return;

    if (imageUrl) {
        // ใส่รูปภาพ
        avatarEl.innerHTML = `<img src="${imageUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatarEl.style.backgroundColor = 'transparent'; 
        avatarEl.style.border = '2px solid #fff'; // เพิ่มขอบขาวนิดนึงจะได้สวย
    } else {
        // ถ้าไม่มีรูป ให้ใส่ตัวอักษรแรก
        avatarEl.innerHTML = ''; 
        avatarEl.textContent = name ? name.charAt(0).toUpperCase() : 'U';
        avatarEl.style.backgroundColor = '#ddd';
    }
}

// ==========================================
// 📤 Functions: Update & Upload
// ==========================================

async function handleImageUpload(e, email) {
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
            
            // 1. เปลี่ยนรูปในหน้าจอทันที
            document.getElementById('profileImageDisplay').src = data.imageUrl;
            updateSidebarImage(data.imageUrl);

            // ⭐ 2. สำคัญ: อัปเดต LocalStorage เพื่อให้หน้าอื่นเห็นรูปด้วย ⭐
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
        alert('กรุณาใส่รหัสผ่านปัจจุบันเพื่อยืนยัน');
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
            
            // อัปเดตชื่อใน LocalStorage
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