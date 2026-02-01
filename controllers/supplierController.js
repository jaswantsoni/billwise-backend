const prisma = require('../config/prisma');

exports.createSupplier = async (req, res) => {
  try {
    const { name, gstin, email, phone, address, city, state, pincode } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        gstin,
        email,
        phone,
        address,
        city,
        state,
        pincode,
        organisationId: organisations[0].id
      }
    });

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error('Supplier creation error:', error);
    res.status(500).json({ error: 'Failed to create supplier' });
  }
};

exports.getSuppliers = async (req, res) => {
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { organisationId: organisations[0].id },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: suppliers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
};

exports.getSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id, organisationId: organisations[0].id }
    });

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch supplier' });
  }
};
