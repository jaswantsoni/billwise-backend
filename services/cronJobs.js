const prisma = require('../config/prisma');
const { sendSubscriptionExpiryReminder } = require('./emailHelpers');

// Check and update expired subscriptions
const checkExpiredSubscriptions = async () => {
  try {
    console.log('[CRON] Checking expired subscriptions...');
    
    const expiredUsers = await prisma.user.updateMany({
      where: {
        planExpiry: { lt: new Date() },
        planStatus: 'active'
      },
      data: {
        planStatus: 'expired'
      }
    });

    if (expiredUsers.count > 0) {
      console.log(`[CRON] Updated ${expiredUsers.count} expired subscriptions`);
    }
  } catch (error) {
    console.error('[CRON] Error checking expired subscriptions:', error);
  }
};

// Send expiry reminders 3 days before
const sendExpiryReminders = async () => {
  try {
    console.log('[CRON] Checking for expiring subscriptions...');
    
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);
    
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    twoDaysFromNow.setHours(0, 0, 0, 0);

    const expiringUsers = await prisma.user.findMany({
      where: {
        planStatus: 'active',
        planExpiry: {
          gte: twoDaysFromNow,
          lte: threeDaysFromNow
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        planTier: true,
        planExpiry: true
      }
    });

    for (const user of expiringUsers) {
      try {
        await sendSubscriptionExpiryReminder(user);
        console.log(`[CRON] Sent expiry reminder to ${user.email}`);
      } catch (error) {
        console.error(`[CRON] Failed to send reminder to ${user.email}:`, error);
      }
    }

    if (expiringUsers.length > 0) {
      console.log(`[CRON] Sent ${expiringUsers.length} expiry reminders`);
    }
  } catch (error) {
    console.error('[CRON] Error sending expiry reminders:', error);
  }
};

// Run every hour
const startExpiryCheck = () => {
  checkExpiredSubscriptions();
  sendExpiryReminders();
  setInterval(() => {
    checkExpiredSubscriptions();
    sendExpiryReminders();
  }, 60 * 60 * 1000);
  console.log('[CRON] Expiry check scheduled (every hour)');
};

module.exports = { startExpiryCheck, checkExpiredSubscriptions, sendExpiryReminders };
