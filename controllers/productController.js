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

exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.query;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });
    
    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const products = await prisma.product.findMany({
      where: {
        organisationId: organisations[0].id,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { hsnCode: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 20
    });

    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search products' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.product.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

exports.bulkUploadProducts = async (req, res) => {
  try {
    const {file} = req;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found for user' });
    }

    const productsData = await parseExcelFile(file.path);
    console.log('Parsed products data:', productsData);

    const productsToCreate = productsData.map(p => ({
      name: p.Name,
      description: p.Description || '',
      sku: p.SKU,
      hsnCode: `${p.hsnCode}` || '',
      sacCode: `${p.sacCode}` || '',
      unit: p.Unit,
      price: parseFloat(p.Price),
      taxRate: parseFloat(p.taxRate),
      currency: p.Currency || 'INR',
      taxInclusive: p.taxInclusive === 'true' || p.taxInclusive === true,
      organisationId: organisations[0].id
    }));

    const createdProducts = await prisma.product.createMany({
      data: productsToCreate
    });

    res.json({ success: true, message: `${createdProducts.count} products uploaded successfully` });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to upload products', details: error.message });
  }
};

async function parseExcelFile(filePath) {
  const xlsx = require('xlsx');
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
} 

