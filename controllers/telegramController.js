const prisma = require('../config/prisma');
const crypto = require('crypto');

// In-memory store for link tokens (use Redis in production)
const linkTokens = new Map(); // token -> { userId, expiresAt }

// Generate a one-time link token for the authenticated user
exports.generateLinkToken = async (req, res) => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    linkTokens.set(token, { userId: req.userId, expiresAt });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KamponyBot';
    const deepLink = `https://t.me/${botUsername}?start=${token}`;

    res.json({ success: true, token, deepLink, expiresIn: 600 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Called by the bot when user clicks the deep link
exports.verifyLinkToken = async (token, telegramId, telegramUsername) => {
  const entry = linkTokens.get(token);
  if (!entry) return { success: false, error: 'Invalid or expired token' };
  if (Date.now() > entry.expiresAt) {
    linkTokens.delete(token);
    return { success: false, error: 'Token expired' };
  }

  linkTokens.delete(token);

  // Check if this telegramId is already linked to another account
  const existing = await prisma.user.findFirst({ where: { telegramId: String(telegramId) } });
  if (existing && existing.id !== entry.userId) {
    return { success: false, error: 'This Telegram account is already linked to another user' };
  }

  await prisma.user.update({
    where: { id: entry.userId },
    data: {
      telegramId: String(telegramId),
      telegramUsername: telegramUsername || null,
      telegramLinkedAt: new Date(),
    }
  });

  const user = await prisma.user.findUnique({ where: { id: entry.userId }, select: { id: true, name: true, email: true } });
  return { success: true, user };
};

// Unlink telegram
exports.unlinkTelegram = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { telegramId: null, telegramUsername: null, telegramLinkedAt: null }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get telegram status
exports.getTelegramStatus = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { telegramId: true, telegramUsername: true, telegramLinkedAt: true }
    });
    res.json({ success: true, linked: !!user?.telegramId, data: user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get user by telegramId (used by bot)
exports.getUserByTelegramId = async (telegramId) => {
  return prisma.user.findFirst({ where: { telegramId: String(telegramId) } });
};

module.exports = exports;
