require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { connectDatabase } = require('./database');
const { User, Location, CustomerInterest } = require('./models');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration - allow Netlify frontend
const allowedOrigins = [
    'https://super-solarad.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

// Add FRONTEND_URL from env if set
if (process.env.FRONTEND_URL) {
    const url = process.env.FRONTEND_URL.replace(/\/$/, '');
    if (!allowedOrigins.includes(url)) {
        allowedOrigins.push(url);
    }
}

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        
        // Remove trailing slash for comparison
        const normalizedOrigin = origin.replace(/\/$/, '');
        
        if (allowedOrigins.includes(normalizedOrigin)) {
            callback(null, normalizedOrigin);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Only serve static files if not in production (Netlify handles frontend)
if (process.env.NODE_ENV !== 'production') {
    app.use(express.static(path.join(__dirname, 'public')));
}

// Trust proxy for Render (required for secure cookies behind proxy)
app.set('trust proxy', 1);

// Determine if we're in production (Render sets NODE_ENV or has RENDER env var)
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

console.log('Environment:', {
    NODE_ENV: process.env.NODE_ENV,
    RENDER: process.env.RENDER,
    isProduction: isProduction,
    FRONTEND_URL: process.env.FRONTEND_URL
});

// Session configuration with MongoDB store
app.use(session({
    secret: process.env.SESSION_SECRET || 'solar-admin-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: { 
        secure: isProduction, // Must be true for cross-domain
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax', // Must be 'none' for cross-domain
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Auth middleware
function requireAuth(req, res, next) {
    // Debug logging
    if (isProduction) {
        console.log('Auth check:', {
            hasSession: !!req.session,
            hasUser: !!(req.session && req.session.user),
            sessionID: req.sessionID,
            cookies: req.headers.cookie ? 'present' : 'missing'
        });
    }
    
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
    }
}

// ==================== AUTH ROUTES ====================

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, full_name, email, phone } = req.body;
        
        if (!username || !password || !full_name) {
            return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
        }

        await User.create({
            username,
            password,
            full_name,
            email,
            phone,
            role: 'employee'
        });

        res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ' });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const user = await User.findOne({ 
            username: username.toLowerCase(), 
            is_active: true 
        });
        
        if (!user || !user.comparePassword(password)) {
            return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
        }

        req.session.user = {
            id: user._id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
        };

        res.json({ success: true, user: req.session.user });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: req.session.user });
});

// ==================== THAILAND LOCATION API ====================
// Load Thailand data from local files (embedded data for reliability)
const fs = require('fs');

// Province data embedded (77 provinces)
const PROVINCES = require('./data/provinces.json');

// Amphure (district) data - we'll generate basic structure
// For a full implementation, you would include complete amphure data
const AMPHURES = generateAmphures();
const TAMBONS = generateTambons();

function generateAmphures() {
    // Generate basic amphures for each province
    const amphures = [];
    let id = 1;
    
    const districtsByProvince = {
        1: ['พระนคร','ดุสิต','หนองจอก','บางรัก','บางเขน','บางกะปิ','ปทุมวัน','ป้อมปราบ','พระโขนง','มีนบุรี','ลาดกระบัง','ยานนาวา','สัมพันธวงศ์','พญาไท','ธนบุรี','บางกอกใหญ่','ห้วยขวาง','คลองสาน','ตลิ่งชัน','บางกอกน้อย','บางขุนเทียน','ภาษีเจริญ','หนองแขม','ราษฎร์บูรณะ','บางพลัด','ดินแดง','บึงกุ่ม','สาทร','บางซื่อ','จตุจักร','บางคอแหลม','ประเวศ','คลองเตย','สวนหลวง','จอมทอง','ดอนเมือง','ราชเทวี','ลาดพร้าว','วัฒนา','บางแค','หลักสี่','สายไหม','คันนายาว','สะพานสูง','วังทองหลาง','คลองสามวา','บางนา','ทวีวัฒนา','ทุ่งครุ','บางบอน'],
        2: ['เมืองสมุทรปราการ','บางบ่อ','บางพลี','พระประแดง','พระสมุทรเจดีย์','บางเสาธง'],
        3: ['เมืองนนทบุรี','บางกรวย','บางใหญ่','บางบัวทอง','ไทรน้อย','ปากเกร็ด'],
        4: ['เมืองปทุมธานี','คลองหลวง','ธัญบุรี','หนองเสือ','ลาดหลุมแก้ว','ลำลูกกา','สามโคก'],
        11: ['เมืองชลบุรี','บ้านบึง','หนองใหญ่','บางละมุง','พานทอง','พนัสนิคม','ศรีราชา','เกาะสีชัง','สัตหีบ','บ่อทอง','เกาะจันทร์'],
        39: ['เมืองเชียงใหม่','จอมทอง','แม่แจ่ม','เชียงดาว','ดอยสะเก็ด','แม่แตง','แม่ริม','สะเมิง','ฝาง','แม่อาย','พร้าว','สันป่าตอง','สันกำแพง','สันทราย','หางดง','ฮอด','ดอยเต่า','อมก๋อย','สารภี','เวียงแหง','ไชยปราการ','แม่วาง','แม่ออน','ดอยหล่อ','กัลยาณิวัฒนา'],
        46: ['เมืองเชียงราย','เวียงชัย','เชียงของ','เทิง','พาน','ป่าแดด','แม่จัน','เชียงแสน','แม่สาย','แม่สรวย','เวียงป่าเป้า','พญาเม็งราย','เวียงแก่น','ขุนตาล','แม่ฟ้าหลวง','แม่ลาว','เวียงเชียงรุ้ง','ดอยหลวง'],
        67: ['เมืองภูเก็ต','กะทู้','ถลาง'],
        71: ['เมืองสงขลา','สทิงพระ','จะนะ','นาทวี','เทพา','สะบ้าย้อย','ระโนด','กระแสสินธุ์','รัตภูมิ','สะเดา','หาดใหญ่','นาหม่อม','ควนเนียง','บางกล่ำ','สิงหนคร','คลองหอยโข่ง']
    };
    
    // Generate amphures for all provinces
    PROVINCES.forEach(province => {
        const districts = districtsByProvince[province.id] || ['เมือง' + province.name_th];
        districts.forEach((districtName, index) => {
            amphures.push({
                id: id++,
                name_th: districtName,
                name_en: districtName,
                province_id: province.id
            });
        });
    });
    
    return amphures;
}

function generateTambons() {
    // Generate basic tambons for amphures
    const tambons = [];
    let id = 1;
    
    AMPHURES.forEach(amphure => {
        // Create 3-5 sample tambons per amphure
        const numTambons = 3 + Math.floor(Math.random() * 3);
        for (let i = 1; i <= numTambons; i++) {
            tambons.push({
                id: id++,
                name_th: `ตำบล ${i}`,
                name_en: `Tambon ${i}`,
                amphure_id: amphure.id,
                zip_code: String(amphure.province_id).padStart(2, '0') + '000'
            });
        }
    });
    
    return tambons;
}

// Cache
let thailandCache = {
    provinces: PROVINCES,
    amphures: AMPHURES,
    tambons: TAMBONS,
    lastFetch: new Date()
};

// Preload is now instant since data is embedded
function preloadThailandData() {
    console.log(`✅ Thailand data loaded: ${PROVINCES.length} provinces, ${AMPHURES.length} amphures, ${TAMBONS.length} tambons`);
}

// Get all provinces (public - instant from embedded data)
app.get('/api/thailand/provinces', (req, res) => {
    res.json(thailandCache.provinces);
});

// Get districts (amphures) by province (public)
app.get('/api/thailand/amphures/:provinceId', (req, res) => {
    const amphures = thailandCache.amphures.filter(a => a.province_id === parseInt(req.params.provinceId));
    res.json(amphures);
});

// Get tambons (subdistricts) by amphure (public)
app.get('/api/thailand/tambons/:amphureId', (req, res) => {
    const tambons = thailandCache.tambons.filter(t => t.amphure_id === parseInt(req.params.amphureId));
    res.json(tambons);
});

// Get ALL Thailand data at once (for faster loading)
app.get('/api/thailand/all', (req, res) => {
    res.json({
        provinces: thailandCache.provinces,
        amphures: thailandCache.amphures,
        tambons: thailandCache.tambons
    });
});

// Search address in local data
app.get('/api/thailand/search', (req, res) => {
    const { query } = req.query;
    if (!query) {
        return res.json([]);
    }
    
    const q = query.toLowerCase();
    const results = [];
    
    // Search in provinces
    thailandCache.provinces.forEach(p => {
        if (p.name_th.includes(query) || p.name_en.toLowerCase().includes(q)) {
            results.push({ type: 'province', ...p });
        }
    });
    
    // Search in amphures (limit results)
    thailandCache.amphures.forEach(a => {
        if (a.name_th.includes(query)) {
            const province = thailandCache.provinces.find(p => p.id === a.province_id);
            results.push({ type: 'amphure', ...a, province_name: province?.name_th });
        }
    });
    
    res.json(results.slice(0, 20));
});

// ==================== LOCATION ROUTES ====================

// Get location types (public)
app.get('/api/location-types', (req, res) => {
    res.json([
        { id: 1, name: 'บ้านพักอาศัย' },
        { id: 2, name: 'อาคารพาณิชย์' },
        { id: 3, name: 'โรงงาน' },
        { id: 4, name: 'ห้างสรรพสินค้า' },
        { id: 5, name: 'โรงแรม' },
        { id: 6, name: 'โรงเรียน' },
        { id: 7, name: 'โรงพยาบาล' },
        { id: 8, name: 'อื่นๆ' }
    ]);
});

// Search/Get locations
app.get('/api/locations', requireAuth, async (req, res) => {
    try {
        const { province, district, type, search } = req.query;
        
        let query = {};
        
        if (province) {
            query['province.name_th'] = province;
        }
        if (district) {
            query['district.name_th'] = district;
        }
        if (type) {
            query.location_type = type;
        }
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { address: { $regex: search, $options: 'i' } }
            ];
        }

        const locations = await Location.find(query)
            .populate('created_by', 'full_name')
            .sort({ createdAt: -1 })
            .limit(100);
            
        res.json(locations);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

// Create location
app.post('/api/locations', requireAuth, async (req, res) => {
    try {
        const { name, address, province, district, subdistrict, postal_code, location_type, coordinates, google_place_id } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'กรุณากรอกชื่อสถานที่' });
        }

        const location = await Location.create({
            name,
            address,
            province,
            district,
            subdistrict,
            postal_code,
            location_type,
            coordinates,
            google_place_id,
            created_by: req.session.user.id
        });

        res.json({ success: true, location });
    } catch (error) {
        console.error('Create location error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

// ==================== CUSTOMER INTEREST ROUTES ====================

app.post('/api/interests', requireAuth, async (req, res) => {
    try {
        const { location_id, status, monthly_electric_bill, electricity_usage, customer_phone, customer_name, notes } = req.body;
        const employee_id = req.session.user.id;

        // Check if already exists
        let interest = await CustomerInterest.findOne({
            location: location_id,
            employee: employee_id
        });

        if (interest) {
            // Update existing
            interest.status = status;
            if (status === 'interested') {
                interest.monthly_electric_bill = monthly_electric_bill;
                interest.electricity_usage = electricity_usage;
                interest.customer_phone = customer_phone;
                interest.customer_name = customer_name;
                interest.notes = notes;
            }
            await interest.save();
        } else {
            // Create new
            const data = {
                location: location_id,
                employee: employee_id,
                status
            };
            
            if (status === 'interested') {
                data.monthly_electric_bill = monthly_electric_bill;
                data.electricity_usage = electricity_usage;
                data.customer_phone = customer_phone;
                data.customer_name = customer_name;
                data.notes = notes;
            }
            
            interest = await CustomerInterest.create(data);
        }

        res.json({ success: true, message: 'บันทึกข้อมูลสำเร็จ' });
    } catch (error) {
        console.error('Interest error:', error);
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.get('/api/my-interests', requireAuth, async (req, res) => {
    try {
        const interests = await CustomerInterest.find({ employee: req.session.user.id })
            .populate('location')
            .sort({ createdAt: -1 });
            
        res.json(interests);
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

// ==================== ADMIN ROUTES ====================

app.get('/api/admin/interests', requireAdmin, async (req, res) => {
    try {
        const { status, employee_id } = req.query;
        
        let query = {};
        if (status) query.status = status;
        if (employee_id) query.employee = employee_id;

        const interests = await CustomerInterest.find(query)
            .populate('location')
            .populate('employee', 'full_name username')
            .populate('approved_by', 'full_name')
            .sort({ createdAt: -1 });
            
        res.json(interests);
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.put('/api/admin/interests/:id/approve', requireAdmin, async (req, res) => {
    try {
        await CustomerInterest.findByIdAndUpdate(req.params.id, {
            is_approved: true,
            approved_by: req.session.user.id,
            approved_at: new Date()
        });

        res.json({ success: true, message: 'อนุมัติสำเร็จ' });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { username, password, full_name, email, phone, role } = req.body;
        
        if (!username || !password || !full_name) {
            return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
        }

        const existingUser = await User.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
        }

        await User.create({
            username,
            password,
            full_name,
            email,
            phone,
            role: role || 'employee'
        });

        res.json({ success: true, message: 'เพิ่มสมาชิกสำเร็จ' });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        const { full_name, email, phone, role, is_active } = req.body;
        
        await User.findByIdAndUpdate(req.params.id, {
            full_name,
            email,
            phone,
            role,
            is_active
        });

        res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
        if (req.params.id === req.session.user.id) {
            return res.status(400).json({ error: 'ไม่สามารถลบบัญชีตัวเองได้' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'ลบสมาชิกสำเร็จ' });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [totalInterested, totalNotInterested, totalApproved, totalEmployees, totalLocations] = await Promise.all([
            CustomerInterest.countDocuments({ status: 'interested' }),
            CustomerInterest.countDocuments({ status: 'not_interested' }),
            CustomerInterest.countDocuments({ is_approved: true }),
            User.countDocuments({ role: 'employee' }),
            Location.countDocuments()
        ]);

        res.json({
            totalInterested,
            totalNotInterested,
            totalApproved,
            totalEmployees,
            totalLocations
        });
    } catch (error) {
        res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
    }
});

// Serve main page
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
    try {
        await connectDatabase();
        
        // Preload Thailand data in background
        preloadThailandData();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
            console.log('📋 Default accounts:');
            console.log('   Admin: admin / admin123');
            console.log('   Employee: employee1 / employee123');
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
