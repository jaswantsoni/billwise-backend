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

    // Get start of today to check if reminder was already sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const expiringUsers = await prisma.user.findMany({
      where: {
        planStatus: 'active',
        planExpiry: {
          gte: twoDaysFromNow,
          lte: threeDaysFromNow
        },
        // Only include users who haven't received a reminder today
        OR: [
          { lastReminderSent: null },
          { lastReminderSent: { lt: todayStart } }
        ]
      },
      select: {
        id: true,
        email: true,
        name: true,
        planTier: true,
        planExpiry: true,
        lastReminderSent: true
      }
    });

    for (const user of expiringUsers) {
      try {
        await sendSubscriptionExpiryReminder(user);
        
        // Update the lastReminderSent field to prevent duplicate emails
        await prisma.user.update({
          where: { id: user.id },
          data: { lastReminderSent: new Date() }
        });
        
        console.log(`[CRON] Sent expiry reminder to ${user.email}`);
      } catch (error) {
        console.error(`[CRON] Failed to send reminder to ${user.email}:`, error);
      }
    }

    if (expiringUsers.length > 0) {
      console.log(`[CRON] Sent ${expiringUsers.length} expiry reminders`);
    } else {
      console.log('[CRON] No new expiry reminders to send');
    }
  } catch (error) {
    console.error('[CRON] Error sending expiry reminders:', error);
  }
};

// Run once per day at 9 AM
const startExpiryCheck = () => {
  // Run immediately on startup
  checkExpiredSubscriptions();
  sendExpiryReminders();
  
  // Schedule to run daily at 9 AM
  const scheduleDaily = () => {
    const now = new Date();
    const scheduledTime = new Date();
    scheduledTime.setHours(9, 0, 0, 0); // 9:00 AM
    
    // If it's already past 9 AM today, schedule for tomorrow
    if (now > scheduledTime) {
      scheduledTime.setDate(scheduledTime.getDate() + 1);
    }
    
    const timeUntilScheduled = scheduledTime.getTime() - now.getTime();
    
    setTimeout(() => {
      checkExpiredSubscriptions();
      sendExpiryReminders();
      
      // Schedule the next run (24 hours later)
      setInterval(() => {
        checkExpiredSubscriptions();
        sendExpiryReminders();
      }, 24 * 60 * 60 * 1000); // 24 hours
      
    }, timeUntilScheduled);
    
    console.log(`[CRON] Expiry check scheduled for ${scheduledTime.toLocaleString()}`);
  };
  
  scheduleDaily();
};

module.exports = { startExpiryCheck, checkExpiredSubscriptions, sendExpiryReminders };
