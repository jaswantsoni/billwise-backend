const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/prisma');
const { sendWelcomeEmail } = require('../services/emailHelpers');

exports.register = async (req, res) => {
  try {
    const { email, name, password } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 15);

    const user = await prisma.user.create({
      data: { 
        email, 
        name, 
        password: hashedPassword,
        planTier: 'premium',
        planStatus: 'active',
        planExpiry: trialExpiry
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
    if (error.code === 'P2002') {
      return res.status(400).json({ error: error });
    }
    res.status(500).json({ error: 'Registration failed' });
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
