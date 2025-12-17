const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// บอก Server ให้หาไฟล์หน้าเว็บในโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));
// เปิดให้เข้าถึงรูปภาพที่อัปโหลดได้
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 1. เชื่อมต่อฐานข้อมูล
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: '', 
//     database: 'easygrow_db'
// });
// 1. เชื่อมต่อฐานข้อมูล (เปลี่ยนเป็นของ Cloud)
const db = mysql.createConnection({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', // ตัวอย่าง: ใส่ Host ของ TiDB
    port: 4000,                              // ใส่ Port (ปกติ 4000)
    user: '3z7V8Nw9r3zyodz.root',                     // ใส่ User
    password: 'gQRQCWX9PlVwlNLU',               // ใส่ Password
    database: 'test',
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

// 2. ตั้งค่าการอัปโหลดรูป
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public/uploads');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
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
            image: v.image_url ? `/uploads/${path.basename(v.image_url)}` : ''
        }));
        res.json(vegs);
    });
});

// เพิ่มผักใหม่ + รูปภาพ
app.post('/api/vegetables', upload.single('imageFile'), (req, res) => {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
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
    const sql = "DELETE FROM vegetables WHERE id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database Error' });
        }
        res.json({ message: 'Deleted successfully' });
    });
});

// แก้ไขข้อมูลผัก (Update Vegetable)
app.put('/api/vegetables/:id', upload.single('imageFile'), (req, res) => {
    const id = req.params.id;
    let { name, harvestTime, water, sunlight, months, regions, description, steps, moreTips } = req.body;
    
    // เตรียม Query เบื้องต้น
    let sql = `UPDATE vegetables SET 
               name=?, harvest_time=?, water=?, sunlight=?, months=?, regions=?, description=?, steps=?, more_tips=?`;
    
    let values = [name, harvestTime, water, sunlight, months, regions, description, steps, moreTips];

    // ถ้ามีการอัปโหลดรูปใหม่
    if (req.file) {
        const newImageUrl = `/uploads/${req.file.filename}`;
        
        // 1. หาชื่อรูปเก่าเพื่อลบทิ้ง (Option: ถ้าอยากประหยัดพื้นที่)
        db.query("SELECT image_url FROM vegetables WHERE id = ?", [id], (err, results) => {
            if (!err && results[0]?.image_url) {
                const oldPath = path.join(__dirname, 'public', results[0].image_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath); // ลบรูปเก่า
            }
        });

        // 2. เพิ่มเงื่อนไขอัปเดต column รูปภาพ
        sql += `, image_url=?`;
        values.push(newImageUrl);
    }

    // จบ Query
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
            console.error(err); // ดู Error ใน Terminal
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
            console.error(err); // ดู Error ใน Terminal
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
                    image_url: user.image_url
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
    
    // ดึงสถิติการปลูก (นับจำนวนตามสถานะ)
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
            // ส่งข้อมูลกลับไปทั้ง User และ Stats
            res.json({
                user: {
                    ...user,
                    image_url: user.image_url ? `/uploads/${path.basename(user.image_url)}` : null
                },
                stats: stats
            });
        });
    });
});

// 2. อัปเดตข้อมูลส่วนตัว (ชื่อ, รหัสผ่าน)
app.put('/api/profile/update', (req, res) => {
    const { email, name, newPassword, currentPassword } = req.body;

    // เช็ค User ก่อนว่ามีอยู่จริงและรหัสเดิมถูกไหม
    db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ error: 'Error checking user' });
        
        const user = results[0];

        // ถ้ามีการส่งรหัสผ่านใหม่มา ต้องเช็ครหัสเดิมก่อน (ระบบนี้ Password เป็น Plain Text ตามไฟล์เดิม)
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

// 3. อัปโหลดรูปโปรไฟล์ (แก้ไข: ลบรูปเก่าทิ้งด้วย)
app.post('/api/profile/upload-image', upload.single('profileImage'), (req, res) => {
    const email = req.body.email;
    
    // ถ้าไม่มีการส่งไฟล์มา (Error)
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const newImageUrl = `/uploads/${req.file.filename}`;

    // ขั้นตอนที่ 1: ไปค้นหาชื่อรูปเก่าก่อน
    db.query("SELECT image_url FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json(err);
        
        // เก็บชื่อรูปเก่าไว้ (ถ้ามี)
        const oldImageUrl = results[0]?.image_url;

        // ขั้นตอนที่ 2: อัปเดตฐานข้อมูลเป็นรูปใหม่
        const sql = "UPDATE users SET image_url = ? WHERE email = ?";
        db.query(sql, [newImageUrl, email], (updateErr, result) => {
            if (updateErr) return res.status(500).json(updateErr);

            // ขั้นตอนที่ 3: ลบรูปเก่าทิ้งจากโฟลเดอร์ (ถ้ามีรูปเก่า และรูปเก่าไม่ใช่รูปเดียวกับรูปใหม่)
            if (oldImageUrl && oldImageUrl !== newImageUrl) {
                // สร้าง Path เต็มๆ ของไฟล์ที่จะลบ
                const oldFileName = path.basename(oldImageUrl); 
                const oldFilePath = path.join(__dirname, 'public/uploads', oldFileName);

                // สั่งลบไฟล์ (fs.unlink)
                fs.unlink(oldFilePath, (unlinkErr) => {
                    if (unlinkErr) {
                        // ถ้าลบไม่ได้ (เช่น ไฟล์ไม่อยู่แล้ว) ก็ปล่อยผ่านไป ไม่ต้อง Crash
                        console.error("ลบไฟล์เก่าไม่สำเร็จ (อาจไม่มีไฟล์อยู่จริง):", unlinkErr.message);
                    } else {
                        console.log("ลบไฟล์เก่าเรียบร้อย:", oldFileName);
                    }
                });
            }

            res.json({ success: true, imageUrl: newImageUrl });
        });
    });
});

// ==========================================
// 🔴 API Routes: Admin User Management
// ==========================================

// 1. ดึงรายชื่อ User ทั้งหมด (พร้อมนับจำนวนผักที่ปลูก)
app.get('/api/users', (req, res) => {
    const sql = `
        SELECT u.id, u.name, u.email, u.role, u.created_at, u.image_url,
        (SELECT COUNT(*) FROM planting_log p WHERE p.user_email = u.email) as plant_count
        FROM users u
        ORDER BY u.id DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        
        // แปลง image_url ให้เป็น path เต็ม
        const users = results.map(u => ({
            ...u,
            image_url: u.image_url ? `/uploads/${path.basename(u.image_url)}` : null
        }));
        res.json(users);
    });
});

// 2. แอดมินเพิ่ม User ใหม่
app.post('/api/users', (req, res) => {
    const { name, email, role, password } = req.body;
    // Default password ถ้าไม่ได้กรอกมาให้เป็น 123456
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
    // ลบข้อมูลการปลูกของ user นี้ก่อน (ถ้าต้องการ Clean Data) หรือจะปล่อยไว้ก็ได้
    // ในที่นี้ลบแค่ User
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