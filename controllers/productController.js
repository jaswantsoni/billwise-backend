const prisma = require('../config/prisma');

exports.createProduct = async (req, res) => {
  try {
    const { name, description, sku, hsnCode, sacCode, unit, price, taxRate, currency } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found for user' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        description: description || '',
        sku,
        hsnCode: hsnCode || '',
        sacCode: sacCode || '',
        unit,
        price,
        taxRate,
        currency: currency || 'INR',
        organisationId: organisations[0].id
      }
    });

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Product creation error:', error);
    res.status(500).json({ error: 'Failed to create product', details: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const products = await prisma.product.findMany({
      where: { organisationId: organisations[0].id }
    });

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
};
