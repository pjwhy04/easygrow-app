/**
 * login.js (ฉบับเชื่อมต่อ Node.js Server & MySQL)
 */

document.addEventListener('DOMContentLoaded', () => {
    // เช็คว่าถ้าล็อกอินอยู่แล้ว ให้ไป Dashboard เลย
    const storedUser = localStorage.getItem('easygrowUser');
    if (storedUser) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const errorMsg = document.getElementById('errorMessage');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value.trim();
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            
            // ปิดปุ่มกันกดซ้ำ
            if(submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'กำลังตรวจสอบ...';
            }

            try {
                // ส่งข้อมูลไปเช็คที่ Server
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();

                if (res.ok && data.success) {
                    // Login สำเร็จ
                    console.log("Login Success:", data.user);
                    
                    // บันทึก Session ลง LocalStorage (เพื่อใช้ในหน้าอื่น)
                    localStorage.setItem('easygrowUser', JSON.stringify(data.user));

                    if(errorMsg) errorMsg.style.display = 'none';
                    
                    // ไปหน้า Dashboard
                    window.location.href = 'dashboard.html';

                } else {
                    // Login ไม่ผ่าน
                    throw new Error(data.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
                }

            } catch (error) {
                console.warn("Login Failed:", error.message);
                
                if(errorMsg) {
                    errorMsg.innerHTML = `${error.message}`;
                    errorMsg.style.display = 'block';
                }
                
                // Shake Animation
                const card = document.querySelector('.login-card');
                if(card) {
                    card.classList.add('shake');
                    setTimeout(() => card.classList.remove('shake'), 500);
                }
            } finally {
                // คืนค่าปุ่ม
                if(submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'เข้าสู่ระบบ';
                }
            }
        });
    }
});