const prisma = require('../config/prisma');

exports.webhookActivateSubscription = async (req, res) => {
  try {
    const { orderId, paymentId, userId, productCode, tier, interval, durationDays, amount, status } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      console.log('[WEBHOOK ACTIVATE] Unauthorized webhook attempt');
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }

    console.log('[WEBHOOK ACTIVATE] Processing:', { orderId, paymentId, userId, tier, status });

    if (status !== 'captured') {
      return res.json({ success: false, message: 'Payment not captured' });
    }

    if (!userId || !productCode || !tier) {
      console.log('[WEBHOOK ACTIVATE] Missing required data:', { userId, productCode, tier });
      return res.status(400).json({ error: 'Missing required subscription data' });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + durationDays);

    const subscription = await prisma.subscription.create({
      data: {
        userId,
        productCode,
        tier,
        interval,
        amount,
        paymentId,
        orderId,
        status: 'active',
        startDate,
        endDate
      }
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        planTier: tier,
        planInterval: interval,
        planStatus: 'active',
        planExpiry: endDate,
        lastReminderSent: null // Clear reminder flag for new subscription period
      }
    });

    console.log('[WEBHOOK ACTIVATE] Success:', { subscriptionId: subscription.id, userId, tier });

    res.json({
      success: true,
      subscription: {
        id: subscription.id,
        tier,
        interval,
        startDate,
        endDate,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('[WEBHOOK ACTIVATE] Error:', error);
    res.status(500).json({ error: 'Webhook activation failed' });
  }
};

exports.getCurrentSubscription = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        planTier: true,
        planInterval: true,
        planStatus: true,
        planExpiry: true
      }
    });

    const currentSubscription = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'active',
        endDate: { gte: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      plan: {
        tier: user.planTier,
        interval: user.planInterval,
        status: user.planStatus,
        expiry: user.planExpiry
      },
      subscription: currentSubscription
    });
  } catch (error) {
    console.error('[GET CURRENT SUBSCRIPTION] Error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
};

exports.getSubscriptionHistory = async (req, res) => {
  try {
    const userId = req.userId;

    const subscriptions = await prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      subscriptions
    });
  } catch (error) {
    console.error('[GET SUBSCRIPTION HISTORY] Error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription history' });
  }
};
