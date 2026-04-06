const prisma = require('../config/prisma');
const validationService = require('../services/validationService');
const gstService = require('../services/gstService');
const stockService = require('../services/stockService');

/**
 * Create a new purchase bill
 * Validates input, calculates GST, creates purchase record, updates stock
 */
exports.createPurchase = async (req, res) => {
  try {
    const {
      supplierId,
      billNumber,
      invoiceNumber,
      purchaseDate,
      dueDate,
      paymentMode,
      transportCharges,
      notes,
      items
    } = req.body;

    // Validate purchase data
    const validation = validationService.validatePurchaseData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Get organisation
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({
        success: false,
        error: 'No organisation found'
      });
    }

    const organisationId = organisations[0].id;
    const organisation = organisations[0];

    // Verify supplier exists and belongs to organisation
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organisationId }
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    // Verify all products exist and belong to organisation
    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, organisationId }
      });
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product not found: ${item.productId}`
        });
      }
    }

    // Auto-generate bill number if not provided
    let finalBillNumber = billNumber;
    if (!finalBillNumber) {
      const year = new Date().getFullYear();
      const lastPurchase = await prisma.purchase.findFirst({
        where: {
          organisationId,
          billNumber: { startsWith: `PUR-${year}-` }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (lastPurchase) {
        const lastNumber = parseInt(lastPurchase.billNumber.split('-')[2]);
        finalBillNumber = `PUR-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
      } else {
        finalBillNumber = `PUR-${year}-0001`;
      }
    }

    // Calculate GST breakdown
    const gstCalculation = gstService.calculatePurchaseGST(
      items,
      supplier.state,
      organisation.state
    );

    // Calculate line totals for each item
    const itemsWithLineTotals = gstCalculation.itemsWithGST.map(item => ({
      ...item,
      lineTotal: item.amount + item.taxAmount
    }));

    // Calculate grand total
    const grandTotal = gstCalculation.subtotal + gstCalculation.totalTax + (transportCharges || 0);

    // Create purchase with transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // Create purchase record
      const newPurchase = await tx.purchase.create({
        data: {
          billNumber: finalBillNumber,
          invoiceNumber: invoiceNumber || null,
          supplierId,
          purchaseDate: new Date(purchaseDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          paymentMode: paymentMode || null,
          transportCharges: transportCharges || 0,
          subtotal: gstCalculation.subtotal,
          cgst: gstCalculation.totalCGST,
          sgst: gstCalculation.totalSGST,
          igst: gstCalculation.totalIGST,
          totalTax: gstCalculation.totalTax,
          grandTotal,
          paymentStatus: 'UNPAID',
          paidAmount: 0,
          status: 'DRAFT',
          notes: notes || null,
          organisationId
        }
      });

      // Create purchase items
      for (const item of itemsWithLineTotals) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        await tx.purchaseItem.create({
          data: {
            purchaseId: newPurchase.id,
            productId: item.productId,
            description: item.description || product.name,
            hsnSac: item.hsnSac || product.hsnCode || product.sacCode || '',
            quantity: item.quantity,
            unit: item.unit || product.unit,
            rate: item.rate,
            discount: item.discount || 0,
            taxRate: item.taxRate,
            cgst: item.cgst,
            sgst: item.sgst,
            igst: item.igst,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal
          }
        });
      }

      // Update stock and moving average cost
      await stockService.updateStockOnPurchase(
        itemsWithLineTotals.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          rate: item.rate
        })),
        organisationId,
        newPurchase.id
      );

      return newPurchase;
    });

    // Fetch complete purchase with relations
    const completePurchase = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: completePurchase
    });
  } catch (error) {
    console.error('Purchase creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create purchase',
      details: error.message
    });
  }
};

/**
 * Get all purchases with optional filters
 * Supports filtering by supplier, status, and date range
 */
exports.getPurchases = async (req, res) => {
  try {
    const { supplierId, status, startDate, endDate, page = 1, limit = 20 } = req.query;

    // Get organisation
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [], total: 0, page: 1, limit: 20 });
    }

    const organisationId = organisations[0].id;

    // Build where clause
    const whereClause = { organisationId };

    if (supplierId) {
      whereClause.supplierId = supplierId;
    }

    if (status) {
      whereClause.status = status;
    }

    if (startDate || endDate) {
      whereClause.purchaseDate = {};
      if (startDate) {
        whereClause.purchaseDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.purchaseDate.lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await prisma.purchase.count({ where: whereClause });

    // Get purchases with pagination
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { purchaseDate: 'desc' },
      skip: (parseInt(page) - 1) * parseInt(limit),
      take: parseInt(limit)
    });

    res.json({
      success: true,
      data: purchases,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchases',
      details: error.message
    });
  }
};

/**
 * Get a single purchase by ID with full details
 */
exports.getPurchase = async (req, res) => {
  try {
    const { id } = req.params;

    // Get organisation
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    const organisationId = organisations[0].id;

    // Get purchase with full details
    const purchase = await prisma.purchase.findFirst({
      where: { id, organisationId },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!purchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    res.json({
      success: true,
      data: purchase
    });
  } catch (error) {
    console.error('Get purchase error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch purchase',
      details: error.message
    });
  }
};

/**
 * Update a purchase (only if not finalized)
 * Reverses old stock changes and applies new ones
 */
exports.updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      supplierId,
      billNumber,
      invoiceNumber,
      purchaseDate,
      dueDate,
      paymentMode,
      transportCharges,
      notes,
      items
    } = req.body;

    // Get organisation
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    const organisationId = organisations[0].id;
    const organisation = organisations[0];

    // Get existing purchase
    const existingPurchase = await prisma.purchase.findFirst({
      where: { id, organisationId },
      include: {
        items: true
      }
    });

    if (!existingPurchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    // Check if purchase is finalized
    if (existingPurchase.status === 'FINALIZED') {
      return res.status(422).json({
        success: false,
        error: 'Cannot update finalized purchase',
        code: 'PURCHASE_FINALIZED'
      });
    }

    // Validate purchase data
    const validation = validationService.validatePurchaseData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organisationId }
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    }

    // Verify all products exist
    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, organisationId }
      });
      if (!product) {
        return res.status(404).json({
          success: false,
          error: `Product not found: ${item.productId}`
        });
      }
    }

    // Calculate GST breakdown
    const gstCalculation = gstService.calculatePurchaseGST(
      items,
      supplier.state,
      organisation.state
    );

    // Calculate line totals
    const itemsWithLineTotals = gstCalculation.itemsWithGST.map(item => ({
      ...item,
      lineTotal: item.amount + item.taxAmount
    }));

    // Calculate grand total
    const grandTotal = gstCalculation.subtotal + gstCalculation.totalTax + (transportCharges || 0);

    // Update purchase with transaction
    const purchase = await prisma.$transaction(async (tx) => {
      // Reverse old stock changes
      await stockService.reverseStockOnPurchaseDelete(
        existingPurchase.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          rate: item.rate
        })),
        organisationId,
        existingPurchase.id
      );

      // Delete old purchase items
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: id }
      });

      // Update purchase record
      const updatedPurchase = await tx.purchase.update({
        where: { id },
        data: {
          billNumber: billNumber || existingPurchase.billNumber,
          invoiceNumber: invoiceNumber || null,
          supplierId,
          purchaseDate: new Date(purchaseDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          paymentMode: paymentMode || null,
          transportCharges: transportCharges || 0,
          subtotal: gstCalculation.subtotal,
          cgst: gstCalculation.totalCGST,
          sgst: gstCalculation.totalSGST,
          igst: gstCalculation.totalIGST,
          totalTax: gstCalculation.totalTax,
          grandTotal,
          notes: notes || null
        }
      });

      // Create new purchase items
      for (const item of itemsWithLineTotals) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });

        await tx.purchaseItem.create({
          data: {
            purchaseId: id,
            productId: item.productId,
            description: item.description || product.name,
            hsnSac: item.hsnSac || product.hsnCode || product.sacCode || '',
            quantity: item.quantity,
            unit: item.unit || product.unit,
            rate: item.rate,
            discount: item.discount || 0,
            taxRate: item.taxRate,
            cgst: item.cgst,
            sgst: item.sgst,
            igst: item.igst,
            taxAmount: item.taxAmount,
            lineTotal: item.lineTotal
          }
        });
      }

      // Apply new stock changes
      await stockService.updateStockOnPurchase(
        itemsWithLineTotals.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          rate: item.rate
        })),
        organisationId,
        id
      );

      return updatedPurchase;
    });

    // Fetch complete purchase with relations
    const completePurchase = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: completePurchase
    });
  } catch (error) {
    console.error('Purchase update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update purchase',
      details: error.message
    });
  }
};

/**
 * Delete a purchase (only if not finalized)
 * Reverses stock changes
 */
exports.deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    // Get organisation
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    const organisationId = organisations[0].id;

    // Get existing purchase
    const existingPurchase = await prisma.purchase.findFirst({
      where: { id, organisationId },
      include: {
        items: true
      }
    });

    if (!existingPurchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    // Check if purchase is finalized
    if (existingPurchase.status === 'FINALIZED') {
      return res.status(422).json({
        success: false,
        error: 'Cannot delete finalized purchase',
        code: 'PURCHASE_FINALIZED'
      });
    }

    // Delete purchase with transaction
    await prisma.$transaction(async (tx) => {
      // Reverse stock changes
      await stockService.reverseStockOnPurchaseDelete(
        existingPurchase.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          rate: item.rate
        })),
        organisationId,
        existingPurchase.id
      );

      // Delete purchase (cascade will delete items)
      await tx.purchase.delete({
        where: { id }
      });
    });

    res.json({
      success: true,
      message: 'Purchase deleted successfully'
    });
  } catch (error) {
    console.error('Purchase deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete purchase',
      details: error.message
    });
  }
};

/**
 * Finalize a purchase to lock editing
 */
exports.finalizePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    // Get organisation
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    const organisationId = organisations[0].id;

    // Get existing purchase
    const existingPurchase = await prisma.purchase.findFirst({
      where: { id, organisationId }
    });

    if (!existingPurchase) {
      return res.status(404).json({
        success: false,
        error: 'Purchase not found'
      });
    }

    // Check if already finalized
    if (existingPurchase.status === 'FINALIZED') {
      return res.status(422).json({
        success: false,
        error: 'Purchase is already finalized',
        code: 'ALREADY_FINALIZED'
      });
    }

    // Update status to finalized
    const purchase = await prisma.purchase.update({
      where: { id },
      data: {
        status: 'FINALIZED'
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: purchase,
      message: 'Purchase finalized successfully'
    });
  } catch (error) {
    console.error('Purchase finalization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to finalize purchase',
      details: error.message
    });
  }
};

// Alias for getPurchase to match design document naming
exports.getPurchaseById = exports.getPurchase;

/**
 * Update payment status of a purchase
 */
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentStatus, paidAmount, paymentMode } = req.body;

    const organisations = await prisma.organisation.findMany({ where: { userId: req.userId }, take: 1 });
    if (!organisations.length) return res.status(404).json({ success: false, error: 'Purchase not found' });

    const purchase = await prisma.purchase.findFirst({
      where: { id, organisationId: organisations[0].id }
    });
    if (!purchase) return res.status(404).json({ success: false, error: 'Purchase not found' });

    const updated = await prisma.purchase.update({
      where: { id },
      data: {
        ...(paymentStatus && { paymentStatus }),
        ...(paidAmount !== undefined && { paidAmount: parseFloat(paidAmount) }),
        ...(paymentMode && { paymentMode }),
      },
      include: { supplier: true, items: { include: { product: true } } }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update payment status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update payment status', details: error.message });
  }
};

/**
 * Upload purchase invoice image to Cloudinary
 */
exports.uploadInvoiceImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageBase64 } = req.body;

    if (!imageBase64) return res.status(400).json({ error: 'imageBase64 is required' });

    const organisations = await prisma.organisation.findMany({ where: { userId: req.userId }, take: 1 });
    if (!organisations.length) return res.status(404).json({ error: 'Purchase not found' });

    const purchase = await prisma.purchase.findFirst({
      where: { id, organisationId: organisations[0].id }
    });
    if (!purchase) return res.status(404).json({ error: 'Purchase not found' });

    // Upload to Cloudinary
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const result = await cloudinary.uploader.upload(imageBase64, {
      folder: 'kampony/purchase-invoices',
      resource_type: 'image',
      public_id: `purchase-${id}-${Date.now()}`,
    });

    const updated = await prisma.purchase.update({
      where: { id },
      data: { invoiceImage: result.secure_url }
    });

    res.json({ success: true, imageUrl: result.secure_url, data: updated });
  } catch (error) {
    console.error('Upload invoice image error:', error);
    res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
};
