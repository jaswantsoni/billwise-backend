const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { sendWelcomeEmail, sendOTPEmail } = require('../services/emailHelpers');

exports.register = async (req, res) => {
  try {
    const { email, name, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 15);

    const user = await prisma.user.create({
      data: { 
        email, 
        name, 
        password: hashedPassword,
        planTier: 'premium',
        planStatus: 'active',
        planExpiry: trialEndDate
      }
    });

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Send welcome email
    sendWelcomeEmail(user).catch(err => console.error('Welcome email failed:', err));

    res.json({ 
      success: true, 
      token, 
      user: { 
        id: user.id, 
        email, 
        name,
        planTier: 'premium',
        planStatus: 'active',
        trialDays: 5
      } 
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.code === 'P2002') {
      // Prisma unique constraint violation
      const field = error.meta?.target?.[0] || 'field';
      let message = 'User already exists';
      
      if (field === 'email') {
        message = 'Email already exists';
      } else if (field === 'googleId') {
        message = 'Google account already linked';
      }
      
      return res.status(400).json({ 
        success: false, 
        error: message, 
        field: field 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Registration failed' 
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.sendPasswordResetOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.user.update({
      where: { email },
      data: { resetOTP: otp, resetOTPExpiry: otpExpiry }
    });

    await sendOTPEmail(email, otp);
    res.json({ success: true, message: 'OTP sent to email' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send OTP' });
  }
};

exports.verifyOTPAndResetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || user.resetOTP !== otp || new Date() > user.resetOTPExpiry) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword, resetOTP: null, resetOTPExpiry: null }
    });

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed' });
  }
};

exports.setPasswordForGoogleUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.password) return res.status(400).json({ error: 'Password already set' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword }
    });

    res.json({ success: true, message: 'Password set successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set password' });
  }
};
