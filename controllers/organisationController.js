const prisma = require('../config/prisma');

exports.createOrganisation = async (req, res) => {
  try {
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

exports.updateOrganisation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const organisation = await prisma.organisation.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: organisation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organisation' });
  }
};
