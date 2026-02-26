const prisma = require('../config/prisma');

exports.createProduct = async (req, res) => {
  try {
    const { 
      name, description, sku, hsnCode, sacCode, hsnSac, unit, price, sellingPrice, taxRate, currency, taxInclusive,
      purchasePrice, stockQuantity, avgCost, minStock
    } = req.body;

    // Handle both 'price' and 'sellingPrice' fields
    const productPrice = price !== undefined ? price : sellingPrice;
    
    // Handle hsnSac field (split into hsnCode or sacCode)
    let finalHsnCode = hsnCode || '';
    let finalSacCode = sacCode || '';
    if (hsnSac) {
      // If it's numeric, treat as HSN, otherwise SAC
      if (/^\d+$/.test(hsnSac)) {
        finalHsnCode = hsnSac;
      } else {
        finalSacCode = hsnSac;
      }
    }

    // Validation for negative values
    if (productPrice !== undefined && productPrice < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Price cannot be negative',
        code: 'INVALID_PRICE'
      });
    }

    if (purchasePrice !== undefined && purchasePrice < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Purchase price cannot be negative',
        code: 'INVALID_PURCHASE_PRICE'
      });
    }

    if (stockQuantity !== undefined && stockQuantity < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Stock quantity cannot be negative',
        code: 'INVALID_STOCK_QUANTITY'
      });
    }

    if (minStock !== undefined && minStock < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Minimum stock cannot be negative',
        code: 'INVALID_MIN_STOCK'
      });
    }

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found for user' });
    }

    // Check if product with same SKU exists (including deleted)
    const existingProduct = await prisma.product.findUnique({
      where: {
        organisationId_sku: {
          organisationId: organisations[0].id,
          sku: sku
        }
      }
    });

    let product;
    if (existingProduct) {
      // Restore and update the product
      product = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          name,
          description: description || '',
          hsnCode: finalHsnCode,
          sacCode: finalSacCode,
          unit,
          price: productPrice,
          taxRate,
          currency: currency || 'INR',
          taxInclusive: taxInclusive || false,
          purchasePrice: purchasePrice !== undefined ? purchasePrice : 0,
          stockQuantity: stockQuantity !== undefined ? stockQuantity : 0,
          avgCost: avgCost !== undefined ? avgCost : 0,
          minStock: minStock !== undefined ? minStock : 0,
          isActive: true,
        }
      });
    } else {
      // Create new product
      product = await prisma.product.create({
        data: {
          name,
          description: description || '',
          sku,
          hsnCode: finalHsnCode,
          sacCode: finalSacCode,
          unit,
          price: productPrice,
          taxRate,
          currency: currency || 'INR',
          taxInclusive: taxInclusive || false,
          purchasePrice: purchasePrice !== undefined ? purchasePrice : 0,
          stockQuantity: stockQuantity !== undefined ? stockQuantity : 0,
          avgCost: avgCost !== undefined ? avgCost : 0,
          minStock: minStock !== undefined ? minStock : 0,
          organisationId: organisations[0].id
        }
      });
    }

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
        where: { 
          organisationId: organisations[0].id,
          isActive: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.product.count({ 
        where: { 
          organisationId: organisations[0].id,
          isActive: true
        }
      })
    ]);

    // Add low stock indicator to each product
    const productsWithLowStockIndicator = products.map(product => ({
      ...product,
      isLowStock: product.stockQuantity < product.minStock
    }));

    res.json({ 
      success: true, 
      data: productsWithLowStockIndicator,
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

    // Validation for negative values
    if (updateData.price !== undefined && updateData.price < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Price cannot be negative',
        code: 'INVALID_PRICE'
      });
    }

    if (updateData.purchasePrice !== undefined && updateData.purchasePrice < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Purchase price cannot be negative',
        code: 'INVALID_PURCHASE_PRICE'
      });
    }

    if (updateData.stockQuantity !== undefined && updateData.stockQuantity < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Stock quantity cannot be negative',
        code: 'INVALID_STOCK_QUANTITY'
      });
    }

    if (updateData.minStock !== undefined && updateData.minStock < 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Minimum stock cannot be negative',
        code: 'INVALID_MIN_STOCK'
      });
    }

    // If SKU is being updated, check for uniqueness
    if (updateData.sku) {
      const currentProduct = await prisma.product.findUnique({
        where: { id }
      });

      if (!currentProduct) {
        return res.status(404).json({ 
          success: false,
          error: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        });
      }

      // Check if another product with the same SKU exists
      const existingProduct = await prisma.product.findUnique({
        where: {
          organisationId_sku: {
            organisationId: currentProduct.organisationId,
            sku: updateData.sku
          }
        }
      });

      if (existingProduct && existingProduct.id !== id) {
        return res.status(400).json({ 
          success: false,
          error: 'A product with this SKU already exists',
          code: 'DUPLICATE_SKU'
        });
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Product update error:', error);
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
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { sku: { contains: query, mode: 'insensitive' } },
          { hsnCode: { contains: query, mode: 'insensitive' } }
        ]
      },
      take: 20
    });

    // Add low stock indicator to each product
    const productsWithLowStockIndicator = products.map(product => ({
      ...product,
      isLowStock: product.stockQuantity < product.minStock
    }));

    res.json({ success: true, data: productsWithLowStockIndicator });
  } catch (error) {
    res.status(500).json({ error: 'Failed to search products' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.product.update({
      where: { id },
      data: { isActive: false }
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

    const xlsx = require('xlsx');
    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const productsData = xlsx.utils.sheet_to_json(sheet);
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
      purchasePrice: p.purchasePrice ? parseFloat(p.purchasePrice) : 0,
      stockQuantity: p.stockQuantity ? parseFloat(p.stockQuantity) : 0,
      avgCost: p.avgCost ? parseFloat(p.avgCost) : 0,
      minStock: p.minStock ? parseFloat(p.minStock) : 0,
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

