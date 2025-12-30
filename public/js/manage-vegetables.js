/**
 * manage-vegetables.js
 * - จัดการข้อมูลผัก (CRUD) สำหรับผู้ดูแลระบบ
 * - ⭐ ปรับปรุง: เรียกใช้ Master Logic จาก watering.js สำหรับระบบแจ้งเตือนรดน้ำ ⭐
 * - ย้ายส่วนโปรไฟล์ไปที่ Top Header Dropdown พร้อมรูปสำรอง (Logo)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // ⭐ กำหนดพาธโลโก้เว็บสำหรับใช้เป็นรูปสำรอง ⭐
    const webLogo = '/images/logo.png';

    // ==========================================
    // 1. Auth Guard & Admin Check
    // ==========================================
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { 
        window.location.href = 'login.html'; 
        return; 
    }
    const user = JSON.parse(storedUser);
    
    if (user.role !== 'admin') { 
        alert('เข้าถึงถูกปฏิเสธ: สำหรับผู้ดูแลระบบเท่านั้น'); 
        window.location.href = 'dashboard.html'; 
        return; 
    }

    // ==========================================
    // 2. Top Header & Dropdown Setup (ส่วนโปรไฟล์)
    // ==========================================
    setupHeaderUI(user, webLogo);

    // ==========================================
    // ⭐ 3. CENTRALIZED WATERING CHECK (Master Logic) ⭐
    // ==========================================
    // เรียกใช้ฟังก์ชันจาก watering.js เพื่ออัปเดต Badge และเช็ค Pop-up เพียงจุดเดียว
    // 🔴 แก้ไข: เปลี่ยน true เป็น false เพื่อหยุดการบังคับ Pop-up เด้งทุกครั้ง
    if (window.syncWateringStatus) {
        await window.syncWateringStatus(user.email, false);
    }

    // ==========================================
    // 4. จัดการข้อมูลผัก (Vegetable Management)
    // ==========================================
    let allVegetables = []; 
    const tableBody = document.getElementById('vegTableBody');
    const searchInput = document.getElementById('searchVeg');

    async function fetchAndRender(filterText = '') {
        try {
            const response = await fetch('/api/vegetables');
            if (!response.ok) throw new Error('Network Error');
            allVegetables = await response.json();
            renderTable(allVegetables, filterText);
        } catch (error) {
            console.error('Error loading vegetables:', error);
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center; padding:20px;">ไม่สามารถโหลดข้อมูลได้</td></tr>`;
        }
    }

    function renderTable(data, filterText) {
        if (!tableBody) return;
        tableBody.innerHTML = '';
        const filtered = data.filter(v => v.name.toLowerCase().includes(filterText.toLowerCase()));

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">ไม่พบข้อมูลผัก</td></tr>';
            return;
        }

        filtered.forEach(veg => {
            const tr = document.createElement('tr');
            const waterDisplay = Array.isArray(veg.water) ? veg.water.join(', ') : veg.water;
            const regionDisplay = Array.isArray(veg.regions) ? veg.regions.join(', ') : veg.regions;
            
            const vegImgPath = veg.image ? veg.image : webLogo;
            const imgTag = `<img src="${vegImgPath}" onerror="this.src='${webLogo}'" class="table-img" style="width:40px; height:40px; object-fit:cover; border-radius:50%; vertical-align:middle; margin-right:12px; border: 1px solid #eee;">`;

            tr.innerHTML = `
                <td style="font-weight: 500;">${imgTag}${veg.name}</td>
                <td>${veg.harvest_time} วัน</td> 
                <td>${waterDisplay}</td>
                <td>${veg.months}</td>
                <td>${regionDisplay}</td>
                <td>
                    <button class="action-btn" onclick="editVeg(${veg.id})" title="แก้ไข" style="margin-right:5px;">✏️</button>
                    <button class="action-btn btn-delete" onclick="deleteVeg(${veg.id})" title="ลบ">🗑️</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    fetchAndRender();
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderTable(allVegetables, e.target.value));
    }

    // ==========================================
    // 5. Modal & Form Handling
    // ==========================================
    const modal = document.getElementById('vegModal');
    const form = document.getElementById('vegForm');
    const modalTitle = document.getElementById('modalTitle');
    
    const btnAddVeg = document.getElementById('btnAddVeg');
    if (btnAddVeg) {
        btnAddVeg.addEventListener('click', () => {
            if(form) form.reset();
            document.getElementById('vegId').value = ''; 
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
            modalTitle.textContent = 'เพิ่มข้อมูลผักใหม่';
            modal.style.display = 'flex';
        });
    }

    const closeModal = () => { if(modal) modal.style.display = 'none'; };
    if (document.getElementById('closeModal')) document.getElementById('closeModal').onclick = closeModal;
    if (document.getElementById('btnCancel')) document.getElementById('btnCancel').onclick = closeModal;

    window.editVeg = function(id) {
        const veg = allVegetables.find(v => v.id === id);
        if (!veg) return;
        document.getElementById('vegId').value = veg.id;
        document.getElementById('vegName').value = veg.name;
        document.getElementById('vegHarvest').value = veg.harvest_time;
        document.getElementById('vegSun').value = veg.sunlight;
        document.getElementById('vegMonths').value = veg.months;
        document.getElementById('vegDesc').value = veg.description || '';
        
        // แปลง Array กลับเป็น Comma String สำหรับแสดงใน Textarea
        document.getElementById('vegSteps').value = Array.isArray(veg.steps) ? veg.steps.join(', ') : (veg.steps || '');
        document.getElementById('vegMoreTips').value = Array.isArray(veg.moreTips) ? veg.moreTips.join(', ') : (veg.moreTips || '');

        const checkBoxes = (name, values) => {
            document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
                cb.checked = (values || []).includes(cb.value);
            });
        };
        checkBoxes('waterTime', Array.isArray(veg.water) ? veg.water : []);
        checkBoxes('region', Array.isArray(veg.regions) ? veg.regions : []);
        
        modalTitle.textContent = 'แก้ไขข้อมูลผัก';
        modal.style.display = 'flex';
    };

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('vegId').value;
            const formData = new FormData();
            
            const getChecked = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);

            formData.append('name', document.getElementById('vegName').value);
            formData.append('harvestTime', document.getElementById('vegHarvest').value);
            formData.append('sunlight', document.getElementById('vegSun').value);
            formData.append('months', document.getElementById('vegMonths').value);
            formData.append('description', document.getElementById('vegDesc').value);
            
            // ⭐ ป้องกันดาต้าเบสพัง: แปลงข้อมูลเป็น JSON Array ให้ถูกต้อง
            formData.append('water', JSON.stringify(getChecked('waterTime')));
            formData.append('regions', JSON.stringify(getChecked('region')));
            
            const toArray = (str) => str.split(',').map(s => s.trim()).filter(s => s !== '');
            formData.append('steps', JSON.stringify(toArray(document.getElementById('vegSteps').value)));
            formData.append('moreTips', JSON.stringify(toArray(document.getElementById('vegMoreTips').value)));

            const fileInput = document.getElementById('vegImageFile');
            if (fileInput && fileInput.files[0]) formData.append('imageFile', fileInput.files[0]);

            try {
                const btn = form.querySelector('.btn-submit');
                const originalText = btn.textContent;
                btn.textContent = 'กำลังบันทึก...'; btn.disabled = true;

                const url = id ? `/api/vegetables/${id}` : '/api/vegetables';
                const method = id ? 'PUT' : 'POST';
                const res = await fetch(url, { method: method, body: formData });

                if (res.ok) {
                    alert(id ? 'แก้ไขข้อมูลเรียบร้อย!' : 'เพิ่มข้อมูลเรียบร้อย!');
                    closeModal(); fetchAndRender(); 
                } else {
                    const err = await res.json(); alert('ข้อผิดพลาด: ' + (err.error || 'Unknown'));
                }
                btn.textContent = originalText; btn.disabled = false;
            } catch (error) { alert('ติดต่อเซิร์ฟเวอร์ไม่ได้'); }
        });
    }

    window.deleteVeg = async function(id) {
        if (confirm('ยืนยันการลบ? ข้อมูลจะไม่สามารถกู้คืนได้')) {
            try {
                const res = await fetch(`/api/vegetables/${id}`, { method: 'DELETE' });
                if (res.ok) { alert('ลบเรียบร้อย'); fetchAndRender(); }
            } catch (error) { alert('ติดต่อเซิร์ฟเวอร์ไม่ได้'); }
        }
    };

    // ==========================================
    // 6. Mobile Menu & Header UI Helpers
    // ==========================================
    function setupHeaderUI(user, webLogo) {
        const trigger = document.getElementById('profileTrigger');
        const menu = document.getElementById('dropdownMenu');
        const headerName = document.getElementById('headerUserName');
        const avatarHeader = document.getElementById('userAvatarHeader');
        const menuName = document.getElementById('menuUserName');
        const menuRole = document.getElementById('menuUserRole');
        const logoutBtn = document.getElementById('logoutBtnHeader');

        if (headerName) headerName.textContent = user.name || 'ผู้ดูแลระบบ';
        if (menuName) menuName.textContent = user.name || 'Admin';
        if (menuRole) menuRole.textContent = 'ผู้ดูแลระบบ';

        if (avatarHeader) {
            const profileImg = user.image_url ? user.image_url : webLogo;
            avatarHeader.innerHTML = `<img src="${profileImg}" onerror="this.src='${webLogo}'" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        }

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

    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar && mobileOverlay) {
        const toggleMenu = () => { sidebar.classList.toggle('active'); mobileOverlay.classList.toggle('active'); };
        mobileBtn.onclick = toggleMenu;
        mobileOverlay.onclick = toggleMenu;
    }
});