const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Generate Purchase Register Report
 * Shows all purchases within a date range with optional supplier filter
 * 
 * @param {string} organisationId - Organisation ID
 * @param {Object} dateRange - { startDate, endDate }
 * @param {Object} filters - Optional filters { supplierId }
 * @returns {Promise<Object>} Purchase register with totals
 */
async function generatePurchaseRegister(organisationId, dateRange = {}, filters = {}) {
  const whereClause = {
    organisationId,
    status: 'FINALIZED'
  };

  // Apply date range filter
  if (dateRange.startDate || dateRange.endDate) {
    whereClause.purchaseDate = {};
    if (dateRange.startDate) {
      whereClause.purchaseDate.gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      whereClause.purchaseDate.lte = new Date(dateRange.endDate);
    }
  }

  // Apply supplier filter
  if (filters.supplierId) {
    whereClause.supplierId = filters.supplierId;
  }

  // Fetch purchases with supplier details
  const purchases = await prisma.purchase.findMany({
    where: whereClause,
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          gstin: true
        }
      }
    },
    orderBy: {
      purchaseDate: 'asc'
    }
  });

  // Format purchases for report
  const formattedPurchases = purchases.map(purchase => ({
    billNumber: purchase.billNumber,
    date: purchase.purchaseDate,
    supplierName: purchase.supplier.name,
    supplierGSTIN: purchase.supplier.gstin,
    invoiceNumber: purchase.invoiceNumber,
    subtotal: parseFloat(purchase.subtotal.toFixed(2)),
    cgst: parseFloat(purchase.cgst.toFixed(2)),
    sgst: parseFloat(purchase.sgst.toFixed(2)),
    igst: parseFloat(purchase.igst.toFixed(2)),
    totalTax: parseFloat(purchase.totalTax.toFixed(2)),
    grandTotal: parseFloat(purchase.grandTotal.toFixed(2))
  }));

  // Calculate totals
  const totals = formattedPurchases.reduce(
    (acc, purchase) => ({
      subtotal: acc.subtotal + purchase.subtotal,
      cgst: acc.cgst + purchase.cgst,
      sgst: acc.sgst + purchase.sgst,
      igst: acc.igst + purchase.igst,
      totalTax: acc.totalTax + purchase.totalTax,
      grandTotal: acc.grandTotal + purchase.grandTotal
    }),
    { subtotal: 0, cgst: 0, sgst: 0, igst: 0, totalTax: 0, grandTotal: 0 }
  );

  // Round totals to 2 decimal places
  Object.keys(totals).forEach(key => {
    totals[key] = parseFloat(totals[key].toFixed(2));
  });

  return {
    purchases: formattedPurchases,
    totals,
    count: formattedPurchases.length,
    dateRange
  };
}

/**
 * Generate Supplier Ledger Report
 * Shows all transactions with a supplier including opening balance, purchases, payments, and closing balance
 * 
 * @param {string} supplierId - Supplier ID
 * @param {Object} dateRange - { startDate, endDate }
 * @returns {Promise<Object>} Supplier ledger with transactions
 */
async function generateSupplierLedger(supplierId, dateRange = {}) {
  // Get supplier details
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: {
      id: true,
      name: true,
      gstin: true,
      mobile: true,
      email: true,
      address: true,
      openingBalance: true
    }
  });

  if (!supplier) {
    throw new Error('Supplier not found');
  }

  // Build where clause for purchases
  const whereClause = {
    supplierId,
    status: 'FINALIZED'
  };

  if (dateRange.startDate || dateRange.endDate) {
    whereClause.purchaseDate = {};
    if (dateRange.startDate) {
      whereClause.purchaseDate.gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      whereClause.purchaseDate.lte = new Date(dateRange.endDate);
    }
  }

  // Fetch purchases
  const purchases = await prisma.purchase.findMany({
    where: whereClause,
    orderBy: {
      purchaseDate: 'asc'
    },
    select: {
      id: true,
      billNumber: true,
      invoiceNumber: true,
      purchaseDate: true,
      dueDate: true,
      grandTotal: true,
      paidAmount: true,
      paymentStatus: true
    }
  });

  // Format transactions
  let runningBalance = supplier.openingBalance;
  const transactions = [];

  for (const purchase of purchases) {
    runningBalance += purchase.grandTotal;
    
    transactions.push({
      date: purchase.purchaseDate,
      type: 'PURCHASE',
      referenceNumber: purchase.billNumber,
      invoiceNumber: purchase.invoiceNumber,
      debit: parseFloat(purchase.grandTotal.toFixed(2)),
      credit: 0,
      balance: parseFloat(runningBalance.toFixed(2)),
      dueDate: purchase.dueDate,
      paymentStatus: purchase.paymentStatus
    });

    // Add payment transaction if any amount is paid
    if (purchase.paidAmount > 0) {
      runningBalance -= purchase.paidAmount;
      
      transactions.push({
        date: purchase.purchaseDate,
        type: 'PAYMENT',
        referenceNumber: purchase.billNumber,
        invoiceNumber: purchase.invoiceNumber,
        debit: 0,
        credit: parseFloat(purchase.paidAmount.toFixed(2)),
        balance: parseFloat(runningBalance.toFixed(2)),
        dueDate: null,
        paymentStatus: purchase.paymentStatus
      });
    }
  }

  return {
    supplier,
    openingBalance: parseFloat(supplier.openingBalance.toFixed(2)),
    closingBalance: parseFloat(runningBalance.toFixed(2)),
    transactions,
    dateRange
  };
}

/**
 * Generate Stock Summary Report
 * Shows current stock levels and valuations for all products
 * 
 * @param {string} organisationId - Organisation ID
 * @param {Object} filters - Optional filters { lowStock: boolean }
 * @returns {Promise<Object>} Stock summary with products and total valuation
 */
async function generateStockSummary(organisationId, filters = {}) {
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
      minStock: true,
      unit: true
    },
    orderBy: {
      name: 'asc'
    }
  });

  let totalValuation = 0;
  let productSummaries = products.map(product => {
    const stockValuation = product.stockQuantity * product.avgCost;
    totalValuation += stockValuation;
    const isLowStock = product.stockQuantity < product.minStock;

    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      stockQuantity: parseFloat(product.stockQuantity.toFixed(2)),
      avgCost: parseFloat(product.avgCost.toFixed(4)),
      stockValuation: parseFloat(stockValuation.toFixed(2)),
      minStock: parseFloat(product.minStock.toFixed(2)),
      isLowStock
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
 * Generate Stock Ledger Report
 * Shows all stock movements for a specific product
 * 
 * @param {string} productId - Product ID
 * @param {Object} dateRange - { startDate, endDate }
 * @returns {Promise<Object>} Stock ledger with transactions
 */
async function generateStockLedger(productId, dateRange = {}) {
  // Get product details
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      stockQuantity: true,
      avgCost: true,
      unit: true
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

  // Calculate opening stock
  let openingStock = 0;
  if (transactions.length > 0) {
    openingStock = transactions[0].stockBefore;
  }

  // Format transactions for display
  const formattedTransactions = transactions.map(txn => ({
    date: txn.createdAt,
    type: txn.transactionType,
    referenceType: txn.referenceType,
    referenceId: txn.referenceId,
    quantityIn: txn.quantity > 0 ? parseFloat(txn.quantity.toFixed(2)) : 0,
    quantityOut: txn.quantity < 0 ? parseFloat(Math.abs(txn.quantity).toFixed(2)) : 0,
    balance: parseFloat(txn.stockAfter.toFixed(2)),
    rate: txn.ratePerUnit ? parseFloat(txn.ratePerUnit.toFixed(2)) : null,
    avgCost: parseFloat(txn.avgCostAfter.toFixed(4)),
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
      sku: product.sku,
      unit: product.unit
    },
    openingStock: parseFloat(openingStock.toFixed(2)),
    closingStock: parseFloat(closingStock.toFixed(2)),
    currentStock: parseFloat(product.stockQuantity.toFixed(2)),
    transactions: formattedTransactions,
    dateRange
  };
}

/**
 * Generate Product Profit Report
 * Shows profit analysis for all products based on sales
 * 
 * @param {string} organisationId - Organisation ID
 * @param {Object} dateRange - { startDate, endDate }
 * @returns {Promise<Object>} Product profit report
 */
async function generateProductProfit(organisationId, dateRange = {}) {
  // Build where clause for invoices
  const whereClause = {
    organisationId,
    status: 'FINALIZED'
  };

  if (dateRange.startDate || dateRange.endDate) {
    whereClause.invoiceDate = {};
    if (dateRange.startDate) {
      whereClause.invoiceDate.gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      whereClause.invoiceDate.lte = new Date(dateRange.endDate);
    }
  }

  // Fetch invoices with items
  const invoices = await prisma.invoice.findMany({
    where: whereClause,
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              avgCost: true
            }
          }
        }
      }
    }
  });

  // Aggregate sales by product
  const productSales = {};

  for (const invoice of invoices) {
    for (const item of invoice.items) {
      const productId = item.productId;
      const productName = item.product.name;
      
      // Get average cost at time of sale (use current avgCost as approximation)
      const avgCost = item.product.avgCost;
      const salesValue = item.amount;
      const cogs = avgCost * item.quantity;
      const profit = salesValue - cogs;

      if (!productSales[productId]) {
        productSales[productId] = {
          productName,
          quantitySold: 0,
          salesValue: 0,
          cogs: 0,
          profit: 0
        };
      }

      productSales[productId].quantitySold += item.quantity;
      productSales[productId].salesValue += salesValue;
      productSales[productId].cogs += cogs;
      productSales[productId].profit += profit;
    }
  }

  // Format and sort by profit
  const products = Object.values(productSales)
    .map(product => ({
      productName: product.productName,
      quantitySold: parseFloat(product.quantitySold.toFixed(2)),
      salesValue: parseFloat(product.salesValue.toFixed(2)),
      cogs: parseFloat(product.cogs.toFixed(2)),
      profit: parseFloat(product.profit.toFixed(2)),
      profitPercentage: product.salesValue > 0 
        ? parseFloat(((product.profit / product.salesValue) * 100).toFixed(2))
        : 0
    }))
    .sort((a, b) => b.profit - a.profit);

  // Calculate totals
  const totals = products.reduce(
    (acc, product) => ({
      totalSales: acc.totalSales + product.salesValue,
      totalCOGS: acc.totalCOGS + product.cogs,
      totalProfit: acc.totalProfit + product.profit
    }),
    { totalSales: 0, totalCOGS: 0, totalProfit: 0 }
  );

  totals.avgProfitPercentage = totals.totalSales > 0
    ? parseFloat(((totals.totalProfit / totals.totalSales) * 100).toFixed(2))
    : 0;

  // Round totals
  totals.totalSales = parseFloat(totals.totalSales.toFixed(2));
  totals.totalCOGS = parseFloat(totals.totalCOGS.toFixed(2));
  totals.totalProfit = parseFloat(totals.totalProfit.toFixed(2));

  return {
    products,
    totals,
    dateRange
  };
}

/**
 * Generate Monthly Turnover Report
 * Shows monthly purchases, sales, and gross profit for a year
 * 
 * @param {string} organisationId - Organisation ID
 * @param {number} year - Year for the report
 * @returns {Promise<Object>} Monthly turnover report
 */
async function generateMonthlyTurnover(organisationId, year) {
  const startDate = new Date(year, 0, 1); // January 1st
  const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31st

  // Fetch all purchases for the year
  const purchases = await prisma.purchase.findMany({
    where: {
      organisationId,
      status: 'FINALIZED',
      purchaseDate: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      purchaseDate: true,
      grandTotal: true
    }
  });

  // Fetch all invoices for the year
  const invoices = await prisma.invoice.findMany({
    where: {
      organisationId,
      status: 'FINALIZED',
      invoiceDate: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              avgCost: true
            }
          }
        }
      }
    }
  });

  // Initialize monthly data
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthlyData = monthNames.map((month, index) => ({
    month,
    purchases: 0,
    sales: 0,
    grossProfit: 0
  }));

  // Aggregate purchases by month
  for (const purchase of purchases) {
    const monthIndex = purchase.purchaseDate.getMonth();
    monthlyData[monthIndex].purchases += purchase.grandTotal;
  }

  // Aggregate sales and calculate COGS by month
  for (const invoice of invoices) {
    const monthIndex = invoice.invoiceDate.getMonth();
    let invoiceSales = 0;
    let invoiceCOGS = 0;

    for (const item of invoice.items) {
      invoiceSales += item.amount;
      invoiceCOGS += item.product.avgCost * item.quantity;
    }

    monthlyData[monthIndex].sales += invoiceSales;
    monthlyData[monthIndex].grossProfit += (invoiceSales - invoiceCOGS);
  }

  // Round all values to 2 decimal places
  monthlyData.forEach(month => {
    month.purchases = parseFloat(month.purchases.toFixed(2));
    month.sales = parseFloat(month.sales.toFixed(2));
    month.grossProfit = parseFloat(month.grossProfit.toFixed(2));
  });

  // Calculate totals
  const totals = monthlyData.reduce(
    (acc, month) => ({
      totalPurchases: acc.totalPurchases + month.purchases,
      totalSales: acc.totalSales + month.sales,
      totalGrossProfit: acc.totalGrossProfit + month.grossProfit
    }),
    { totalPurchases: 0, totalSales: 0, totalGrossProfit: 0 }
  );

  // Round totals
  totals.totalPurchases = parseFloat(totals.totalPurchases.toFixed(2));
  totals.totalSales = parseFloat(totals.totalSales.toFixed(2));
  totals.totalGrossProfit = parseFloat(totals.totalGrossProfit.toFixed(2));

  return {
    year,
    months: monthlyData,
    totals
  };
}

/**
 * Generate GST Purchase Report
 * Shows GST details for all purchases, separated by intrastate and interstate
 * 
 * @param {string} organisationId - Organisation ID
 * @param {Object} dateRange - { startDate, endDate }
 * @returns {Promise<Object>} GST purchase report
 */
async function generateGSTPurchaseReport(organisationId, dateRange = {}) {
  // Get organisation state for GST type determination
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { state: true }
  });

  if (!organisation) {
    throw new Error('Organisation not found');
  }

  const businessState = organisation.state;

  // Build where clause for purchases
  const whereClause = {
    organisationId,
    status: 'FINALIZED'
  };

  if (dateRange.startDate || dateRange.endDate) {
    whereClause.purchaseDate = {};
    if (dateRange.startDate) {
      whereClause.purchaseDate.gte = new Date(dateRange.startDate);
    }
    if (dateRange.endDate) {
      whereClause.purchaseDate.lte = new Date(dateRange.endDate);
    }
  }

  // Fetch purchases with supplier details
  const purchases = await prisma.purchase.findMany({
    where: whereClause,
    include: {
      supplier: {
        select: {
          name: true,
          gstin: true,
          state: true
        }
      }
    },
    orderBy: {
      purchaseDate: 'asc'
    }
  });

  // Separate intrastate and interstate purchases
  const intrastate = [];
  const interstate = [];

  for (const purchase of purchases) {
    const isIntrastate = purchase.supplier.state === businessState;
    const purchaseData = {
      supplierGSTIN: purchase.supplier.gstin || 'N/A',
      supplierName: purchase.supplier.name,
      invoiceNumber: purchase.invoiceNumber || purchase.billNumber,
      invoiceDate: purchase.purchaseDate,
      taxableValue: parseFloat(purchase.subtotal.toFixed(2))
    };

    if (isIntrastate) {
      intrastate.push({
        ...purchaseData,
        cgst: parseFloat(purchase.cgst.toFixed(2)),
        sgst: parseFloat(purchase.sgst.toFixed(2)),
        total: parseFloat(purchase.grandTotal.toFixed(2))
      });
    } else {
      interstate.push({
        ...purchaseData,
        igst: parseFloat(purchase.igst.toFixed(2)),
        total: parseFloat(purchase.grandTotal.toFixed(2))
      });
    }
  }

  // Calculate totals
  const intrastateTotal = intrastate.reduce(
    (sum, purchase) => sum + purchase.total,
    0
  );

  const interstateTotal = interstate.reduce(
    (sum, purchase) => sum + purchase.total,
    0
  );

  const totalTaxableValue = intrastate.reduce(
    (sum, purchase) => sum + purchase.taxableValue,
    0
  ) + interstate.reduce(
    (sum, purchase) => sum + purchase.taxableValue,
    0
  );

  const totalGST = intrastate.reduce(
    (sum, purchase) => sum + purchase.cgst + purchase.sgst,
    0
  ) + interstate.reduce(
    (sum, purchase) => sum + purchase.igst,
    0
  );

  return {
    intrastate,
    interstate,
    totals: {
      intrastateTotal: parseFloat(intrastateTotal.toFixed(2)),
      interstateTotal: parseFloat(interstateTotal.toFixed(2)),
      totalTaxableValue: parseFloat(totalTaxableValue.toFixed(2)),
      totalGST: parseFloat(totalGST.toFixed(2))
    },
    dateRange
  };
}

module.exports = {
  generatePurchaseRegister,
  generateSupplierLedger,
  generateStockSummary,
  generateStockLedger,
  generateProductProfit,
  generateMonthlyTurnover,
  generateGSTPurchaseReport
};
