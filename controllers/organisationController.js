const prisma = require('../config/prisma');

exports.createOrganisation = async (req, res) => {
  try {
    const { name, gstin, address, phone, email } = req.body;

    const organisation = await prisma.organisation.create({
      data: {
        name,
        gstin,
        address,
        phone,
        email,
        userId: req.userId
      }
    });

    res.json({ success: true, data: organisation });
  } catch (error) {
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
