/**
 * planting-log.js
 * - รองรับการเพิ่ม/แก้ไข/ลบ (CRUD)
 * - รองรับการแสดงรูปโปรไฟล์ใน Sidebar
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Guard (ตรวจสอบสิทธิ์การเข้าใช้งาน)
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(storedUser);
    
    // ==========================================
    // 2. Sidebar Setup (แสดงชื่อและรูปโปรไฟล์)
    // ==========================================
    document.getElementById('sidebarUserName').textContent = user.name || 'ผู้ใช้งาน';
    document.getElementById('sidebarUserRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
    
    // ⭐ ส่วนที่แก้ไข: แสดงรูปโปรไฟล์ถ้ามี ⭐
    const avatarEl = document.getElementById('userAvatar');
    if (user.image_url) {
        avatarEl.innerHTML = `<img src="${user.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatarEl.style.backgroundColor = 'transparent';
    } else {
        avatarEl.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    }

    // ซ่อนเมนู Admin ถ้าไม่ใช่ Admin
    if (user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    // ปุ่มออกจากระบบ
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
            localStorage.removeItem('easygrowUser');
            window.location.href = 'index.html';
        }
    });

    // ==========================================
    // 3. Load Vegetables & Helper Functions
    // ==========================================
    let availableVegetables = [];
    let allUserLogs = []; // เก็บข้อมูล Log ทั้งหมดไว้ตัวแปร Global

    try {
        const res = await fetch('/api/vegetables');
        if (res.ok) availableVegetables = await res.json();
    } catch (error) { console.error('Failed to load vegetables:', error); }

    const vegSelect = document.getElementById('vegSelect');
    if (vegSelect) {
        vegSelect.innerHTML = '<option value="">-- กรุณาเลือกผัก --</option>';
        availableVegetables.forEach(veg => {
            const option = document.createElement('option');
            option.value = veg.id;
            option.textContent = veg.name;
            vegSelect.appendChild(option);
        });
    }

    function extractDays(timeStr) {
        if (!timeStr) return 60;
        const match = timeStr.match(/(\d+)/);
        return match ? parseInt(match[0]) : 60;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }

    // ==========================================
    // 4. Render Board (แสดงการ์ด + ปุ่ม Edit/Delete)
    // ==========================================
    async function renderBoard() {
        try {
            const res = await fetch(`/api/planting-log?email=${user.email}`);
            if (!res.ok) throw new Error('Fetch log failed');
            
            allUserLogs = await res.json(); // อัปเดตข้อมูลล่าสุด

            const cols = {
                'Planted': document.getElementById('col-planted'),
                'Growing': document.getElementById('col-growing'),
                'Ready': document.getElementById('col-ready'),
                'Harvested': document.getElementById('col-harvested')
            };
            
            // เคลียร์ข้อมูลเก่า
            Object.values(cols).forEach(col => { if(col) col.innerHTML = ''; });

            const counts = { 'Planted': 0, 'Growing': 0, 'Ready': 0, 'Harvested': 0 };

            allUserLogs.forEach(item => {
                const status = item.status || 'Planted';
                if (counts[status] !== undefined) counts[status]++;

                const card = document.createElement('div');
                card.className = 'plant-card';
                card.style.position = 'relative'; // เพื่อให้ปุ่มลอยมุมขวาได้

                const currentVeg = availableVegetables.find(v => v.id == item.vegetable_id);
                const harvestText = currentVeg ? currentVeg.harvest_time : '?';

                card.innerHTML = `
                    <div style="position:absolute; top:10px; right:10px; z-index:10;">
                        <button onclick="editEntry(${item.id})" style="border:none; background:none; cursor:pointer; font-size:1.1rem; margin-right:5px;" title="แก้ไข">✏️</button>
                        <button onclick="deleteEntry(${item.id})" style="border:none; background:none; cursor:pointer; font-size:1.1rem; color:#d32f2f;" title="ลบ">🗑️</button>
                    </div>

                    <div class="card-header">
                        <div class="card-icon">🌱</div>
                        <div>
                            <h3 class="card-title">${item.vegetable_name}</h3>
                            <span class="card-subtitle">ระยะเวลา: ${harvestText}</span>
                        </div>
                    </div>
                    <div class="card-details">
                        <div class="card-row"><span class="card-icon-small">📅</span> เริ่มปลูก: ${formatDate(item.planted_date)}</div>
                        <div class="card-row"><span class="card-icon-small">⏳</span> คาดว่าเก็บ: ${formatDate(item.expected_date)}</div>
                        <div class="card-row"><span class="card-icon-small">📍</span> สถานที่ปลูก: ${item.location || '-'}</div>
                        ${item.notes ? `<div class="card-row" style="font-style:italic; color:#888;">"${item.notes}"</div>` : ''}
                    </div>
                    <select class="status-select" onchange="updateStatus(${item.id}, this.value)">
                        <option value="Planted" ${status === 'Planted' ? 'selected' : ''}>🌱 เพิ่งปลูก</option>
                        <option value="Growing" ${status === 'Growing' ? 'selected' : ''}>📈 กำลังโต</option>
                        <option value="Ready" ${status === 'Ready' ? 'selected' : ''}>🧺 พร้อมเก็บ</option>
                        <option value="Harvested" ${status === 'Harvested' ? 'selected' : ''}>✅ เก็บแล้ว</option>
                    </select>
                `;

                if (cols[status]) cols[status].appendChild(card);
            });

            // Update Counts
            const safeUpdate = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
            safeUpdate('count-planted', counts['Planted']);
            safeUpdate('count-growing', counts['Growing']);
            safeUpdate('count-ready', counts['Ready']);
            safeUpdate('count-harvested', counts['Harvested']);
            safeUpdate('summary-total', allUserLogs.length);
            safeUpdate('summary-growing', counts['Growing']);
            safeUpdate('summary-ready', counts['Ready']);
            safeUpdate('summary-harvested', counts['Harvested']);

        } catch (error) { console.error('Error rendering board:', error); }
    }

    // ==========================================
    // 5. Update Status (เปลี่ยนสถานะ dropdown)
    // ==========================================
    window.updateStatus = async function(id, newStatus) {
        try {
            const res = await fetch(`/api/planting-log/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) renderBoard();
        } catch (error) { console.error(error); }
    };

    // ==========================================
    // 6. Delete Logic (ลบรายการ)
    // ==========================================
    window.deleteEntry = async function(id) {
        if(!confirm('คุณต้องการลบรายการนี้ใช่ไหม?')) return;
        try {
            const res = await fetch(`/api/planting-log/${id}`, { method: 'DELETE' });
            if (res.ok) {
                renderBoard(); // รีโหลดหน้าจอ
            } else {
                alert('ลบไม่สำเร็จ (กรุณาตรวจสอบ server.js)');
            }
        } catch (error) { console.error(error); alert('Error connecting server'); }
    };

    // ==========================================
    // 7. Edit Logic (เตรียมข้อมูลใส่ Modal)
    // ==========================================
    const modal = document.getElementById('entryModal');
    const form = document.getElementById('addEntryForm');
    const modalTitle = document.querySelector('.modal-header h2');
    
    const openModal = () => modal.style.display = 'flex';
    const closeModal = () => modal.style.display = 'none';

    // ปุ่มเปิด Modal (กรณีเพิ่มใหม่)
    document.getElementById('openModalBtn').onclick = () => {
        form.reset();
        document.getElementById('editEntryId').value = ''; // เคลียร์ ID
        document.getElementById('plantedDate').valueAsDate = new Date();
        modalTitle.textContent = 'เพิ่มข้อมูลการปลูกใหม่';
        openModal();
    };
    
    document.getElementById('closeModalBtn').onclick = closeModal;
    document.getElementById('cancelBtn').onclick = closeModal;

    // ปุ่มกด Edit จากการ์ด (กรณีแก้ไข)
    window.editEntry = function(id) {
        const item = allUserLogs.find(log => log.id === id);
        if (!item) return;

        // ใส่ข้อมูลเดิมลงในฟอร์ม
        document.getElementById('editEntryId').value = item.id;
        document.getElementById('vegSelect').value = item.vegetable_id;
        document.getElementById('location').value = item.location;
        document.getElementById('notes').value = item.notes;
        
        // จัดการวันที่ (ตัดเวลาออกเอาแค่ YYYY-MM-DD)
        const dateStr = item.planted_date ? item.planted_date.split('T')[0] : '';
        document.getElementById('plantedDate').value = dateStr;

        modalTitle.textContent = 'แก้ไขข้อมูลการปลูก';
        openModal();
    };

    // ==========================================
    // 8. Form Submit (บันทึกข้อมูล Add/Edit)
    // ==========================================
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editId = document.getElementById('editEntryId').value;
        const vegId = parseInt(document.getElementById('vegSelect').value);
        const plantedDateVal = document.getElementById('plantedDate').value;
        const locationVal = document.getElementById('location').value;
        const notesVal = document.getElementById('notes').value;
        
        const vegInfo = availableVegetables.find(v => v.id === vegId);
        
        // คำนวณวันเก็บเกี่ยว
        const pDate = new Date(plantedDateVal);
        const eDate = new Date(pDate);
        let daysToAdd = 60;
        if (vegInfo && vegInfo.harvest_time) {
            daysToAdd = extractDays(vegInfo.harvest_time);
        }
        eDate.setDate(pDate.getDate() + daysToAdd);

        const payload = {
            ownerEmail: user.email,
            vegetableId: vegId,
            vegetableName: vegInfo ? vegInfo.name : 'ไม่ระบุชื่อ',
            plantedDate: plantedDateVal,
            expectedDate: eDate.toISOString().split('T')[0],
            location: locationVal,
            notes: notesVal
        };

        try {
            let res;
            if (editId) {
                // --- กรณีแก้ไข (Update) ---
                res = await fetch(`/api/planting-log/${editId}/details`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                // --- กรณีเพิ่มใหม่ (Create) ---
                payload.status = 'Planted';
                payload.wateringIntervalDays = 1;

                res = await fetch('/api/planting-log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }

            if (res.ok) {
                alert(editId ? 'แก้ไขข้อมูลสำเร็จ!' : 'บันทึกการปลูกสำเร็จ!');
                closeModal();
                renderBoard(); // รีโหลดหน้าจอ
            } else {
                alert('ทำรายการไม่สำเร็จ');
            }
        } catch (error) {
            console.error('Save Error:', error);
            alert('ติดต่อเซิร์ฟเวอร์ไม่ได้');
        }
    });

    renderBoard();
});