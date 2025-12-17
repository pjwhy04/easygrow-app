document.addEventListener('DOMContentLoaded', () => {

    // 1. Auth Guard
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { window.location.href = 'index.html'; return; }
    
    const user = JSON.parse(storedUser);
    
    // ตรวจสอบว่าเป็น Admin หรือไม่
    if (user.role !== 'admin') { 
        alert('Access Denied'); 
        window.location.href = 'dashboard.html'; 
        return; 
    }

    // ==========================================
    // Sidebar Info (แก้ไขให้โชว์รูปโปรไฟล์)
    // ==========================================
    document.getElementById('sidebarUserName').textContent = user.name;
    document.getElementById('sidebarUserRole').textContent = 'ผู้ดูแลระบบ';

    // ⭐ ส่วนที่แก้ไข: แสดงรูปโปรไฟล์ถ้ามี ⭐
    const avatarEl = document.getElementById('userAvatar');
    if (user.image_url) {
        avatarEl.innerHTML = `<img src="${user.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatarEl.style.backgroundColor = 'transparent'; // ลบสีพื้นหลังเดิมออก
    } else {
        avatarEl.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if(confirm('ออกจากระบบ?')) { 
            localStorage.removeItem('easygrowUser'); 
            window.location.href = 'index.html'; 
        }
    });

    // ==========================================
    // 2. ตัวแปร Global เก็บข้อมูลผัก
    // ==========================================
    let allVegetables = []; // เก็บไว้ใช้ตอนกด Edit จะได้ไม่ต้อง Fetch ใหม่

    const tableBody = document.getElementById('vegTableBody');
    const searchInput = document.getElementById('searchVeg');

    async function fetchAndRender(filterText = '') {
        try {
            const response = await fetch('/api/vegetables');
            if (!response.ok) throw new Error('Network Error');
            
            allVegetables = await response.json(); // เก็บลงตัวแปร Global
            renderTable(allVegetables, filterText);

        } catch (error) {
            console.error('Error:', error);
            tableBody.innerHTML = `<tr><td colspan="6" style="color:red; text-align:center;">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
        }
    }

    function renderTable(data, filterText) {
        tableBody.innerHTML = '';
        const filtered = data.filter(v => v.name.toLowerCase().includes(filterText.toLowerCase()));

        if (filtered.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 20px;">ไม่พบข้อมูล</td></tr>';
            return;
        }

        filtered.forEach(veg => {
            const tr = document.createElement('tr');
            
            const waterDisplay = Array.isArray(veg.water) ? veg.water.join(', ') : veg.water;
            const regionDisplay = Array.isArray(veg.regions) ? veg.regions.join(', ') : veg.regions;
            // รูปในตาราง
            const imgTag = veg.image ? `<img src="${veg.image}" style="width:40px; height:40px; object-fit:cover; border-radius:50%; vertical-align:middle; margin-right:10px;">` : '';

            tr.innerHTML = `
                <td style="font-weight: 500;">${imgTag}${veg.name}</td>
                <td>${veg.harvest_time}</td> 
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
    searchInput.addEventListener('input', (e) => renderTable(allVegetables, e.target.value));

    // ==========================================
    // 3. จัดการ Modal (เพิ่ม & แก้ไข)
    // ==========================================
    const modal = document.getElementById('vegModal');
    const form = document.getElementById('vegForm');
    const modalTitle = document.getElementById('modalTitle');
    
    // เปิด Modal เพิ่มใหม่
    document.getElementById('btnAddVeg').addEventListener('click', () => {
        form.reset();
        document.getElementById('vegId').value = ''; // เคลียร์ ID
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
        modalTitle.textContent = 'เพิ่มข้อมูลผักใหม่';
        modal.style.display = 'flex';
    });

    // ปิด Modal
    const closeModal = () => modal.style.display = 'none';
    document.getElementById('closeModal').onclick = closeModal;
    document.getElementById('btnCancel').onclick = closeModal;

    // ฟังก์ชัน Edit (ดึงข้อมูลมาใส่ฟอร์ม)
    window.editVeg = function(id) {
        const veg = allVegetables.find(v => v.id === id);
        if (!veg) return;

        // 1. ใส่ข้อมูล Text
        document.getElementById('vegId').value = veg.id;
        document.getElementById('vegName').value = veg.name;
        document.getElementById('vegHarvest').value = veg.harvest_time;
        document.getElementById('vegSun').value = veg.sunlight;
        document.getElementById('vegMonths').value = veg.months;
        document.getElementById('vegDesc').value = veg.description || '';
        document.getElementById('vegSteps').value = Array.isArray(veg.steps) ? veg.steps.join(', ') : veg.steps;
        document.getElementById('vegMoreTips').value = Array.isArray(veg.moreTips) ? veg.moreTips.join(', ') : veg.moreTips;

        // 2. ติ๊ก Checkbox (Water & Regions)
        const checkBoxes = (name, values) => {
            document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
                cb.checked = values.includes(cb.value);
            });
        };
        checkBoxes('waterTime', Array.isArray(veg.water) ? veg.water : []);
        checkBoxes('region', Array.isArray(veg.regions) ? veg.regions : []);

        // 3. ปรับ UI
        modalTitle.textContent = 'แก้ไขข้อมูลผัก';
        modal.style.display = 'flex';
    };

    // Submit Form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('vegId').value;
        const formData = new FormData();

        // Helper เก็บค่า Checkbox
        const getChecked = (name) => Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(cb => cb.value);

        formData.append('name', document.getElementById('vegName').value);
        formData.append('harvestTime', document.getElementById('vegHarvest').value);
        formData.append('sunlight', document.getElementById('vegSun').value);
        formData.append('months', document.getElementById('vegMonths').value);
        formData.append('description', document.getElementById('vegDesc').value);
        
        formData.append('water', JSON.stringify(getChecked('waterTime')));
        formData.append('regions', JSON.stringify(getChecked('region')));
        
        const stepsArr = document.getElementById('vegSteps').value.split(',').map(s=>s.trim()).filter(s=>s!=='');
        formData.append('steps', JSON.stringify(stepsArr));

        const tipsArr = document.getElementById('vegMoreTips').value.split(',').map(s=>s.trim()).filter(s=>s!=='');
        formData.append('moreTips', JSON.stringify(tipsArr));

        const fileInput = document.getElementById('vegImageFile');
        if (fileInput && fileInput.files[0]) {
            formData.append('imageFile', fileInput.files[0]);
        }

        try {
            const btn = form.querySelector('.btn-submit');
            const originalText = btn.textContent;
            btn.textContent = 'กำลังบันทึก...';
            btn.disabled = true;

            // เช็คว่า เพิ่ม (POST) หรือ แก้ไข (PUT)
            const url = id ? `/api/vegetables/${id}` : '/api/vegetables';
            const method = id ? 'PUT' : 'POST';
            
            const res = await fetch(url, {
                method: method,
                body: formData 
            });

            if (res.ok) {
                alert(id ? 'แก้ไขข้อมูลเรียบร้อย!' : 'เพิ่มข้อมูลเรียบร้อย!');
                modal.style.display = 'none';
                fetchAndRender(); 
            } else {
                const errData = await res.json();
                alert('เกิดข้อผิดพลาด: ' + (errData.error || 'Unknown Error'));
            }
            
            btn.textContent = originalText;
            btn.disabled = false;

        } catch (error) {
            console.error(error);
            alert('ติดต่อเซิร์ฟเวอร์ไม่ได้');
        }
    });

    // Delete Logic
    window.deleteVeg = async function(id) {
        if(confirm('ยืนยันการลบข้อมูลนี้?')) {
            try {
                const res = await fetch(`/api/vegetables/${id}`, { method: 'DELETE' });
                if (res.ok) { alert('ลบข้อมูลเรียบร้อย'); fetchAndRender(); }
            } catch (error) { alert('ติดต่อเซิร์ฟเวอร์ไม่ได้'); }
        }
    };
});