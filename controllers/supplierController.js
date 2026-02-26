const prisma = require('../config/prisma');
const { validateSupplierData } = require('../services/validationService');

/**
 * Create a new supplier
 * POST /api/suppliers
 * Validates: Requirements 1.1, 1.2, 1.7
 */
exports.createSupplier = async (req, res) => {
  try {
    const { name, gstin, email, mobile, address, city, state, pincode, openingBalance, paymentTerms } = req.body;

    // Validate supplier data
    const validation = validateSupplierData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: validation.errors 
      });
    }

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ success: false, error: 'No organisation found' });
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        gstin: gstin || null,
        email: email || null,
        mobile: mobile || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        openingBalance: openingBalance || 0,
        paymentTerms: paymentTerms || null,
        organisationId: organisations[0].id
      }
    });

    res.json({ success: true, data: supplier });
  } catch (error) {
    console.error('Supplier creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create supplier' });
  }
};

/**
 * Get all suppliers with pagination and search
 * GET /api/suppliers?page=1&limit=20&search=keyword
 * Validates: Requirements 1.1
 */
exports.getSuppliers = async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
    }

    // Build search filter
    const searchFilter = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { gstin: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } }
      ]
    } : {};

    const where = {
      organisationId: organisations[0].id,
      isActive: true,
      ...searchFilter
    };

    // Get total count for pagination
    const total = await prisma.supplier.count({ where });

    // Get suppliers with pagination
    const suppliers = await prisma.supplier.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    });

    res.json({ 
      success: true, 
      data: suppliers,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Fetch suppliers error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch suppliers' });
  }
};

/**
 * Get supplier by ID with aggregated data
 * GET /api/suppliers/:id
 * Validates: Requirements 1.1, 1.4, 1.5
 */
exports.getSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id, organisationId: organisations[0].id }
    });

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Calculate total purchases (sum of all purchase grand totals)
    const purchaseAggregates = await prisma.purchase.aggregate({
      where: { 
        supplierId: id,
        organisationId: organisations[0].id
      },
      _sum: {
        grandTotal: true
      }
    });

    // Calculate pending payments (sum of unpaid and partially paid purchases)
    const pendingPaymentsAggregates = await prisma.purchase.aggregate({
      where: { 
        supplierId: id,
        organisationId: organisations[0].id,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] }
      },
      _sum: {
        grandTotal: true,
        paidAmount: true
      }
    });

    const totalPurchases = purchaseAggregates._sum.grandTotal || 0;
    const pendingPayments = (pendingPaymentsAggregates._sum.grandTotal || 0) - (pendingPaymentsAggregates._sum.paidAmount || 0);

    res.json({ 
      success: true, 
      data: {
        ...supplier,
        totalPurchases,
        pendingPayments
      }
    });
  } catch (error) {
    console.error('Fetch supplier error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supplier' });
  }
};

/**
 * Update supplier
 * PUT /api/suppliers/:id
 * Validates: Requirements 1.3, 1.7
 */
exports.updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, gstin, email, mobile, address, city, state, pincode, openingBalance, paymentTerms } = req.body;

    // Validate supplier data
    const validation = validateSupplierData(req.body);
    if (!validation.isValid) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed', 
        details: validation.errors 
      });
    }

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Check if supplier exists and belongs to user's organisation
    const existingSupplier = await prisma.supplier.findFirst({
      where: { id, organisationId: organisations[0].id }
    });

    if (!existingSupplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        gstin: gstin || null,
        email: email || null,
        mobile: mobile || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        openingBalance: openingBalance !== undefined ? openingBalance : existingSupplier.openingBalance,
        paymentTerms: paymentTerms || null
      }
    });

    res.json({ success: true, data: updatedSupplier });
  } catch (error) {
    console.error('Supplier update error:', error);
    res.status(500).json({ success: false, error: 'Failed to update supplier' });
  }
};

/**
 * Delete supplier (soft delete)
 * DELETE /api/suppliers/:id
 * Validates: Requirements 1.1
 */
exports.deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Check if supplier exists and belongs to user's organisation
    const existingSupplier = await prisma.supplier.findFirst({
      where: { id, organisationId: organisations[0].id }
    });

    if (!existingSupplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Soft delete by setting isActive to false
    const deletedSupplier = await prisma.supplier.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ success: true, message: 'Supplier deleted successfully', data: deletedSupplier });
  } catch (error) {
    console.error('Supplier deletion error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete supplier' });
  }
};

/**
 * Get supplier purchase history
 * GET /api/suppliers/:id/purchases
 * Validates: Requirements 1.6
 */
exports.getSupplierPurchases = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Verify supplier exists and belongs to user's organisation
    const supplier = await prisma.supplier.findFirst({
      where: { id, organisationId: organisations[0].id }
    });

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    const where = {
      supplierId: id,
      organisationId: organisations[0].id
    };

    // Get total count
    const total = await prisma.purchase.count({ where });

    // Get purchases with pagination
    const purchases = await prisma.purchase.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { purchaseDate: 'desc' }
    });

    res.json({ 
      success: true, 
      data: purchases,
      total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Fetch supplier purchases error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supplier purchases' });
  }
};

/**
 * Get supplier ledger
 * GET /api/suppliers/:id/ledger?startDate=&endDate=
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4
 */
exports.getSupplierLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Verify supplier exists and belongs to user's organisation
    const supplier = await prisma.supplier.findFirst({
      where: { id, organisationId: organisations[0].id }
    });

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Get all purchases for the supplier within date range
    const purchases = await prisma.purchase.findMany({
      where: {
        supplierId: id,
        organisationId: organisations[0].id,
        ...(Object.keys(dateFilter).length > 0 ? { purchaseDate: dateFilter } : {})
      },
      orderBy: { purchaseDate: 'asc' }
    });

    // Build ledger transactions
    const transactions = [];
    let runningBalance = supplier.openingBalance;

    // Add opening balance entry
    transactions.push({
      date: startDate ? new Date(startDate) : supplier.createdAt,
      type: 'OPENING_BALANCE',
      referenceNumber: '-',
      debit: supplier.openingBalance,
      credit: 0,
      balance: runningBalance,
      dueDate: null
    });

    // Add purchase transactions
    for (const purchase of purchases) {
      runningBalance += purchase.grandTotal;
      transactions.push({
        date: purchase.purchaseDate,
        type: 'PURCHASE',
        referenceNumber: purchase.billNumber,
        debit: purchase.grandTotal,
        credit: 0,
        balance: runningBalance,
        dueDate: purchase.dueDate,
        paymentStatus: purchase.paymentStatus
      });

      // If there's a payment, add payment transaction
      if (purchase.paidAmount > 0) {
        runningBalance -= purchase.paidAmount;
        transactions.push({
          date: purchase.updatedAt,
          type: 'PAYMENT',
          referenceNumber: purchase.billNumber,
          debit: 0,
          credit: purchase.paidAmount,
          balance: runningBalance,
          dueDate: null
        });
      }
    }

    res.json({ 
      success: true, 
      data: {
        supplier: {
          id: supplier.id,
          name: supplier.name,
          gstin: supplier.gstin
        },
        openingBalance: supplier.openingBalance,
        closingBalance: runningBalance,
        transactions
      }
    });
  } catch (error) {
    console.error('Fetch supplier ledger error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch supplier ledger' });
  }
};
