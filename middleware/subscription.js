const prisma = require('../config/prisma');
const { canAccessFeature } = require('../config/features');

// Check if user has active subscription
const checkSubscription = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        planTier: true,
        planStatus: true,
        planExpiry: true,
        freeUsageCount: true,
        freeUsageLimit: true
      }
    });

    console.log('[CHECK SUBSCRIPTION] User:', req.userId, 'Plan:', user);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if plan is expired
    if (user.planExpiry && new Date(user.planExpiry) < new Date()) {
      console.log('[CHECK SUBSCRIPTION] Plan expired:', user.planExpiry);
      await prisma.user.update({
        where: { id: req.userId },
        data: { planStatus: 'expired' }
      });
      return res.status(403).json({ 
        error: 'Subscription expired',
        requiresUpgrade: true,
        currentPlan: user.planTier
      });
    }

    req.userPlan = {
      tier: user.planTier || 'free',
      status: user.planStatus || 'inactive',
      expiry: user.planExpiry
    };

    console.log('[CHECK SUBSCRIPTION] User plan set:', req.userPlan);
    next();
  } catch (error) {
    console.error('[CHECK SUBSCRIPTION] Error:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
};

// Require premium plan
const requirePremium = async (req, res, next) => {
  await checkSubscription(req, res, () => {
    if (req.userPlan.tier !== 'premium' || req.userPlan.status !== 'active') {
      return res.status(403).json({ 
        error: 'Premium plan required',
        requiresUpgrade: true,
        currentPlan: req.userPlan.tier,
        requiredPlan: 'premium'
      });
    }
    next();
  });
};

// Require at least basic plan
const requireBasic = async (req, res, next) => {
  await checkSubscription(req, res, async () => {
    console.log('[REQUIRE BASIC] Checking plan:', req.userPlan);
    
    if (req.userPlan.tier === 'free' || req.userPlan.status !== 'active') {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { freeUsageCount: true, freeUsageLimit: true }
      });

      console.log('[REQUIRE BASIC] Free usage:', user);

      if (!user.freeUsageCount) {
        console.log('[REQUIRE BASIC] freeUsageCount is undefined, user needs schema migration');
        return res.status(403).json({ 
          error: 'Basic plan required',
          requiresUpgrade: true,
          currentPlan: req.userPlan.tier || 'free',
          requiredPlan: 'basic',
          message: 'Please run: npx prisma db push'
        });
      }

      if (user.freeUsageCount >= user.freeUsageLimit) {
        console.log('[REQUIRE BASIC] Free limit exceeded');
        return res.status(403).json({ 
          error: 'Basic plan required',
          requiresUpgrade: true,
          currentPlan: req.userPlan.tier || 'free',
          requiredPlan: 'basic',
          message: `Free trial limit of ${user.freeUsageLimit} uses exceeded`
        });
      }

      await prisma.user.update({
        where: { id: req.userId },
        data: { freeUsageCount: { increment: 1 } }
      });

      console.log('[REQUIRE BASIC] Free usage incremented:', user.freeUsageCount + 1);

      req.freeUsage = {
        count: user.freeUsageCount + 1,
        limit: user.freeUsageLimit,
        remaining: user.freeUsageLimit - user.freeUsageCount - 1
      };
    }
    next();
  });
};

// Check specific feature access
const requireFeature = (feature) => async (req, res, next) => {
  await checkSubscription(req, res, () => {
    if (!canAccessFeature(req.userPlan.tier, feature)) {
      const requiredPlan = feature.startsWith('premium_') ? 'premium' : 'basic';
      return res.status(403).json({ 
        error: `${requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} plan required`,
        requiresUpgrade: true,
        currentPlan: req.userPlan.tier,
        requiredPlan
      });
    }
    next();
  });
};

module.exports = {
  checkSubscription,
  requirePremium,
  requireBasic,
  requireFeature
};
