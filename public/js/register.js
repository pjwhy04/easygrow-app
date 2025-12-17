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
});