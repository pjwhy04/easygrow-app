/**
 * js/game.js
 * - ระบบมินิเกม Harvest Rush (Final Version)
 * - รองรับ Auto-Sync รูปโปรไฟล์จาก Server
 * - ผักตกช้าลง (Easy Mode)
 * - ปรับการเกิดผักให้ห่างกันมากขึ้น
 */

document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Game Page Loaded");
    const webLogo = '/images/logo.png'; 

    // ==========================================
    // 0. แก้ไขสีโลโก้ Sidebar
    // ==========================================
    const sidebarLogoText = document.querySelector('.sidebar .logo-text h2');
    if (sidebarLogoText) {
        sidebarLogoText.style.setProperty('color', '#2e7d32', 'important'); 
        sidebarLogoText.style.fontWeight = '600';
    }

    // ==========================================
    // 1. Auth Guard
    // ==========================================
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { 
        window.location.href = 'login.html'; 
        return; 
    }

    let user = null;
    try {
        user = JSON.parse(storedUser);
    } catch (e) {
        console.error("User data corrupted");
        localStorage.removeItem('easygrowUser');
        window.location.href = 'login.html';
        return;
    }

    // ==========================================
    // 2. Setup Header UI & Mobile Menu
    // ==========================================
    
    // 2.1 ฟังก์ชันอัปเดตข้อมูลบน Header (แยกออกมาเพื่อให้เรียกซ้ำได้)
    const updateHeaderData = (userData) => {
        const headerUserName = document.getElementById('headerUserName');
        const userAvatarHeader = document.getElementById('userAvatarHeader');
        const menuUserName = document.getElementById('menuUserName');
        const menuUserRole = document.getElementById('menuUserRole');

        // User Info
        if (headerUserName) headerUserName.textContent = userData.name || 'ผู้ใช้งาน';
        if (menuUserName) menuUserName.textContent = userData.name || 'ผู้ใช้งาน';
        if (menuUserRole) menuUserRole.textContent = userData.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';

        // Avatar
        if (userAvatarHeader) {
            const profileImg = userData.image_url ? userData.image_url : webLogo;
            userAvatarHeader.innerHTML = `
                <img src="${profileImg}" 
                     onerror="this.src='${webLogo}'" 
                     style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            userAvatarHeader.style.backgroundColor = 'transparent';
        }

        // Hide Admin Menu if not admin
        if (userData.role !== 'admin') {
            document.querySelectorAll('.admin-only').forEach(el => el.style.setProperty('display', 'none', 'important'));
        }
    };

    // 2.2 ฟังก์ชันผูกปุ่มต่างๆ บน Header (เรียกครั้งเดียวพอ)
    const bindHeaderEvents = () => {
        const dropdownMenu = document.getElementById('dropdownMenu');
        const profileTrigger = document.getElementById('profileTrigger');
        const logoutBtnHeader = document.getElementById('logoutBtnHeader');

        if (profileTrigger && dropdownMenu) {
            profileTrigger.onclick = (e) => { 
                e.stopPropagation(); 
                dropdownMenu.classList.toggle('active'); 
            };
        }
        
        window.addEventListener('click', () => {
            if (dropdownMenu) dropdownMenu.classList.remove('active');
        });

        if (logoutBtnHeader) {
            logoutBtnHeader.onclick = (e) => {
                e.preventDefault();
                if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
                    localStorage.removeItem('easygrowUser');
                    window.location.href = 'login.html';
                }
            };
        }
    };

    // --- เริ่มทำงานส่วน UI ---
    // A. แสดงผลทันทีด้วยข้อมูลเก่าในเครื่อง
    updateHeaderData(user);
    bindHeaderEvents();
    setupMobileMenu();

    // B. ⭐ ดึงข้อมูลล่าสุดจาก Server (Auto Sync) ⭐
    try {
        const res = await fetch(`/api/profile?email=${user.email}`);
        if (res.ok) {
            const data = await res.json();
            const latestUser = data.user;
            
            // อัปเดต UI อีกครั้งด้วยข้อมูลใหม่
            updateHeaderData(latestUser);
            
            // บันทึกลงเครื่อง
            localStorage.setItem('easygrowUser', JSON.stringify({ ...user, ...latestUser }));
        }
    } catch (err) {
        console.warn("Sync profile failed:", err);
    }

    // ==========================================
    // 3. Centralized Watering Check
    // ==========================================
    if (window.syncWateringStatus) {
        await window.syncWateringStatus(user.email, false).catch(e => console.warn(e));
    }

    // ==========================================
    // 4. Start Game Engine
    // ==========================================
    setupMiniGame();
});

// --- Helper Functions ---

function setupMobileMenu() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const sidebar = document.querySelector('.sidebar');
    if (mobileBtn && sidebar && mobileOverlay) {
        const toggle = () => { sidebar.classList.toggle('active'); mobileOverlay.classList.toggle('active'); };
        mobileBtn.onclick = toggle;
        mobileOverlay.onclick = toggle;
    }
}

/**
 * Game Engine: Harvest Rush
 */
function setupMiniGame() {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
        console.warn("Canvas element not found. Game skipped.");
        return;
    }
    const ctx = canvas.getContext('2d');

    // --- 🎵 Sound System Setup ---
    const bgm = new Audio('sounds/bgm.mp3'); 
    bgm.loop = true;   
    bgm.volume = 0.5;  
    let isMuted = false;

    // --- Buttons Reference ---
    const startBtn = document.getElementById('start');
    const pauseBtn = document.getElementById('pause');
    const soundBtn = document.getElementById('btnSound'); // ปุ่มเสียงจาก HTML

    // Game Variables
    let gameState = {
        score: 0, 
        lives: 5, 
        highScore: parseInt(localStorage.getItem('harvestHighScore') || '0'),
        isRunning: false, 
        isPaused: false, 
        gameLoopId: null,
        spawnTimer: 0, 
        nextSpawnFrame: 0 
    };

    // Player Configuration
    const player = { x: canvas.width / 2 - 40, y: canvas.height - 85, width: 80, height: 50, speed: 8, emoji: '🧺' };
    
    // Items Configuration
    let items = [];
    const itemTypes = [
        { type: 'carrot', score: 10, emoji: '🥕' },
        { type: 'tomato', score: 15, emoji: '🍅' },
        { type: 'lettuce', score: 20, emoji: '🥬' }
    ];
    const badItem = { type: 'rotten', score: 0, emoji: '🤢' };

    // Controls
    const controls = { left: false, right: false };

    // Keyboard Listeners
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') controls.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') controls.right = true;
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') controls.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') controls.right = false;
    });

    // Touch/Mouse Button Listeners (Mobile)
    const setupMobileBtn = (btnId, dir) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        
        const start = (e) => { 
            if(e.cancelable) e.preventDefault(); 
            controls[dir] = true; 
        };
        const end = (e) => { 
            if(e.cancelable) e.preventDefault(); 
            controls[dir] = false; 
        };

        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end); 
        btn.addEventListener('touchstart', start, { passive: false });
        btn.addEventListener('touchend', end);
    };

    setupMobileBtn('btnLeft', 'left');
    setupMobileBtn('btnRight', 'right');

    // 1. ปุ่มเริ่มเกม
    if (startBtn) {
        startBtn.onclick = () => {
            if (gameState.isRunning) return; 

            gameState.score = 0;
            gameState.lives = 5;
            gameState.isRunning = true;
            gameState.isPaused = false;
            items = []; 
            player.x = canvas.width / 2 - 40;
            
            updateUI(); 
            updateLivesUI();

            // 🎵 เล่นเพลง
            if (!isMuted) {
                bgm.currentTime = 0;
                bgm.play().catch(e => console.warn("Audio autoplay blocked:", e));
            }

            if (gameState.gameLoopId) cancelAnimationFrame(gameState.gameLoopId);
            gameLoop();
        };
    }

    // 2. ปุ่มพักเกม (Pause)
    if (pauseBtn) {
        pauseBtn.onclick = () => {
            if (!gameState.isRunning) return;
            
            gameState.isPaused = !gameState.isPaused;
            pauseBtn.textContent = gameState.isPaused ? "เล่นต่อ ▶" : "พักเกม";
            
            if (gameState.isPaused) {
                bgm.pause();
            } else {
                if (!isMuted) bgm.play();
            }
        };
    }

    // 3. ปุ่มเปิด/ปิดเสียง (Sound Toggle)
    if (soundBtn) {
        soundBtn.onclick = () => {
            isMuted = !isMuted;
            if (isMuted) {
                bgm.pause();
                soundBtn.textContent = "🔇 ปิดเสียง";
                soundBtn.style.color = "#ff5252"; 
                soundBtn.style.borderColor = "#ff5252";
            } else {
                if (gameState.isRunning && !gameState.isPaused) bgm.play();
                soundBtn.textContent = "🔊 เปิดเสียง";
                soundBtn.style.color = ""; 
                soundBtn.style.borderColor = "";
            }
        };
    }

    function gameLoop() {
        if (!gameState.isRunning) return;

        if (!gameState.isPaused) {
            update(); 
            draw(); 
            updateUI();
        }
        
        gameState.gameLoopId = requestAnimationFrame(gameLoop);
    }

    function update() {
        // Player Movement
        if (controls.left) player.x -= player.speed;
        if (controls.right) player.x += player.speed;
        
        // Boundaries
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

        // Spawning Items (Logic การเกิดผัก)
        gameState.spawnTimer++;
        if (gameState.spawnTimer > gameState.nextSpawnFrame) {
            const size = 50;
            const itemConfig = (Math.random() < 0.2) ? badItem : itemTypes[Math.floor(Math.random() * itemTypes.length)];
            
            items.push({ 
                x: Math.random() * (canvas.width - size), 
                y: -50, 
                size,
                speed: 1.5 + Math.random() * 1.5, // ความเร็วการตก (ช้า)
                ...itemConfig 
            });
            
            gameState.spawnTimer = 0;
            
            // ⭐ เพิ่มเวลาหน่วงระหว่างผักแต่ละชิ้น (80-140 frames)
            gameState.nextSpawnFrame = Math.floor(Math.random() * 60) + 80; 
        }

        // Update Items Position & Collision
        for (let i = items.length - 1; i >= 0; i--) {
            items[i].y += items[i].speed;

            // Collision Detection
            if (
                items[i].x < player.x + player.width &&
                items[i].x + items[i].size > player.x &&
                items[i].y + items[i].size > player.y + 10 &&
                items[i].y < player.y + player.height
            ) {
                // Hit!
                if (items[i].type === 'rotten') {
                    gameState.lives--; 
                    updateLivesUI();
                } else {
                    gameState.score += items[i].score;
                }
                items.splice(i, 1); 
                continue;
            }

            // Missed Items
            if (items[i].y > canvas.height) { 
                if (items[i].type !== 'rotten') {
                    gameState.lives--; 
                    updateLivesUI();
                }
                items.splice(i, 1); 
            }
        }

        // Game Over Condition
        if (gameState.lives <= 0) {
            endGame();
        }
    }

    function endGame() {
        gameState.isRunning = false;
        
        bgm.pause();
        bgm.currentTime = 0;

        if (gameState.score > gameState.highScore) {
            gameState.highScore = gameState.score;
            localStorage.setItem('harvestHighScore', gameState.score);
        }
        draw(); 
        
        setTimeout(() => alert(`❌ จบเกม! \nคะแนนของคุณคือ: ${gameState.score}`), 10);
        
        if (pauseBtn) pauseBtn.textContent = "พักเกม";
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = '60px Arial'; 
        ctx.fillText(player.emoji, player.x + 10, player.y + 45);
        
        ctx.font = '45px Arial'; 
        items.forEach(item => {
            ctx.fillText(item.emoji, item.x, item.y + 40);
        });
    }

    function updateUI() {
        const scoreEl = document.getElementById('score');
        const highEl = document.getElementById('high');

        if (scoreEl) scoreEl.textContent = gameState.score;
        if (highEl) highEl.textContent = gameState.highScore;
    }

    function updateLivesUI() {
        const livesContainer = document.getElementById('lives');
        if (!livesContainer) return;
        
        livesContainer.innerHTML = ''; 
        for (let i = 0; i < 5; i++) {
            const dot = document.createElement('span');
            dot.className = 'life-dot';
            if (i >= gameState.lives) {
                dot.classList.add('life-lost'); 
            }
            livesContainer.appendChild(dot);
        }
    }

    // Initial UI Update
    updateUI();
    updateLivesUI();
}