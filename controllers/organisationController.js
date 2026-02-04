const prisma = require('../config/prisma');

exports.createOrganisation = async (req, res) => {
  try {
    // Check existing organisations count
    const existingCount = await prisma.organisation.count({
      where: { userId: req.userId }
    });

    // First organisation is free, additional require Premium
    if (existingCount >= 1) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { planTier: true, planStatus: true, planExpiry: true }
      });

      const isPremium = user.planTier === 'premium' && 
                        user.planStatus === 'active' && 
                        (!user.planExpiry || new Date(user.planExpiry) > new Date());

      if (!isPremium) {
        return res.status(403).json({
          error: 'Premium plan required',
          requiresUpgrade: true,
          currentPlan: user.planTier || 'free',
          requiredPlan: 'premium',
          feature: 'multiple_businesses'
        });
      }
    }

    const { 
      name, 
      tradeName,
      gstin, 
      pan,
      address, 
      city,
      state,
      stateCode,
      pincode,
      phone, 
      email,
      logo,
      bankName,
      branch,
      accountHolderName,
      accountNumber,
      ifsc,
      upi,
      authorizedSignatory,
      signatureUrl,
      companySealUrl
    } = req.body;

    const organisation = await prisma.organisation.create({
      data: {
        name,
        tradeName,
        gstin,
        pan,
        address,
        city,
        state,
        stateCode,
        pincode,
        phone,
        email,
        logo,
        bankName,
        branch,
        accountHolderName,
        accountNumber,
        ifsc,
        upi,
        authorizedSignatory,
        signatureUrl,
        companySealUrl,
        userId: req.userId
      }
    });

    res.json({ success: true, data: organisation });
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('gstin')) {
      return res.status(400).json({ error: 'GSTIN already registered with another organisation' });
    }
    res.status(500).json({ error: 'Failed to create organisation' });
  }
};

exports.getOrganisations = async (req, res) => {
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId }
    });

    res.json({ success: true, data: organisations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organisations' });
  }
};
