const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// ⭐ แก้ไข 1: เพิ่มขนาดการรับข้อมูล (Body Limit) ให้รองรับ Base64 ที่มีขนาดใหญ่
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// บอก Server ให้หาไฟล์หน้าเว็บในโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));
// (เหลือไว้เผื่อใช้กับรูป Logo แต่รูปที่อัปโหลดใหม่จะไม่ได้ใช้โฟลเดอร์นี้แล้ว)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// =========================================================
// 1. เชื่อมต่อฐานข้อมูล (Database Connection)
// =========================================================

// --- ❌ แบบเก่า: Localhost (เก็บไว้เป็น Comment ตามที่ขอ) ---
/*
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', 
    database: 'easygrow_db'
});
*/

// --- ✅ แบบใหม่: TiDB Cloud (Connection Pool) ---
const db = mysql.createPool({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '3z7V8Nw9r3zyodz.root',
    password: 'gQRQCWX9PlVwlNLU',
    database: 'test', // ⚠️ เช็คชื่อ Database ใน Cloud ด้วยนะครับ (ของเดิมชื่อ easygrow_db)
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    },
    // เพิ่มการตั้งค่าเพื่อความเสถียรบน Cloud
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
});

// ทดสอบการเชื่อมต่อครั้งแรก (สำหรับ Pool)
db.getConnection((err, conn) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to TiDB Cloud Database');
        conn.release(); // คืนการเชื่อมต่อเข้า Pool
    }
});

// =========================================================
// ⭐ แก้ไข 2: เปลี่ยนจาก diskStorage (ลงไฟล์) เป็น memoryStorage (ลง RAM)
// =========================================================
// เพื่อรอแปลงไฟล์ใน RAM ให้เป็นข้อความ Base64 ก่อนบันทึกลง Database
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ==========================================
// 🟢 API Routes: Vegetables (จัดการข้อมูลผัก)
// ==========================================

// ดึงข้อมูลผัก
app.get('/api/vegetables', (req, res) => {
    const sql = "SELECT * FROM vegetables";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        
        const vegs = results.map(v => ({
            ...v,
            water: JSON.parse(v.water || '[]'),
            regions: JSON.parse(v.regions || '[]'),
            steps: JSON.parse(v.steps || '[]'),
            moreTips: JSON.parse(v.more_tips || '[]'),
            // ⭐ แก้ไข: ส่งข้อมูล Base64 ไปตรงๆ ไม่ต้องแต่ง Path แล้ว
            image: v.image_url 
        }));
        res.json(vegs);
    });
});

// เพิ่มผักใหม่ + รูปภาพ (Base64)
app.post('/api/vegetables', upload.single('imageFile'), (req, res) => {
    // ⭐ แก้ไข: แปลงไฟล์เป็น Base64 String
    let imageUrl = '';
    if (req.file) {
        // รูปแบบ: data:image/png;base64,xxxxxxxx...
        imageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const { name, harvestTime, water, sunlight, months, regions, description, steps, moreTips } = req.body;

    const sql = `INSERT INTO vegetables 
                 (name, harvest_time, water, sunlight, months, regions, image_url, description, steps, more_tips) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
        name, harvestTime, water, sunlight, months, regions, imageUrl, description, steps, moreTips
    ];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database Error' });
        }
        res.json({ message: 'Success', id: result.insertId });
    });
});

// ลบข้อมูลผัก
app.delete('/api/vegetables/:id', (req, res) => {
    const id = req.params.id;
    // ⭐ แก้ไข: ลบแค่ใน Database ไม่ต้องลบไฟล์ออกจากเครื่องแล้ว
    const sql = "DELETE FROM vegetables WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database Error' });
        }
        res.json({ message: 'Deleted successfully' });
    });
});

// แก้ไขข้อมูลผัก (Update Vegetable - Base64)
app.put('/api/vegetables/:id', upload.single('imageFile'), (req, res) => {
    const id = req.params.id;
    let { name, harvestTime, water, sunlight, months, regions, description, steps, moreTips } = req.body;
    
    let sql = `UPDATE vegetables SET 
               name=?, harvest_time=?, water=?, sunlight=?, months=?, regions=?, description=?, steps=?, more_tips=?`;
    
    let values = [name, harvestTime, water, sunlight, months, regions, description, steps, moreTips];

    // ⭐ แก้ไข: ถ้ามีการอัปโหลดรูปใหม่ -> แปลงเป็น Base64 แล้วอัปเดต
    if (req.file) {
        const newImageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        
        sql += `, image_url=?`;
        values.push(newImageUrl);
    }

    sql += ` WHERE id=?`;
    values.push(id);

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database Error' });
        }
        res.json({ message: 'Updated successfully' });
    });
});

// ==========================================
// 🟡 API Routes: Planting Log (บันทึกการปลูก)
// ==========================================

// 1. ดึงข้อมูลการปลูก (เฉพาะของ User นั้น)
app.get('/api/planting-log', (req, res) => {
    const userEmail = req.query.email;
    if (!userEmail) return res.status(400).json({ error: 'Email required' });

    const sql = "SELECT * FROM planting_log WHERE user_email = ?";
    db.query(sql, [userEmail], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 2. เพิ่มบันทึกการปลูกใหม่
app.post('/api/planting-log', (req, res) => {
    const { ownerEmail, vegetableId, vegetableName, status, plantedDate, expectedDate, location, notes, wateringIntervalDays } = req.body;
    
    const sql = `INSERT INTO planting_log 
    (user_email, vegetable_id, vegetable_name, status, planted_date, expected_date, location, notes, watering_interval_days, last_watered_date) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    // ให้ last_watered_date เริ่มต้นเท่ากับ plantedDate
    const values = [ownerEmail, vegetableId, vegetableName, status, plantedDate, expectedDate, location, notes, wateringIntervalDays, plantedDate];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Database Error:", err); 
            return res.status(500).json(err);
        }
        res.json({ message: 'Log added', id: result.insertId });
    });
});

// 3. อัปเดตสถานะ (Update Status)
app.put('/api/planting-log/:id', (req, res) => {
    const id = req.params.id;
    const { status } = req.body;

    const sql = "UPDATE planting_log SET status = ? WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Status updated' });
    });
});

// 4. อัปเดตวันที่รดน้ำ (Update Last Watered Date)
app.put('/api/planting-log/:id/water', (req, res) => {
    const id = req.params.id;
    const { lastWateredDate } = req.body;

    const sql = "UPDATE planting_log SET last_watered_date = ? WHERE id = ?";
    db.query(sql, [lastWateredDate, id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Watered successfully' });
    });
});

// 5. ลบรายการปลูก (Delete Log)
app.delete('/api/planting-log/:id', (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM planting_log WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }
        res.json({ message: 'Deleted successfully' });
    });
});

// 6. แก้ไขข้อมูลการปลูก (Edit Details) 
app.put('/api/planting-log/:id/details', (req, res) => {
    const id = req.params.id;
    const { vegetableId, vegetableName, plantedDate, expectedDate, location, notes } = req.body;

    const sql = `UPDATE planting_log 
                 SET vegetable_id=?, vegetable_name=?, planted_date=?, expected_date=?, location=?, notes=? 
                 WHERE id=?`;
                 
    const values = [vegetableId, vegetableName, plantedDate, expectedDate, location, notes, id];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json(err);
        }
        res.json({ message: 'Updated successfully' });
    });
});

// ==========================================
// 🔵 API Routes: User / Auth (ระบบสมาชิก)
// ==========================================

// Login (ตรวจสอบอีเมลและรหัสผ่าน)
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });

        if (results.length > 0) {
            const user = results[0];
            if (password === user.password) {
                const userData = { 
                    id: user.id, 
                    name: user.name, 
                    email: user.email, 
                    role: user.role,
                    image_url: user.image_url // Base64 จะถูกส่งไปที่นี่
                };
                res.json({ success: true, user: userData });
            } else {
                res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
            }
        } else {
            res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งานนี้' });
        }
    });
});

// Register (สมัครสมาชิก)
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')";
    
    db.query(sql, [name, email, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
            }
            return res.status(500).json({ error: 'สมัครสมาชิกไม่สำเร็จ' });
        }
        res.json({ message: 'User registered', id: result.insertId });
    });
});

// ==========================================
// 🟣 API Routes: Profile (หน้าโปรไฟล์)
// ==========================================

// 1. ดึงข้อมูล Profile + สถิติการปลูก
app.get('/api/profile', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    // ดึงข้อมูล User
    const userSql = "SELECT id, name, email, role, created_at, image_url FROM users WHERE email = ?";
    
    // ดึงสถิติการปลูก
    const statsSql = `
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'Growing' THEN 1 ELSE 0 END) as growing,
            SUM(CASE WHEN status = 'Ready' THEN 1 ELSE 0 END) as ready,
            SUM(CASE WHEN status = 'Harvested' THEN 1 ELSE 0 END) as harvested
        FROM planting_log WHERE user_email = ?
    `;

    db.query(userSql, [email], (err, userResult) => {
        if (err) return res.status(500).json(err);
        if (userResult.length === 0) return res.status(404).json({ error: 'User not found' });

        const user = userResult[0];
        
        db.query(statsSql, [email], (err, statsResult) => {
            if (err) return res.status(500).json(err);
            
            const stats = statsResult[0];
            res.json({
                user: {
                    ...user,
                    // ⭐ แก้ไข: ส่ง Base64 กลับไปเลย
                    image_url: user.image_url 
                },
                stats: stats
            });
        });
    });
});

// 2. อัปเดตข้อมูลส่วนตัว (ชื่อ, รหัสผ่าน)
app.put('/api/profile/update', (req, res) => {
    const { email, name, newPassword, currentPassword } = req.body;

    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: 'Error checking user' });
        
        const user = results[0];

        if (newPassword) {
            if (user.password !== currentPassword) {
                return res.status(401).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
            }
        }

        const finalPassword = newPassword ? newPassword : user.password;
        const updateSql = "UPDATE users SET name = ?, password = ? WHERE email = ?";
        
        db.query(updateSql, [name, finalPassword, email], (err, result) => {
            if (err) return res.status(500).json(err);
            res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
        });
    });
});

// 3. อัปโหลดรูปโปรไฟล์ (Base64)
app.post('/api/profile/upload-image', upload.single('profileImage'), (req, res) => {
    const email = req.body.email;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // ⭐ แก้ไข: แปลงรูปเป็น Base64
    const newImageUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // ไม่ต้องหาชื่อไฟล์เก่าแล้ว อัปเดตทับลง DB ได้เลย
    const sql = "UPDATE users SET image_url = ? WHERE email = ?";
    db.query(sql, [newImageUrl, email], (updateErr, result) => {
        if (updateErr) return res.status(500).json(updateErr);
        res.json({ success: true, imageUrl: newImageUrl });
    });
});

// ==========================================
// 🔴 API Routes: Admin User Management
// ==========================================

// 1. ดึงรายชื่อ User ทั้งหมด
app.get('/api/users', (req, res) => {
    const sql = `
        SELECT u.id, u.name, u.email, u.role, u.created_at, u.image_url,
        (SELECT COUNT(*) FROM planting_log p WHERE p.user_email = u.email) as plant_count
        FROM users u
        ORDER BY u.id DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        
        // ⭐ แก้ไข: ส่ง image_url ตรงๆ ไม่ต้องแต่ง path
        const users = results.map(u => ({
            ...u,
            image_url: u.image_url 
        }));
        res.json(users);
    });
});

// 2. แอดมินเพิ่ม User ใหม่
app.post('/api/users', (req, res) => {
    const { name, email, role, password } = req.body;
    const finalPass = password || '123456'; 
    
    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
    db.query(sql, [name, email, finalPass, role], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'อีเมลนี้มีอยู่แล้ว' });
            return res.status(500).json(err);
        }
        res.json({ message: 'User created successfully' });
    });
});

// 3. เปลี่ยนสิทธิ์ (Role)
app.put('/api/users/:id/role', (req, res) => {
    const { role } = req.body;
    const id = req.params.id;
    db.query("UPDATE users SET role = ? WHERE id = ?", [role, id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Role updated' });
    });
});

// 4. ลบ User
app.delete('/api/users/:id', (req, res) => {
    const id = req.params.id;
    db.query("DELETE FROM users WHERE id = ?", [id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'User deleted' });
    });
});

// ==========================================
// 🚀 Start Server (จุดเดียวเท่านั้น)
// ==========================================
app.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
});