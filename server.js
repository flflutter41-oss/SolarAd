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

// CORS configuration for Netlify frontend
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

// Trust proxy for Render
app.set('trust proxy', 1);

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
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Auth middleware
function requireAuth(req, res, next) {
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
// Using free Thailand Administrative API

// Get all provinces
app.get('/api/thailand/provinces', requireAuth, async (req, res) => {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_province.json');
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching provinces:', error);
        // Fallback data
        res.json([
            { id: 1, name_th: 'กรุงเทพมหานคร', name_en: 'Bangkok' },
            { id: 2, name_th: 'นนทบุรี', name_en: 'Nonthaburi' },
            { id: 3, name_th: 'ปทุมธานี', name_en: 'Pathum Thani' },
            { id: 4, name_th: 'สมุทรปราการ', name_en: 'Samut Prakan' },
            { id: 5, name_th: 'ชลบุรี', name_en: 'Chon Buri' }
        ]);
    }
});

// Get districts (amphures) by province
app.get('/api/thailand/amphures/:provinceId', requireAuth, async (req, res) => {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_amphure.json');
        const amphures = response.data.filter(a => a.province_id === parseInt(req.params.provinceId));
        res.json(amphures);
    } catch (error) {
        console.error('Error fetching amphures:', error);
        res.json([]);
    }
});

// Get tambons (subdistricts) by amphure
app.get('/api/thailand/tambons/:amphureId', requireAuth, async (req, res) => {
    try {
        const response = await axios.get('https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_tambon.json');
        const tambons = response.data.filter(t => t.amphure_id === parseInt(req.params.amphureId));
        res.json(tambons);
    } catch (error) {
        console.error('Error fetching tambons:', error);
        res.json([]);
    }
});

// Search address using Thailand Post API (alternative free API)
app.get('/api/thailand/search', requireAuth, async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.json([]);
        }
        
        // Using ThailandPost API for address search
        const response = await axios.get(`https://thaiaddressapi-thaikub.vercel.app/v1/thailand/search`, {
            params: { q: query }
        });
        
        res.json(response.data || []);
    } catch (error) {
        console.error('Error searching address:', error);
        res.json([]);
    }
});

// ==================== LOCATION ROUTES ====================

// Get location types
app.get('/api/location-types', requireAuth, (req, res) => {
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
