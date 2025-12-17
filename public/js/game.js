/**
 * js/game.js
 * Game Logic: Harvest Rush (Fixed Mobile Controls: Hold to Move)
 */

document.addEventListener('DOMContentLoaded', () => {
    // Auth Guard
    const storedUser = localStorage.getItem('easygrowUser');
    if (!storedUser) { window.location.href = 'index.html'; return; }
    const user = JSON.parse(storedUser);

    // ==========================================
    // 1. Setup Sidebar (แสดงรูปโปรไฟล์)
    // ==========================================
    document.getElementById('sidebarUserName').textContent = user.name || 'ผู้ใช้งาน';
    document.getElementById('sidebarUserRole').textContent = user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ชาวสวน';
    
    const avatarEl = document.getElementById('userAvatar');
    if (user.image_url) {
        avatarEl.innerHTML = `<img src="${user.image_url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        avatarEl.style.backgroundColor = 'transparent';
    } else {
        avatarEl.textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';
    }

    if (user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }

    document.getElementById('logoutBtn').addEventListener('click', () => {
        if(confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
            localStorage.removeItem('easygrowUser');
            window.location.href = 'index.html';
        }
    });

    // ==========================================
    // 2. Game Setup
    // ==========================================
    const canvas = document.getElementById('canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Game State
    let gameState = {
        score: 0,
        lives: 5,
        highScore: localStorage.getItem('harvestHighScore') || 0,
        isRunning: false,
        isPaused: false,
        gameLoopId: null,
        spawnTimer: 0,
        nextSpawnFrame: 0 
    };

    // Game Objects
    const player = {
        x: canvas.width / 2 - 40,
        y: canvas.height - 85,
        width: 80,
        height: 50,
        speed: 8, // ความเร็วในการวิ่ง
        emoji: '🧺'
    };

    let items = [];
    const itemTypes = [
        { type: 'carrot', score: 10, emoji: '🥕' },
        { type: 'tomato', score: 15, emoji: '🍅' },
        { type: 'lettuce', score: 20, emoji: '🥬' }
    ];
    const badItem = { type: 'rotten', score: 0, emoji: '🤢' };

    // ==========================================
    // 🎮 Controls (แก้ใหม่: ระบบกดค้าง)
    // ==========================================
    
    // 1. ตัวแปรจำสถานะการกด
    const controls = {
        left: false,
        right: false
    };

    // 2. ควบคุมด้วยคีย์บอร์ด (คอมพิวเตอร์)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') controls.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') controls.right = true;
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') controls.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') controls.right = false;
    });

    // 3. ควบคุมด้วยปุ่มบนหน้าจอ (มือถือ)
    const leftBtn = document.getElementById('leftBtn'); // หรือ btnLeft เช็ค ID ใน HTML ให้ตรง
    const rightBtn = document.getElementById('rightBtn'); // หรือ btnRight เช็ค ID ใน HTML ให้ตรง

    const setupMobileBtn = (btn, dir) => {
        if (!btn) return;

        // ฟังก์ชันเริ่มกด
        const startPress = (e) => {
            if(e.cancelable) e.preventDefault(); // กันจอสั่น/เลื่อน
            if (dir === 'left') controls.left = true;
            if (dir === 'right') controls.right = true;
        };

        // ฟังก์ชันปล่อยมือ
        const endPress = (e) => {
            if(e.cancelable) e.preventDefault();
            if (dir === 'left') controls.left = false;
            if (dir === 'right') controls.right = false;
        };

        // Event Listeners (รองรับทั้งเมาส์และนิ้วสัมผัส)
        btn.addEventListener('mousedown', startPress);
        btn.addEventListener('mouseup', endPress);
        btn.addEventListener('mouseleave', endPress);
        
        // Touch events (สำคัญสำหรับมือถือ)
        btn.addEventListener('touchstart', startPress, { passive: false });
        btn.addEventListener('touchend', endPress);
    };

    // ติดตั้งปุ่ม (เช็คว่า ID ปุ่มตรงกับ HTML ของคุณไหม ถ้า HTML ใช้ btnLeft ให้แก้ข้างบน)
    setupMobileBtn(leftBtn || document.getElementById('btnLeft'), 'left');
    setupMobileBtn(rightBtn || document.getElementById('btnRight'), 'right');

    // UI Buttons
    const startBtn = document.getElementById('start');
    const pauseBtn = document.getElementById('pause');

    if (startBtn) startBtn.addEventListener('click', startGame);
    if (pauseBtn) pauseBtn.addEventListener('click', togglePause);

    // ==========================================
    // UI Update Function
    // ==========================================
    function updateUI() {
        const scoreEl = document.getElementById('score');
        const highEl = document.getElementById('high');
        const livesDiv = document.getElementById('lives');
        
        if (scoreEl) scoreEl.textContent = gameState.score;
        if (highEl) highEl.textContent = gameState.highScore;
        
        if (livesDiv) {
            livesDiv.innerHTML = '';
            for(let i=0; i<5; i++) {
                const dot = document.createElement('span');
                dot.className = 'life-dot ' + (i < gameState.lives ? '' : 'life-lost');
                livesDiv.appendChild(dot);
            }
        }

        if (startBtn) {
            if (gameState.isRunning) {
                startBtn.textContent = 'เริ่มใหม่ (Restart)';
                startBtn.style.background = 'var(--danger)';
            } else {
                startBtn.textContent = 'เริ่มเกม ▶';
                startBtn.style.background = 'var(--accent)';
            }
        }
    }

    // ==========================================
    // Core Game Logic
    // ==========================================
    function spawnItem() {
        const size = 50;
        const x = Math.random() * (canvas.width - size);
        
        let itemConfig;
        if (Math.random() < 0.2) {
            itemConfig = badItem;
        } else {
            const rand = Math.random();
            if (rand < 0.5) itemConfig = itemTypes[0];
            else if (rand < 0.8) itemConfig = itemTypes[1];
            else itemConfig = itemTypes[2];
        }

        items.push({
            x: x,
            y: -50,
            size: size,
            speed: 3 + Math.random() * 1.5, 
            ...itemConfig
        });
    }

    function update() {
        if (!gameState.isRunning || gameState.isPaused) return;

        // ⭐ การเคลื่อนที่ (เช็คจากตัวแปร controls แทน)
        if (controls.left) {
            player.x -= player.speed;
        }
        if (controls.right) {
            player.x += player.speed;
        }
        
        // กันตกขอบจอ
        if (player.x < 0) player.x = 0;
        if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

        // Spawning
        gameState.spawnTimer++;
        if (gameState.spawnTimer > gameState.nextSpawnFrame) {
            spawnItem();
            gameState.spawnTimer = 0;
            gameState.nextSpawnFrame = Math.floor(Math.random() * 40) + 60;
        }

        // Items Update
        for (let i = items.length - 1; i >= 0; i--) {
            let item = items[i];
            item.y += item.speed;

            const playerHitboxY = player.y + 10;
            
            // Collision Check
            if (
                item.x < player.x + player.width &&
                item.x + item.size > player.x &&
                item.y + item.size > playerHitboxY && 
                item.y < player.y + player.height
            ) {
                if (item.type === 'rotten') {
                    gameState.lives--;
                } else {
                    gameState.score += item.score;
                }
                items.splice(i, 1);
                continue;
            }

            // Ground Check
            if (item.y > canvas.height) {
                if (item.type !== 'rotten') {
                    gameState.lives--;
                }
                items.splice(i, 1);
            }
        }

        if (gameState.lives <= 0) gameOver();
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Player
        ctx.textBaseline = 'top'; 
        ctx.font = '60px Arial';
        ctx.fillText(player.emoji, player.x + (player.width/2) - 30, player.y - 10);

        // Draw Items
        ctx.font = '45px Arial';
        for (let item of items) {
            ctx.fillText(item.emoji, item.x, item.y);
        }

        // Draw Pause Screen
        if (gameState.isPaused && gameState.isRunning) {
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillRect(0,0,canvas.width, canvas.height);
            ctx.fillStyle = 'var(--accent)';
            ctx.textAlign = 'center';
            ctx.font = 'bold 40px sans-serif';
            ctx.fillText("พักเกม...", canvas.width/2, canvas.height/2);
            ctx.textAlign = 'start';
        }
    }

    function loop() {
        update();
        draw();
        updateUI();
        if (gameState.isRunning) {
            gameState.gameLoopId = requestAnimationFrame(loop);
        }
    }

    function startGame() {
        gameState.score = 0;
        gameState.lives = 5;
        gameState.isRunning = true;
        gameState.isPaused = false;
        gameState.spawnTimer = 0;
        gameState.nextSpawnFrame = 0;
        items = [];
        player.x = canvas.width / 2 - 40;
        
        // รีเซ็ตปุ่มค้าง
        controls.left = false;
        controls.right = false;

        if (gameState.gameLoopId) cancelAnimationFrame(gameState.gameLoopId);
        loop();
        
        if(startBtn) startBtn.blur();
    }

    function togglePause() {
        if (!gameState.isRunning) return;
        gameState.isPaused = !gameState.isPaused;
        if (pauseBtn) pauseBtn.textContent = gameState.isPaused ? "เล่นต่อ" : "พักเกม";
    }

    function gameOver() {
        gameState.isRunning = false;
        cancelAnimationFrame(gameState.gameLoopId);
        
        if (gameState.score > gameState.highScore) {
            gameState.highScore = gameState.score;
            localStorage.setItem('harvestHighScore', gameState.highScore);
        }
        updateUI();

        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.font = 'bold 50px sans-serif';
        ctx.fillText("จบเกม!", canvas.width/2, canvas.height/2 - 20);
        ctx.font = '30px sans-serif';
        ctx.fillText("คะแนน: " + gameState.score, canvas.width/2, canvas.height/2 + 40);
        ctx.textAlign = 'start';
    }

    // Initial Draw
    updateUI();
    ctx.fillStyle = '#fff';
    ctx.font = '30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'var(--muted)';
    ctx.fillText("กดปุ่ม 'เริ่มเกม' เพื่อเล่น", canvas.width/2, canvas.height/2);
    ctx.textAlign = 'start';
});

// ==========================================
// 🍔 Mobile Menu Logic
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