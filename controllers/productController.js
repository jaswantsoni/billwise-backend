const prisma = require('../config/prisma');

exports.createProduct = async (req, res) => {
  try {
    const { name, description, sku, hsnCode, sacCode, unit, price, taxRate, currency, taxInclusive } = req.body;

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
        taxInclusive: taxInclusive || false,
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: { organisationId: organisations[0].id },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ where: { organisationId: organisations[0].id } })
    ]);

    res.json({ 
      success: true, 
      data: products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
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
