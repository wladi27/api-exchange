require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dolar_api';

const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL || 'admin@dolarapi.com';
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'Admin123456!';
const ADMIN_NAME = process.env.INITIAL_ADMIN_NAME || 'Super Administrador';

async function seedAdmin() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    let admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

    if (admin) {
      console.log(`ℹ️ El usuario administrador (${ADMIN_EMAIL}) ya existe.`);
      process.exit(0);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, salt);

    admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      passwordHash,
      role: 'admin',
      plan: 'enterprise',
      subscriptionStatus: 'active'
    });

    console.log('='.repeat(50));
    console.log('✅ USUARIO ADMINISTRADOR CREADO EXITOSAMENTE:');
    console.log(`Email:    ${admin.email}`);
    console.log(`Password: ${ADMIN_PASSWORD}`);
    console.log(`Role:     ${admin.role}`);
    console.log('='.repeat(50));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creando administrador:', error.message);
    process.exit(1);
  }
}

seedAdmin();
