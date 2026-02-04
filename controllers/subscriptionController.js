const prisma = require('../config/prisma');

exports.activateSubscription = async (req, res) => {
  try {
    const { payment_id, product_code, tier, interval, duration_days } = req.body;
    const userId = req.userId;

    console.log('[ACTIVATE SUBSCRIPTION]', { userId, product_code, tier, interval });

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + duration_days);

    // Create subscription record
    const subscription = await prisma.subscription.create({
      data: {
        userId,
        productCode: product_code,
        tier,
        interval,
        amount: req.body.amount || 0,
        paymentId: payment_id,
        orderId: req.body.order_id,
        status: 'active',
        startDate,
        endDate
      }
    });

    // Update user plan
    await prisma.user.update({
      where: { id: userId },
      data: {
        planTier: tier,
        planInterval: interval,
        planStatus: 'active',
        planExpiry: endDate
      }
    });

    console.log('[ACTIVATE SUBSCRIPTION] Success:', subscription.id);

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
    console.error('[ACTIVATE SUBSCRIPTION] Error:', error);
    res.status(500).json({ error: 'Failed to activate subscription', details: error.message });
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

exports.webhookActivateSubscription = async (req, res) => {
  try {
    const { orderId, paymentId, amount, status } = req.body;
    const authHeader = req.headers.authorization;
    
    // Verify webhook secret
    if (!authHeader || authHeader !== `Bearer ${process.env.WEBHOOK_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }

    console.log('[WEBHOOK ACTIVATE] Processing:', { orderId, paymentId, status });

    if (status !== 'captured') {
      return res.json({ success: false, message: 'Payment not captured' });
    }

    // Find order metadata to get product info and user
    // This would need to be stored when creating the order
    // For now, we'll need the frontend to still call manual activation
    
    console.log('[WEBHOOK ACTIVATE] Order activation needed - implement order metadata lookup');
    
    res.json({ success: true, message: 'Webhook received' });
  } catch (error) {
    console.error('[WEBHOOK ACTIVATE] Error:', error);
    res.status(500).json({ error: 'Webhook activation failed' });
  }
};
