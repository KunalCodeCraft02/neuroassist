#!/usr/bin/env node

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Admin = require('../models/admin');

async function createAdmin() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is not set in .env file');
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.error('❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
      process.exit(1);
    }

    // Check if admin already exists
    const existing = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      console.log(`⚠️  Admin with email ${email} already exists`);
      process.exit(0);
    }

    // Create new admin with 2FA enabled
    const admin = new Admin({
      email: email.toLowerCase().trim(),
      password,
      name: 'Super Admin',
      role: 'superadmin',
      twoFactorEnabled: true
    });

    // Generate 2FA secret
    const speakeasy = require('speakeasy');
    const secret = speakeasy.generateSecret({
      name: `NeuroAssist Admin (${email})`,
      issuer: "NeuroAssist"
    });
    admin.twoFactorSecret = secret.base32;

    await admin.save();
    console.log(`✅ Admin user created: ${email}`);
    console.log('🔐 2FA secret (base32):', secret.base32);
    console.log('📱 Scan this QR code in Google Authenticator:');
    console.log(secret.otpauth_url);
    console.log('\n⚠️  Please save these credentials securely!');
    console.log('After login, you will need to enter the 6-digit code from your authenticator app.');

  } catch (err) {
    console.error('❌ Error creating admin:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

createAdmin();
