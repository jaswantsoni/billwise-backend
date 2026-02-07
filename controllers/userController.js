const prisma = require('../config/prisma');

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        email: true,
        name: true,
        planTier: true,
        planInterval: true,
        planStatus: true,
        planExpiry: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if expired
    if (user.planExpiry && new Date(user.planExpiry) < new Date()) {
      await prisma.user.update({
        where: { id: req.userId },
        data: { planStatus: 'expired' }
      });
      user.planStatus = 'expired';
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: {
          tier: user.planTier || 'free',
          interval: user.planInterval,
          status: user.planStatus || 'inactive',
          expiry: user.planExpiry,
          isActive: user.planStatus === 'active' && (!user.planExpiry || new Date(user.planExpiry) > new Date())
        },
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('[GET PROFILE] Error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};
