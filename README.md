# Solar Admin - ระบบบริหารจัดการลูกค้า Solar Panel

## 🚀 การ Deploy

### Backend (Render)

1. **Push โค้ดไป GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/solar-admin.git
   git push -u origin main
   ```

2. **สร้าง Web Service บน Render**
   - ไปที่ [Render Dashboard](https://dashboard.render.com)
   - คลิก "New" → "Web Service"
   - เชื่อมต่อ GitHub repo
   - ตั้งค่า:
     - **Name:** solar-admin-api
     - **Runtime:** Node
     - **Build Command:** `npm install`
     - **Start Command:** `node server.js`
   
3. **ตั้งค่า Environment Variables บน Render**
   - `MONGODB_URI` = (copy จาก MongoDB Atlas)
   - `SESSION_SECRET` = (สร้างค่า random หรือให้ Render generate)
   - `FRONTEND_URL` = https://track-solar.netlify.app (ใส่หลัง deploy Netlify)
   - `NODE_ENV` = production

4. **คัดลอก Render URL**
   - หลัง deploy สำเร็จ จะได้ URL เช่น `https://solar-admin-api.onrender.com`

---

### Frontend (Netlify)

1. **แก้ไข `frontend/js/config.js`**
   ```javascript
   const API_URL = 'https://solarad-2m7y.onrender.com';
   ```

2. **Deploy บน Netlify**
   - ไปที่ [Netlify](https://app.netlify.com)
   - คลิก "Add new site" → "Deploy manually"
   - ลาก folder `frontend` ไปวาง
   - หรือเชื่อม GitHub แล้วตั้ง:
     - **Base directory:** frontend
     - **Publish directory:** frontend

3. **คัดลอก Netlify URL**
   - เช่น `https://track-solar.netlify.app`

4. **อัปเดต Render Environment**
   - กลับไป Render → Environment
   - ตั้ง `FRONTEND_URL` = URL จาก Netlify

---

## 🔑 บัญชีเริ่มต้น

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| employee1 | employee123 | พนักงาน |

---

## 📁 โครงสร้างโปรเจค

```
AdminSolar/
├── server.js          # Backend API (Render)
├── database.js        # MongoDB connection
├── models/            # Mongoose models
├── public/            # Local development frontend
├── frontend/          # Netlify deployment
│   ├── index.html
│   ├── js/
│   │   ├── config.js  # ← แก้ API_URL ที่นี่
│   │   └── app.js
│   ├── css/
│   └── netlify.toml
├── .env               # Environment variables
└── render.yaml        # Render config
```

---

## 🛠 การพัฒนาในเครื่อง

```bash
# ติดตั้ง dependencies
npm install

# รัน server
npm start

# หรือ dev mode (auto-reload)
npm run dev
```

เปิด http://localhost:3000

---

## ✨ ฟีเจอร์

- ✅ MongoDB Atlas (Cloud Database)
- ✅ Thailand Location API (จังหวัด/อำเภอ/ตำบล)
- ✅ Google Maps Integration
- ✅ ระบบ Login/Register
- ✅ บันทึกความสนใจลูกค้า
- ✅ Admin Dashboard
- ✅ Mobile Responsive
