const mongoose = require('mongoose');
const { User } = require('./models');

async function connectDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB Atlas');
        
        // Create default admin user if not exists
        await createDefaultUsers();
        
        return mongoose.connection;
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        throw error;
    }
}

async function createDefaultUsers() {
    try {
        // Check if admin exists
        const adminExists = await User.findOne({ username: 'admin' });
        if (!adminExists) {
            await User.create({
                username: 'admin',
                password: 'admin123',
                full_name: 'Administrator',
                email: 'admin@solar.com',
                role: 'admin'
            });
            console.log('📋 Default admin user created (admin / admin123)');
        }

        // Check if demo employee exists
        const employeeExists = await User.findOne({ username: 'employee1' });
        if (!employeeExists) {
            await User.create({
                username: 'employee1',
                password: 'employee123',
                full_name: 'พนักงาน ทดสอบ',
                email: 'employee1@solar.com',
                phone: '081-234-5678',
                role: 'employee'
            });
            console.log('📋 Default employee user created (employee1 / employee123)');
        }
    } catch (error) {
        console.error('Error creating default users:', error.message);
    }
}

module.exports = { connectDatabase };
