const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const costService = require('./costService');

/**
 * Update stock quantities when a purchase is made
 * Creates stock transactions for audit trail
 * Updates moving average cost for each product
 * 
 * @param {Array} purchaseItems - Array of purchase items with productId, quantity, rate
 * @param {string} organisationId - Organisation ID
 * @param {string} purchaseId - Purchase ID for reference
 * @returns {Promise<void>}
 */
async function updateStockOnPurchase(purchaseItems, organisationId, purchaseId = null) {
  return await prisma.$transaction(async (tx) => {
    for (const item of purchaseItems) {
      // Get current product data
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          stockQuantity: true,
          avgCost: true,
          organisationId: true
        }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Verify product belongs to the organisation
      if (product.organisationId !== organisationId) {
        throw new Error(`Product ${item.productId} does not belong to organisation ${organisationId}`);
      }

      // Calculate new moving average cost
      const newAvgCost = costService.calculateMovingAverage(
        product.stockQuantity,
        product.avgCost,
        item.quantity,
        item.rate
      );

      const newStockQuantity = product.stockQuantity + item.quantity;

      // Update product stock and average cost
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: newStockQuantity,
          avgCost: newAvgCost
        }
      });

      // Create stock transaction for audit trail
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          transactionType: 'PURCHASE',
          quantity: item.quantity,
          referenceType: purchaseId ? 'Purchase' : null,
          referenceId: purchaseId,
          ratePerUnit: item.rate,
          avgCostBefore: product.avgCost,
          avgCostAfter: newAvgCost,
          stockBefore: product.stockQuantity,
          stockAfter: newStockQuantity,
          organisationId: organisationId
        }
      });
    }
  });
}

/**
 * Reverse stock quantities when a purchase is deleted
 * Creates negative stock transactions for audit trail
 * Recalculates moving average cost (note: this is an approximation)
 * 
 * @param {Array} purchaseItems - Array of purchase items with productId, quantity
 * @param {string} organisationId - Organisation ID
 * @param {string} purchaseId - Purchase ID for reference
 * @returns {Promise<void>}
 */
async function reverseStockOnPurchaseDelete(purchaseItems, organisationId, purchaseId = null) {
  return await prisma.$transaction(async (tx) => {
    for (const item of purchaseItems) {
      // Get current product data
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          stockQuantity: true,
          avgCost: true,
          organisationId: true
        }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Verify product belongs to the organisation
      if (product.organisationId !== organisationId) {
        throw new Error(`Product ${item.productId} does not belong to organisation ${organisationId}`);
      }

      const newStockQuantity = product.stockQuantity - item.quantity;

      // Check for negative stock
      if (newStockQuantity < 0) {
        throw new Error(`Insufficient stock for product ${item.productId}. Current: ${product.stockQuantity}, Requested: ${item.quantity}`);
      }

      // Update product stock (keep average cost as is - it's an approximation)
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: newStockQuantity
        }
      });

      // Create stock transaction for audit trail (negative quantity)
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          transactionType: 'PURCHASE',
          quantity: -item.quantity,
          referenceType: purchaseId ? 'Purchase' : null,
          referenceId: purchaseId,
          ratePerUnit: item.rate,
          avgCostBefore: product.avgCost,
          avgCostAfter: product.avgCost,
          stockBefore: product.stockQuantity,
          stockAfter: newStockQuantity,
          notes: 'Purchase deletion reversal',
          organisationId: organisationId
        }
      });
    }
  });
}

/**
 * Update stock quantities when a sale is made
 * Reduces stock by sold quantity
 * Does not change moving average cost
 * 
 * @param {Array} invoiceItems - Array of invoice items with productId, quantity
 * @param {string} organisationId - Organisation ID
 * @param {string} invoiceId - Invoice ID for reference
 * @returns {Promise<void>}
 */
async function updateStockOnSale(invoiceItems, organisationId, invoiceId = null) {
  return await prisma.$transaction(async (tx) => {
    for (const item of invoiceItems) {
      // Get current product data
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          stockQuantity: true,
          avgCost: true,
          organisationId: true
        }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Verify product belongs to the organisation
      if (product.organisationId !== organisationId) {
        throw new Error(`Product ${item.productId} does not belong to organisation ${organisationId}`);
      }

      const newStockQuantity = product.stockQuantity - item.quantity;

      // Allow negative stock — just log a warning, don't block invoice creation
      if (newStockQuantity < 0) {
        console.warn(`[Stock] Product ${item.productId} going negative: ${product.stockQuantity} → ${newStockQuantity}`);
      }

      // Update product stock (average cost remains unchanged)
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: newStockQuantity
        }
      });

      // Create stock transaction for audit trail
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          transactionType: 'SALE',
          quantity: -item.quantity,
          referenceType: invoiceId ? 'Invoice' : null,
          referenceId: invoiceId,
          ratePerUnit: item.rate || null,
          avgCostBefore: product.avgCost,
          avgCostAfter: product.avgCost,
          stockBefore: product.stockQuantity,
          stockAfter: newStockQuantity,
          organisationId: organisationId
        }
      });
    }
  });
}

/**
 * Reverse stock quantities when a sale is deleted
 * Restores stock by adding back sold quantity
 * 
 * @param {Array} invoiceItems - Array of invoice items with productId, quantity
 * @param {string} organisationId - Organisation ID
 * @param {string} invoiceId - Invoice ID for reference
 * @returns {Promise<void>}
 */
async function reverseStockOnSaleDelete(invoiceItems, organisationId, invoiceId = null) {
  return await prisma.$transaction(async (tx) => {
    for (const item of invoiceItems) {
      // Get current product data
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          stockQuantity: true,
          avgCost: true,
          organisationId: true
        }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Verify product belongs to the organisation
      if (product.organisationId !== organisationId) {
        throw new Error(`Product ${item.productId} does not belong to organisation ${organisationId}`);
      }

      const newStockQuantity = product.stockQuantity + item.quantity;

      // Update product stock (average cost remains unchanged)
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: newStockQuantity
        }
      });

      // Create stock transaction for audit trail
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          transactionType: 'SALE',
          quantity: item.quantity,
          referenceType: invoiceId ? 'Invoice' : null,
          referenceId: invoiceId,
          ratePerUnit: item.rate || null,
          avgCostBefore: product.avgCost,
          avgCostAfter: product.avgCost,
          stockBefore: product.stockQuantity,
          stockAfter: newStockQuantity,
          notes: 'Sale deletion reversal',
          organisationId: organisationId
        }
      });
    }
  });
}

/**
 * Update stock quantities when a credit note is issued
 * Increases stock for returned products
 * 
 * @param {Array} creditNoteItems - Array of credit note items with productId, quantity
 * @param {string} organisationId - Organisation ID
 * @param {string} creditNoteId - Credit note ID for reference
 * @returns {Promise<void>}
 */
async function updateStockOnCreditNote(creditNoteItems, organisationId, creditNoteId = null) {
  return await prisma.$transaction(async (tx) => {
    for (const item of creditNoteItems) {
      // Get current product data
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          stockQuantity: true,
          avgCost: true,
          organisationId: true
        }
      });

      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      // Verify product belongs to the organisation
      if (product.organisationId !== organisationId) {
        throw new Error(`Product ${item.productId} does not belong to organisation ${organisationId}`);
      }

      const newStockQuantity = product.stockQuantity + item.quantity;

      // Update product stock (average cost remains unchanged)
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stockQuantity: newStockQuantity
        }
      });

      // Create stock transaction for audit trail
      await tx.stockTransaction.create({
        data: {
          productId: item.productId,
          transactionType: 'CREDIT_NOTE',
          quantity: item.quantity,
          referenceType: creditNoteId ? 'CreditNote' : null,
          referenceId: creditNoteId,
          ratePerUnit: item.rate || null,
          avgCostBefore: product.avgCost,
          avgCostAfter: product.avgCost,
          stockBefore: product.stockQuantity,
          stockAfter: newStockQuantity,
          organisationId: organisationId
        }
      });
    }
  });
}

/**
 * Check for products with low stock levels
 * Returns products where current stock is below minimum stock level
 * 
 * @param {string} organisationId - Organisation ID
 * @returns {Promise<Array>} Array of low stock products
 */
async function checkLowStock(organisationId) {
  // Get all active products and filter in application code
  const allProducts = await prisma.product.findMany({
    where: {
      organisationId,
      isActive: true
    },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      minStock: true,
      avgCost: true
    }
  });

  // Filter products where stock is below minimum
  const lowStockProducts = allProducts.filter(
    product => product.stockQuantity < product.minStock
  );

  // Sort by stock quantity (lowest first) and calculate deficit
  return lowStockProducts
    .sort((a, b) => a.stockQuantity - b.stockQuantity)
    .map(product => ({
      ...product,
      deficit: product.minStock - product.stockQuantity,
      isLowStock: true
    }));
}

/**
 * Get stock summary for all products in an organisation
 * Optionally filter by low stock status
 * 
 * @param {string} organisationId - Organisation ID
 * @param {Object} filters - Optional filters { lowStock: boolean }
 * @returns {Promise<Object>} Stock summary with products and total valuation
 */
async function getStockSummary(organisationId, filters = {}) {
  const whereClause = {
    organisationId,
    isActive: true
  };

  const products = await prisma.product.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      avgCost: true,
      minStock: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  let totalValuation = 0;
  let productSummaries = products.map(product => {
    const stockValuation = product.stockQuantity * product.avgCost;
    totalValuation += stockValuation;

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      stockQuantity: product.stockQuantity,
      avgCost: product.avgCost,
      stockValuation: parseFloat(stockValuation.toFixed(2)),
      minStock: product.minStock,
      isLowStock: product.stockQuantity < product.minStock
    };
  });

  // Apply low stock filter if requested
  if (filters.lowStock === true) {
    productSummaries = productSummaries.filter(p => p.isLowStock);
  }

  return {
    products: productSummaries,
    totalValuation: parseFloat(totalValuation.toFixed(2)),
    totalProducts: productSummaries.length
  };
}

/**
 * Get stock ledger for a specific product
 * Shows all stock transactions within a date range
 * 
 * @param {string} productId - Product ID
 * @param {Object} dateRange - Optional date range { startDate, endDate }
 * @returns {Promise<Object>} Stock ledger with transactions and balances
 */
async function getStockLedger(productId, dateRange = {}) {
  // Get product details
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      avgCost: true
    }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  // Build where clause for transactions
  const whereClause = {
    productId
  };

  if (dateRange.startDate || dateRange.endDate) {
    whereClause.createdAt = {};
    if (dateRange.startDate) {
      whereClause.createdAt.gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      whereClause.createdAt.lte = new Date(dateRange.endDate);
    }
  }

  // Get all stock transactions
  const transactions = await prisma.stockTransaction.findMany({
    where: whereClause,
    orderBy: {
      createdAt: 'asc'
    },
    select: {
      id: true,
      transactionType: true,
      quantity: true,
      referenceType: true,
      referenceId: true,
      ratePerUnit: true,
      avgCostBefore: true,
      avgCostAfter: true,
      stockBefore: true,
      stockAfter: true,
      notes: true,
      createdAt: true
    }
  });

  // Calculate opening stock (stock before first transaction in range)
  let openingStock = 0;
  if (transactions.length > 0) {
    openingStock = transactions[0].stockBefore;
  } else if (!dateRange.startDate && !dateRange.endDate) {
    // No transactions and no date filter - opening stock is 0
    openingStock = 0;
  } else {
    // Has date filter but no transactions in range - use current stock
    openingStock = product.stockQuantity;
  }

  // Format transactions for display
  const formattedTransactions = transactions.map(txn => ({
    date: txn.createdAt,
    type: txn.transactionType,
    referenceType: txn.referenceType,
    referenceId: txn.referenceId,
    quantityIn: txn.quantity > 0 ? txn.quantity : 0,
    quantityOut: txn.quantity < 0 ? Math.abs(txn.quantity) : 0,
    balance: txn.stockAfter,
    rate: txn.ratePerUnit,
    avgCost: txn.avgCostAfter,
    notes: txn.notes
  }));

  // Calculate closing stock
  const closingStock = transactions.length > 0 
    ? transactions[transactions.length - 1].stockAfter 
    : openingStock;

  return {
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku
    },
    openingStock,
    closingStock,
    currentStock: product.stockQuantity,
    transactions: formattedTransactions
  };
}

module.exports = {
  updateStockOnPurchase,
  reverseStockOnPurchaseDelete,
  updateStockOnSale,
  reverseStockOnSaleDelete,
  updateStockOnCreditNote,
  checkLowStock,
  getStockSummary,
  getStockLedger
};
