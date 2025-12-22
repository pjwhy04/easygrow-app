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

// ==========================================
// 1. เชื่อมต่อฐานข้อมูล (แก้ไขเป็น Connection Pool)
// ==========================================
const db = mysql.createPool({
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com', 
    port: 4000,                              
    user: '3z7V8Nw9r3zyodz.root',                     
    password: 'gQRQCWX9PlVwlNLU',               
    database: 'test',
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

// ทดสอบการเชื่อมต่อครั้งแรก
db.getConnection((err, conn) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
    } else {
        console.log('✅ Connected to TiDB Cloud Database');
        conn.release(); // คืนการเชื่อมต่อเข้า Pool
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

app.post('/api/vegetables', upload.single('imageFile'), (req, res) => {
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';
    const { name, harvestTime, water, sunlight, months, regions, description, steps, moreTips } = req.body;

    const sql = `INSERT INTO vegetables 
                 (name, harvest_time, water, sunlight, months, regions, image_url, description, steps, more_tips) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [name, harvestTime, water, sunlight, months, regions, imageUrl, description, steps, moreTips];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database Error' });
        }
        res.json({ message: 'Success', id: result.insertId });
    });
});

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

app.put('/api/vegetables/:id', upload.single('imageFile'), (req, res) => {
    const id = req.params.id;
    let { name, harvestTime, water, sunlight, months, regions, description, steps, moreTips } = req.body;
    
    let sql = `UPDATE vegetables SET 
               name=?, harvest_time=?, water=?, sunlight=?, months=?, regions=?, description=?, steps=?, more_tips=?`;
    
    let values = [name, harvestTime, water, sunlight, months, regions, description, steps, moreTips];

    if (req.file) {
        const newImageUrl = `/uploads/${req.file.filename}`;
        db.query("SELECT image_url FROM vegetables WHERE id = ?", [id], (err, results) => {
            if (!err && results[0]?.image_url) {
                const oldPath = path.join(__dirname, 'public', results[0].image_url);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        });
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

app.get('/api/planting-log', (req, res) => {
    const userEmail = req.query.email;
    if (!userEmail) return res.status(400).json({ error: 'Email required' });

    const sql = "SELECT * FROM planting_log WHERE user_email = ?";
    db.query(sql, [userEmail], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

app.post('/api/planting-log', (req, res) => {
    const { ownerEmail, vegetableId, vegetableName, status, plantedDate, expectedDate, location, notes, wateringIntervalDays } = req.body;
    
    const sql = `INSERT INTO planting_log 
    (user_email, vegetable_id, vegetable_name, status, planted_date, expected_date, location, notes, watering_interval_days, last_watered_date) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [ownerEmail, vegetableId, vegetableName, status, plantedDate, expectedDate, location, notes, wateringIntervalDays, plantedDate];

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Database Error:", err); 
            return res.status(500).json(err);
        }
        res.json({ message: 'Log added', id: result.insertId });
    });
});

app.put('/api/planting-log/:id', (req, res) => {
    const id = req.params.id;
    const { status } = req.body;
    const sql = "UPDATE planting_log SET status = ? WHERE id = ?";
    db.query(sql, [status, id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Status updated' });
    });
});

app.put('/api/planting-log/:id/water', (req, res) => {
    const id = req.params.id;
    const { lastWateredDate } = req.body;
    const sql = "UPDATE planting_log SET last_watered_date = ? WHERE id = ?";
    db.query(sql, [lastWateredDate, id], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Watered successfully' });
    });
});

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

app.put('/api/planting-log/:id/details', (req, res) => {
    const id = req.params.id;
    const { vegetableId, vegetableName, plantedDate, expectedDate, location, notes } = req.body;
    const sql = `UPDATE planting_log SET vegetable_id=?, vegetable_name=?, planted_date=?, expected_date=?, location=?, notes=? WHERE id=?`;
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

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ?";
    db.query(sql, [email], (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (results.length > 0) {
            const user = results[0];
            if (password === user.password) {
                const userData = { id: user.id, name: user.name, email: user.email, role: user.role, image_url: user.image_url };
                res.json({ success: true, user: userData });
            } else {
                res.status(401).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
            }
        } else {
            res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้งานนี้' });
        }
    });
});

app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    const sql = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'user')";
    db.query(sql, [name, email, password], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
            return res.status(500).json({ error: 'สมัครสมาชิกไม่สำเร็จ' });
        }
        res.json({ message: 'User registered', id: result.insertId });
    });
});

// ==========================================
// 🟣 API Routes: Profile / Admin Management
// ==========================================

app.get('/api/profile', (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const userSql = "SELECT id, name, email, role, created_at, image_url FROM users WHERE email = ?";
    const statsSql = `SELECT COUNT(*) as total, SUM(CASE WHEN status = 'Growing' THEN 1 ELSE 0 END) as growing, SUM(CASE WHEN status = 'Ready' THEN 1 ELSE 0 END) as ready, SUM(CASE WHEN status = 'Harvested' THEN 1 ELSE 0 END) as harvested FROM planting_log WHERE user_email = ?`;

    db.query(userSql, [email], (err, userResult) => {
        if (err) return res.status(500).json(err);
        if (userResult.length === 0) return res.status(404).json({ error: 'User not found' });
        const user = userResult[0];
        db.query(statsSql, [email], (err, statsResult) => {
            if (err) return res.status(500).json(err);
            res.json({ user: { ...user, image_url: user.image_url ? `/uploads/${path.basename(user.image_url)}` : null }, stats: statsResult[0] });
        });
    });
});

app.post('/api/profile/upload-image', upload.single('profileImage'), (req, res) => {
    const email = req.body.email;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const newImageUrl = `/uploads/${req.file.filename}`;

    db.query("SELECT image_url FROM users WHERE email = ?", [email], (err, results) => {
        if (err) return res.status(500).json(err);
        const oldImageUrl = results[0]?.image_url;
        db.query("UPDATE users SET image_url = ? WHERE email = ?", [newImageUrl, email], (updateErr) => {
            if (updateErr) return res.status(500).json(updateErr);
            if (oldImageUrl && oldImageUrl !== newImageUrl) {
                const oldFilePath = path.join(__dirname, 'public/uploads', path.basename(oldImageUrl));
                if (fs.existsSync(oldFilePath)) fs.unlink(oldFilePath, (e) => e && console.error(e));
            }
            res.json({ success: true, imageUrl: newImageUrl });
        });
    });
});

app.get('/api/users', (req, res) => {
    const sql = `SELECT u.id, u.name, u.email, u.role, u.created_at, u.image_url, (SELECT COUNT(*) FROM planting_log p WHERE p.user_email = u.email) as plant_count FROM users u ORDER BY u.id DESC`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results.map(u => ({ ...u, image_url: u.image_url ? `/uploads/${path.basename(u.image_url)}` : null })));
    });
});

app.put('/api/users/:id/role', (req, res) => {
    const { role } = req.body;
    db.query("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Role updated' });
    });
});

app.delete('/api/users/:id', (req, res) => {
    db.query("DELETE FROM users WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'User deleted' });
    });
});

// ==========================================
// 🚀 Start Server
// ==========================================
app.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
}); 