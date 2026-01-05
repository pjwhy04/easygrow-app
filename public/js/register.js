/**
 * register.js
 * จัดการ Logic การสมัครสมาชิกใหม่ (เชื่อมต่อ Server/Database)
 * (ฉบับภาษาไทย)
 */

document.addEventListener('DOMContentLoaded', () => {
    // อ้างอิง Element
    const registerForm = document.getElementById('registerForm');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const termsCheckbox = document.getElementById('terms');
    const errorMessage = document.getElementById('errorMessage');

    registerForm.addEventListener('submit', async (e) => { // เพิ่ม async
        e.preventDefault();
        
        // Reset Error
        errorMessage.style.display = 'none';
        errorMessage.textContent = '';

        // 1. เก็บค่าจาก Input
        const fullName = fullNameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        const isTermsChecked = termsCheckbox.checked;

        // 2. Validation Logic (ตรวจสอบข้อมูลเบื้องต้นที่ฝั่ง Client)
        
        // ตรวจว่ามีช่องว่างไหม
        if (!fullName || !email || !password || !confirmPassword) {
            showError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
            return;
        }

        // ตรวจรูปแบบ Email (เบื้องต้น)
        if (!email.includes('@') || !email.includes('.')) {
            showError('รูปแบบอีเมลไม่ถูกต้อง');
            return;
        }

        // ตรวจความยาวรหัสผ่าน
        if (password.length < 6) {
            showError('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
            return;
        }

        // ตรวจ Password Matching
        if (password !== confirmPassword) {
            showError('รหัสผ่านยืนยันไม่ตรงกัน');
            return;
        }

        // ตรวจ Checkbox
        if (!isTermsChecked) {
            showError('กรุณายอมรับเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว');
            return;
        }

        // 3. ส่งข้อมูลไปสมัครสมาชิกที่ Server
        const btn = registerForm.querySelector('button');
        const originalBtnText = btn.textContent;
        btn.textContent = 'กำลังสร้างบัญชี...';
        btn.disabled = true;

        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: fullName,
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (response.ok) {
                // สมัครสำเร็จ!
                // จำลองการ Login อัตโนมัติด้วยข้อมูล User ที่สร้างใหม่
                // (ในระบบจริง Server อาจส่ง Token หรือ User Info กลับมาให้เลยก็ได้)
                const newUser = {
                    id: data.id, // ID ที่ได้จาก Database
                    name: fullName,
                    email: email,
                    role: 'user', // Default role
                    joinedAt: new Date().toISOString()
                };

                // บันทึก Session ลง LocalStorage เพื่อให้ถือว่า Login แล้ว
                localStorage.setItem('easygrowUser', JSON.stringify(newUser));

                alert('ลงทะเบียนสำเร็จ! ยินดีต้อนรับสู่ EasyGrow');
                window.location.href = 'dashboard.html';

            } else {
                // สมัครไม่สำเร็จ (เช่น อีเมลซ้ำ หรือ Error อื่นๆ จาก Server)
                showError(data.error || 'การลงทะเบียนล้มเหลว');
            }

        } catch (error) {
            console.error('Registration Error:', error);
            showError('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
        } finally {
            // คืนค่าปุ่มให้กลับมาใช้งานได้
            btn.textContent = originalBtnText;
            btn.disabled = false;
        }
    });

    // Helper Function แสดง Error
    function showError(msg) {
        errorMessage.textContent = msg;
        errorMessage.style.display = 'block';
        
        // Animation สั่นเตือน
        registerForm.classList.add('shake');
        setTimeout(() => registerForm.classList.remove('shake'), 300);
    }

    // ==========================================
    // ส่วนจัดการ Modal (Popup เงื่อนไข & นโยบาย)
    // ==========================================
    
    // อ้างอิง Element ของ Modal
    const modal = document.getElementById('termsModal');
    const openTermsLink = document.getElementById('openTermsLink');
    const openPrivacyLink = document.getElementById('openPrivacyLink');
    const closeModalSpan = document.querySelector('.close-modal');
    const btnAgreeModal = document.getElementById('btnAgreeModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    // ข้อความเนื้อหา (Content)
    const termsText = `
        <p><strong>1. ข้อตกลงทั่วไป</strong><br>ยินดีต้อนรับสู่ EasyGrow การใช้งานเว็บไซต์นี้ถือว่าท่านยอมรับข้อตกลงและเงื่อนไขทั้งหมดที่ระบุไว้ ณ ที่นี้ หากท่านไม่ยอมรับเงื่อนไข กรุณาระงับการใช้งาน</p>
        <p><strong>2. การใช้งานที่เหมาะสม</strong><br>ท่านตกลงที่จะไม่ใช้บริการนี้ในทางที่ผิดกฎหมาย รบกวนผู้อื่น หรือสร้างความเสียหายต่อระบบ</p>
        <p><strong>3. การสมัครสมาชิก</strong><br>ข้อมูลที่ท่านให้ในการสมัครสมาชิกต้องเป็นความจริงและเป็นปัจจุบัน ท่านต้องเก็บรักษารหัสผ่านไว้เป็นความลับ</p>
        <p><strong>4. การเปลี่ยนแปลงเงื่อนไข</strong><br>เราขอสงวนสิทธิ์ในการแก้ไขเปลี่ยนแปลงเงื่อนไขเหล่านี้ได้ตลอดเวลาโดยไม่ต้องแจ้งให้ทราบล่วงหน้า</p>
    `;

    const privacyText = `
        <p><strong>1. การเก็บรวบรวมข้อมูล</strong><br>เราจัดเก็บข้อมูลที่จำเป็น เช่น ชื่อ นามสกุล และอีเมล เพื่อใช้ในการยืนยันตัวตนและให้บริการแก่ท่าน</p>
        <p><strong>2. การนำข้อมูลไปใช้</strong><br>ข้อมูลของท่านจะถูกใช้เพื่อปรับปรุงบริการ การแจ้งเตือน และการวิเคราะห์ภายในเท่านั้น</p>
        <p><strong>3. การเปิดเผยข้อมูล</strong><br>เราจะไม่เปิดเผยข้อมูลส่วนบุคคลของท่านแก่บุคคลภายนอก เว้นแต่จะได้รับความยินยอมจากท่านหรือตามคำสั่งทางกฎหมาย</p>
        <p><strong>4. ความปลอดภัย</strong><br>เรามีมาตรการรักษาความปลอดภัยเพื่อปกป้องข้อมูลของท่านจากการเข้าถึงโดยไม่ได้รับอนุญาต</p>
    `;

    // ฟังก์ชันเปิด Modal
    function openModal(title, content) {
        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = content;
        if (modal) modal.style.display = 'block';
    }

    // ฟังก์ชันปิด Modal
    function closeModal() {
        if (modal) modal.style.display = 'none';
    }

    // Event Listener: คลิกเปิดเงื่อนไขการใช้งาน
    if (openTermsLink) {
        openTermsLink.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('เงื่อนไขการใช้งาน', termsText);
        });
    }

    // Event Listener: คลิกเปิดนโยบายความเป็นส่วนตัว
    if (openPrivacyLink) {
        openPrivacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('นโยบายความเป็นส่วนตัว', privacyText);
        });
    }

    // Event Listener: คลิกปุ่มปิด (X)
    if (closeModalSpan) {
        closeModalSpan.onclick = closeModal;
    }

    // Event Listener: คลิกปุ่ม "รับทราบและตกลง"
    if (btnAgreeModal) {
        btnAgreeModal.onclick = () => {
            closeModal();
            // ติ๊กถูกที่ Checkbox อัตโนมัติเมื่อกดยอมรับ
            if (termsCheckbox) {
                termsCheckbox.checked = true;
            }
        };
    }

    // Event Listener: คลิกพื้นที่ว่างข้างนอกเพื่อปิด Modal
    window.onclick = (event) => {
        if (event.target == modal) {
            closeModal();
        }
    };

});