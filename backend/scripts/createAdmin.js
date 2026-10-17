require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const email = 'admin@pos.com';
    const existingAdmin = await User.findOne({ email });

    if (existingAdmin) {
      console.log('Admin account already exists.');
      return;
    }

    const password = 'Admin@12345';
    const hashedPassword = await bcrypt.hash(password, 12);

    await User.create({
      name: 'POS Administrator',
      email,
      password: hashedPassword,
      role: 'admin',
    });

    console.log('Admin account created successfully.');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Change this development password before deployment.');
  } catch (error) {
    console.error('Failed to create admin:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();