const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const XLSX = require('xlsx');

/**
 * Export Service
 * Handles exporting report data to PDF and Excel formats
 */

/**
 * Export report data to PDF format
 * 
 * @param {Object} reportData - Report data from reportService
 * @param {string} reportType - Type of report (purchase-register, supplier-ledger, etc.)
 * @returns {Promise<Buffer>} PDF file as buffer
 */
async function exportToPDF(reportData, reportType) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  switch (reportType) {
    case 'purchase-register':
      return await generatePurchaseRegisterPDF(pdfDoc, reportData, font, boldFont);
    case 'supplier-ledger':
      return await generateSupplierLedgerPDF(pdfDoc, reportData, font, boldFont);
    case 'stock-summary':
      return await generateStockSummaryPDF(pdfDoc, reportData, font, boldFont);
    case 'stock-ledger':
      return await generateStockLedgerPDF(pdfDoc, reportData, font, boldFont);
    case 'product-profit':
      return await generateProductProfitPDF(pdfDoc, reportData, font, boldFont);
    case 'monthly-turnover':
      return await generateMonthlyTurnoverPDF(pdfDoc, reportData, font, boldFont);
    case 'gst-purchase':
      return await generateGSTPurchasePDF(pdfDoc, reportData, font, boldFont);
    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}

/**
 * Export report data to Excel format
 * 
 * @param {Object} reportData - Report data from reportService
 * @param {string} reportType - Type of report
 * @returns {Buffer} Excel file as buffer
 */
function exportToExcel(reportData, reportType) {
  switch (reportType) {
    case 'purchase-register':
      return generatePurchaseRegisterExcel(reportData);
    case 'supplier-ledger':
      return generateSupplierLedgerExcel(reportData);
    case 'stock-summary':
      return generateStockSummaryExcel(reportData);
    case 'stock-ledger':
      return generateStockLedgerExcel(reportData);
    case 'product-profit':
      return generateProductProfitExcel(reportData);
    case 'monthly-turnover':
      return generateMonthlyTurnoverExcel(reportData);
    case 'gst-purchase':
      return generateGSTPurchaseExcel(reportData);
    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}

// ============================================================================
// PDF Generation Functions
// ============================================================================

/**
 * Generate Purchase Register PDF
 */
async function generatePurchaseRegisterPDF(pdfDoc, reportData, font, boldFont) {
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  page.drawText('Purchase Register', {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont,
    color: rgb(0, 0, 0)
  });
  yPosition -= 30;

  // Date range
  if (reportData.dateRange && (reportData.dateRange.startDate || reportData.dateRange.endDate)) {
    const dateText = `Period: ${reportData.dateRange.startDate || 'Start'} to ${reportData.dateRange.endDate || 'End'}`;
    page.drawText(dateText, { x: 50, y: yPosition, size: 10, font });
    yPosition -= 25;
  }

  // Table headers
  const headers = ['Bill No', 'Date', 'Supplier', 'Invoice', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Total'];
  const colWidths = [60, 70, 100, 70, 60, 50, 50, 50, 60];
  let xPosition = 50;
  
  headers.forEach((header, i) => {
    page.drawText(header, {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i];
  });
  yPosition -= 20;

  // Table rows
  for (const purchase of reportData.purchases) {
    if (yPosition < 100) {
      // Add new page if needed
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    xPosition = 50;
    const rowData = [
      purchase.billNumber,
      new Date(purchase.date).toLocaleDateString(),
      purchase.supplierName.substring(0, 15),
      purchase.invoiceNumber || '-',
      purchase.subtotal.toFixed(2),
      purchase.cgst.toFixed(2),
      purchase.sgst.toFixed(2),
      purchase.igst.toFixed(2),
      purchase.grandTotal.toFixed(2)
    ];

    rowData.forEach((data, i) => {
      page.drawText(String(data), {
        x: xPosition,
        y: yPosition,
        size: 8,
        font
      });
      xPosition += colWidths[i];
    });
    yPosition -= 15;
  }

  // Totals
  yPosition -= 10;
  page.drawText('TOTALS:', { x: 50, y: yPosition, size: 10, font: boldFont });
  xPosition = 50 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];
  const totalsData = [
    reportData.totals.subtotal.toFixed(2),
    reportData.totals.cgst.toFixed(2),
    reportData.totals.sgst.toFixed(2),
    reportData.totals.igst.toFixed(2),
    reportData.totals.grandTotal.toFixed(2)
  ];

  totalsData.forEach((data, i) => {
    page.drawText(String(data), {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i + 4];
  });

  return await pdfDoc.save();
}

/**
 * Generate Supplier Ledger PDF
 */
async function generateSupplierLedgerPDF(pdfDoc, reportData, font, boldFont) {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  page.drawText('Supplier Ledger', {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont
  });
  yPosition -= 30;

  // Supplier details
  page.drawText(`Supplier: ${reportData.supplier.name}`, { x: 50, y: yPosition, size: 11, font: boldFont });
  yPosition -= 20;
  if (reportData.supplier.gstin) {
    page.drawText(`GSTIN: ${reportData.supplier.gstin}`, { x: 50, y: yPosition, size: 10, font });
    yPosition -= 15;
  }
  page.drawText(`Opening Balance: ₹${reportData.openingBalance.toFixed(2)}`, { x: 50, y: yPosition, size: 10, font });
  yPosition -= 30;
  // Table headers
  const headers = ['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance'];
  const colWidths = [80, 80, 100, 80, 80, 80];
  let xPosition = 50;

  headers.forEach((header, i) => {
    page.drawText(header, {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i];
  });
  yPosition -= 20;

  // Transactions
  for (const txn of reportData.transactions) {
    if (yPosition < 100) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    xPosition = 50;
    const rowData = [
      new Date(txn.date).toLocaleDateString(),
      txn.type,
      txn.referenceNumber,
      txn.debit > 0 ? txn.debit.toFixed(2) : '-',
      txn.credit > 0 ? txn.credit.toFixed(2) : '-',
      txn.balance.toFixed(2)
    ];

    rowData.forEach((data, i) => {
      page.drawText(String(data), {
        x: xPosition,
        y: yPosition,
        size: 8,
        font
      });
      xPosition += colWidths[i];
    });
    yPosition -= 15;
  }

  // Closing balance
  yPosition -= 10;
  page.drawText(`Closing Balance: ₹${reportData.closingBalance.toFixed(2)}`, {
    x: 50,
    y: yPosition,
    size: 11,
    font: boldFont
  });

  return await pdfDoc.save();
}

/**
 * Generate Stock Summary PDF
 */
async function generateStockSummaryPDF(pdfDoc, reportData, font, boldFont) {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  page.drawText('Stock Summary Report', {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont
  });
  yPosition -= 40;

  // Table headers
  const headers = ['Product', 'SKU', 'Stock', 'Avg Cost', 'Valuation', 'Min Stock'];
  const colWidths = [120, 80, 60, 70, 80, 70];
  let xPosition = 50;

  headers.forEach((header, i) => {
    page.drawText(header, {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i];
  });
  yPosition -= 20;

  // Products
  for (const product of reportData.products) {
    if (yPosition < 100) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    xPosition = 50;
    const rowData = [
      product.name.substring(0, 18),
      product.sku,
      `${product.stockQuantity} ${product.unit}`,
      product.avgCost.toFixed(2),
      product.stockValuation.toFixed(2),
      product.minStock.toFixed(2)
    ];

    rowData.forEach((data, i) => {
      page.drawText(String(data), {
        x: xPosition,
        y: yPosition,
        size: 8,
        font: product.isLowStock ? boldFont : font,
        color: product.isLowStock ? rgb(0.8, 0, 0) : rgb(0, 0, 0)
      });
      xPosition += colWidths[i];
    });
    yPosition -= 15;
  }

  // Total valuation
  yPosition -= 10;
  page.drawText(`Total Stock Valuation: ₹${reportData.totalValuation.toFixed(2)}`, {
    x: 50,
    y: yPosition,
    size: 11,
    font: boldFont
  });

  return await pdfDoc.save();
}

/**
 * Generate Stock Ledger PDF
 */
async function generateStockLedgerPDF(pdfDoc, reportData, font, boldFont) {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  page.drawText('Stock Ledger', {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont
  });
  yPosition -= 30;

  // Product details
  page.drawText(`Product: ${reportData.product.name}`, { x: 50, y: yPosition, size: 11, font: boldFont });
  yPosition -= 20;
  page.drawText(`SKU: ${reportData.product.sku}`, { x: 50, y: yPosition, size: 10, font });
  yPosition -= 15;
  page.drawText(`Opening Stock: ${reportData.openingStock} ${reportData.product.unit}`, { x: 50, y: yPosition, size: 10, font });
  yPosition -= 30;

  // Table headers
  const headers = ['Date', 'Type', 'Qty In', 'Qty Out', 'Balance', 'Avg Cost'];
  const colWidths = [80, 80, 60, 60, 60, 70];
  let xPosition = 50;

  headers.forEach((header, i) => {
    page.drawText(header, {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i];
  });
  yPosition -= 20;

  // Transactions
  for (const txn of reportData.transactions) {
    if (yPosition < 100) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    xPosition = 50;
    const rowData = [
      new Date(txn.date).toLocaleDateString(),
      txn.type,
      txn.quantityIn > 0 ? txn.quantityIn.toFixed(2) : '-',
      txn.quantityOut > 0 ? txn.quantityOut.toFixed(2) : '-',
      txn.balance.toFixed(2),
      txn.avgCost.toFixed(4)
    ];

    rowData.forEach((data, i) => {
      page.drawText(String(data), {
        x: xPosition,
        y: yPosition,
        size: 8,
        font
      });
      xPosition += colWidths[i];
    });
    yPosition -= 15;
  }

  // Closing stock
  yPosition -= 10;
  page.drawText(`Closing Stock: ${reportData.closingStock} ${reportData.product.unit}`, {
    x: 50,
    y: yPosition,
    size: 11,
    font: boldFont
  });

  return await pdfDoc.save();
}

/**
 * Generate Product Profit PDF
 */
async function generateProductProfitPDF(pdfDoc, reportData, font, boldFont) {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  page.drawText('Product Profit Report', {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont
  });
  yPosition -= 40;

  // Table headers
  const headers = ['Product', 'Qty Sold', 'Sales', 'COGS', 'Profit', 'Profit %'];
  const colWidths = [140, 60, 70, 70, 70, 60];
  let xPosition = 50;

  headers.forEach((header, i) => {
    page.drawText(header, {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i];
  });
  yPosition -= 20;

  // Products
  for (const product of reportData.products) {
    if (yPosition < 100) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    xPosition = 50;
    const rowData = [
      product.productName.substring(0, 20),
      product.quantitySold.toFixed(2),
      product.salesValue.toFixed(2),
      product.cogs.toFixed(2),
      product.profit.toFixed(2),
      `${product.profitPercentage.toFixed(2)}%`
    ];

    rowData.forEach((data, i) => {
      page.drawText(String(data), {
        x: xPosition,
        y: yPosition,
        size: 8,
        font
      });
      xPosition += colWidths[i];
    });
    yPosition -= 15;
  }

  // Totals
  yPosition -= 10;
  page.drawText('TOTALS:', { x: 50, y: yPosition, size: 10, font: boldFont });
  xPosition = 50 + colWidths[0] + colWidths[1];
  const totalsData = [
    reportData.totals.totalSales.toFixed(2),
    reportData.totals.totalCOGS.toFixed(2),
    reportData.totals.totalProfit.toFixed(2),
    `${reportData.totals.avgProfitPercentage.toFixed(2)}%`
  ];

  totalsData.forEach((data, i) => {
    page.drawText(String(data), {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i + 2];
  });

  return await pdfDoc.save();
}

/**
 * Generate Monthly Turnover PDF
 */
async function generateMonthlyTurnoverPDF(pdfDoc, reportData, font, boldFont) {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  page.drawText(`Monthly Turnover Report - ${reportData.year}`, {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont
  });
  yPosition -= 40;

  // Table headers
  const headers = ['Month', 'Purchases', 'Sales', 'Gross Profit'];
  const colWidths = [100, 100, 100, 100];
  let xPosition = 50;

  headers.forEach((header, i) => {
    page.drawText(header, {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i];
  });
  yPosition -= 20;

  // Monthly data
  for (const month of reportData.months) {
    if (yPosition < 100) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    xPosition = 50;
    const rowData = [
      month.month,
      month.purchases.toFixed(2),
      month.sales.toFixed(2),
      month.grossProfit.toFixed(2)
    ];

    rowData.forEach((data, i) => {
      page.drawText(String(data), {
        x: xPosition,
        y: yPosition,
        size: 8,
        font
      });
      xPosition += colWidths[i];
    });
    yPosition -= 15;
  }

  // Totals
  yPosition -= 10;
  page.drawText('TOTALS:', { x: 50, y: yPosition, size: 10, font: boldFont });
  xPosition = 50 + colWidths[0];
  const totalsData = [
    reportData.totals.totalPurchases.toFixed(2),
    reportData.totals.totalSales.toFixed(2),
    reportData.totals.totalGrossProfit.toFixed(2)
  ];

  totalsData.forEach((data, i) => {
    page.drawText(String(data), {
      x: xPosition,
      y: yPosition,
      size: 9,
      font: boldFont
    });
    xPosition += colWidths[i + 1];
  });

  return await pdfDoc.save();
}

/**
 * Generate GST Purchase Report PDF
 */
async function generateGSTPurchasePDF(pdfDoc, reportData, font, boldFont) {
  const page = pdfDoc.addPage([595, 842]);
  const { width, height } = page.getSize();
  let yPosition = height - 50;

  // Title
  page.drawText('GST Purchase Report', {
    x: 50,
    y: yPosition,
    size: 18,
    font: boldFont
  });
  yPosition -= 40;

  // Intrastate section
  if (reportData.intrastate.length > 0) {
    page.drawText('Intrastate Purchases (CGST/SGST)', {
      x: 50,
      y: yPosition,
      size: 12,
      font: boldFont
    });
    yPosition -= 25;

    const headers = ['GSTIN', 'Supplier', 'Invoice', 'Date', 'Taxable', 'CGST', 'SGST', 'Total'];
    const colWidths = [80, 80, 60, 60, 60, 50, 50, 60];
    let xPosition = 50;

    headers.forEach((header, i) => {
      page.drawText(header, {
        x: xPosition,
        y: yPosition,
        size: 8,
        font: boldFont
      });
      xPosition += colWidths[i];
    });
    yPosition -= 15;

    for (const purchase of reportData.intrastate) {
      if (yPosition < 100) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPosition = height - 50;
      }

      xPosition = 50;
      const rowData = [
        purchase.supplierGSTIN.substring(0, 12),
        purchase.supplierName.substring(0, 12),
        purchase.invoiceNumber.substring(0, 10),
        new Date(purchase.invoiceDate).toLocaleDateString(),
        purchase.taxableValue.toFixed(2),
        purchase.cgst.toFixed(2),
        purchase.sgst.toFixed(2),
        purchase.total.toFixed(2)
      ];

      rowData.forEach((data, i) => {
        page.drawText(String(data), {
          x: xPosition,
          y: yPosition,
          size: 7,
          font
        });
        xPosition += colWidths[i];
      });
      yPosition -= 12;
    }
    yPosition -= 20;
  }

  // Interstate section
  if (reportData.interstate.length > 0) {
    if (yPosition < 200) {
      const newPage = pdfDoc.addPage([595, 842]);
      yPosition = height - 50;
    }

    page.drawText('Interstate Purchases (IGST)', {
      x: 50,
      y: yPosition,
      size: 12,
      font: boldFont
    });
    yPosition -= 25;

    const headers = ['GSTIN', 'Supplier', 'Invoice', 'Date', 'Taxable', 'IGST', 'Total'];
    const colWidths = [90, 90, 70, 70, 70, 60, 70];
    let xPosition = 50;

    headers.forEach((header, i) => {
      page.drawText(header, {
        x: xPosition,
        y: yPosition,
        size: 8,
        font: boldFont
      });
      xPosition += colWidths[i];
    });
    yPosition -= 15;

    for (const purchase of reportData.interstate) {
      if (yPosition < 100) {
        const newPage = pdfDoc.addPage([595, 842]);
        yPosition = height - 50;
      }

      xPosition = 50;
      const rowData = [
        purchase.supplierGSTIN.substring(0, 12),
        purchase.supplierName.substring(0, 12),
        purchase.invoiceNumber.substring(0, 10),
        new Date(purchase.invoiceDate).toLocaleDateString(),
        purchase.taxableValue.toFixed(2),
        purchase.igst.toFixed(2),
        purchase.total.toFixed(2)
      ];

      rowData.forEach((data, i) => {
        page.drawText(String(data), {
          x: xPosition,
          y: yPosition,
          size: 7,
          font
        });
        xPosition += colWidths[i];
      });
      yPosition -= 12;
    }
  }

  // Totals
  yPosition -= 20;
  page.drawText('Summary:', { x: 50, y: yPosition, size: 11, font: boldFont });
  yPosition -= 20;
  page.drawText(`Total Taxable Value: ₹${reportData.totals.totalTaxableValue.toFixed(2)}`, { x: 50, y: yPosition, size: 10, font });
  yPosition -= 15;
  page.drawText(`Total GST: ₹${reportData.totals.totalGST.toFixed(2)}`, { x: 50, y: yPosition, size: 10, font });

  return await pdfDoc.save();
}

// ============================================================================
// Excel Generation Functions
// ============================================================================

/**
 * Generate Purchase Register Excel
 */
function generatePurchaseRegisterExcel(reportData) {
  const workbook = XLSX.utils.book_new();

  // Prepare data
  const data = [
    ['Purchase Register'],
    [],
    ['Bill Number', 'Date', 'Supplier', 'Invoice Number', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Total Tax', 'Grand Total']
  ];

  reportData.purchases.forEach(purchase => {
    data.push([
      purchase.billNumber,
      new Date(purchase.date).toLocaleDateString(),
      purchase.supplierName,
      purchase.invoiceNumber || '',
      purchase.subtotal,
      purchase.cgst,
      purchase.sgst,
      purchase.igst,
      purchase.totalTax,
      purchase.grandTotal
    ]);
  });

  // Add totals row
  data.push([]);
  data.push([
    'TOTALS',
    '',
    '',
    '',
    reportData.totals.subtotal,
    reportData.totals.cgst,
    reportData.totals.sgst,
    reportData.totals.igst,
    reportData.totals.totalTax,
    reportData.totals.grandTotal
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Purchase Register');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate Supplier Ledger Excel
 */
function generateSupplierLedgerExcel(reportData) {
  const workbook = XLSX.utils.book_new();

  const data = [
    ['Supplier Ledger'],
    [],
    ['Supplier:', reportData.supplier.name],
    ['GSTIN:', reportData.supplier.gstin || 'N/A'],
    ['Opening Balance:', reportData.openingBalance],
    [],
    ['Date', 'Type', 'Reference', 'Invoice', 'Debit', 'Credit', 'Balance', 'Due Date', 'Status']
  ];

  reportData.transactions.forEach(txn => {
    data.push([
      new Date(txn.date).toLocaleDateString(),
      txn.type,
      txn.referenceNumber,
      txn.invoiceNumber || '',
      txn.debit,
      txn.credit,
      txn.balance,
      txn.dueDate ? new Date(txn.dueDate).toLocaleDateString() : '',
      txn.paymentStatus || ''
    ]);
  });

  data.push([]);
  data.push(['Closing Balance:', '', '', '', '', '', reportData.closingBalance]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Supplier Ledger');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate Stock Summary Excel
 */
function generateStockSummaryExcel(reportData) {
  const workbook = XLSX.utils.book_new();

  const data = [
    ['Stock Summary Report'],
    [],
    ['Product Name', 'SKU', 'Unit', 'Stock Quantity', 'Avg Cost', 'Stock Valuation', 'Min Stock', 'Low Stock']
  ];

  reportData.products.forEach(product => {
    data.push([
      product.name,
      product.sku,
      product.unit,
      product.stockQuantity,
      product.avgCost,
      product.stockValuation,
      product.minStock,
      product.isLowStock ? 'YES' : 'NO'
    ]);
  });

  data.push([]);
  data.push(['Total Stock Valuation:', '', '', '', '', reportData.totalValuation]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Summary');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate Stock Ledger Excel
 */
function generateStockLedgerExcel(reportData) {
  const workbook = XLSX.utils.book_new();

  const data = [
    ['Stock Ledger'],
    [],
    ['Product:', reportData.product.name],
    ['SKU:', reportData.product.sku],
    ['Unit:', reportData.product.unit],
    ['Opening Stock:', reportData.openingStock],
    [],
    ['Date', 'Type', 'Reference Type', 'Quantity In', 'Quantity Out', 'Balance', 'Rate', 'Avg Cost', 'Notes']
  ];

  reportData.transactions.forEach(txn => {
    data.push([
      new Date(txn.date).toLocaleDateString(),
      txn.type,
      txn.referenceType || '',
      txn.quantityIn,
      txn.quantityOut,
      txn.balance,
      txn.rate || '',
      txn.avgCost,
      txn.notes || ''
    ]);
  });

  data.push([]);
  data.push(['Closing Stock:', '', '', '', '', reportData.closingStock]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Stock Ledger');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate Product Profit Excel
 */
function generateProductProfitExcel(reportData) {
  const workbook = XLSX.utils.book_new();

  const data = [
    ['Product Profit Report'],
    [],
    ['Product Name', 'Quantity Sold', 'Sales Value', 'COGS', 'Profit', 'Profit %']
  ];

  reportData.products.forEach(product => {
    data.push([
      product.productName,
      product.quantitySold,
      product.salesValue,
      product.cogs,
      product.profit,
      product.profitPercentage
    ]);
  });

  data.push([]);
  data.push([
    'TOTALS',
    '',
    reportData.totals.totalSales,
    reportData.totals.totalCOGS,
    reportData.totals.totalProfit,
    reportData.totals.avgProfitPercentage
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Product Profit');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate Monthly Turnover Excel
 */
function generateMonthlyTurnoverExcel(reportData) {
  const workbook = XLSX.utils.book_new();

  const data = [
    [`Monthly Turnover Report - ${reportData.year}`],
    [],
    ['Month', 'Purchases', 'Sales', 'Gross Profit']
  ];

  reportData.months.forEach(month => {
    data.push([
      month.month,
      month.purchases,
      month.sales,
      month.grossProfit
    ]);
  });

  data.push([]);
  data.push([
    'TOTALS',
    reportData.totals.totalPurchases,
    reportData.totals.totalSales,
    reportData.totals.totalGrossProfit
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Monthly Turnover');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generate GST Purchase Report Excel
 */
function generateGSTPurchaseExcel(reportData) {
  const workbook = XLSX.utils.book_new();

  // Intrastate sheet
  if (reportData.intrastate.length > 0) {
    const intrastateData = [
      ['Intrastate Purchases (CGST/SGST)'],
      [],
      ['Supplier GSTIN', 'Supplier Name', 'Invoice Number', 'Invoice Date', 'Taxable Value', 'CGST', 'SGST', 'Total']
    ];

    reportData.intrastate.forEach(purchase => {
      intrastateData.push([
        purchase.supplierGSTIN,
        purchase.supplierName,
        purchase.invoiceNumber,
        new Date(purchase.invoiceDate).toLocaleDateString(),
        purchase.taxableValue,
        purchase.cgst,
        purchase.sgst,
        purchase.total
      ]);
    });

    const intrastateSheet = XLSX.utils.aoa_to_sheet(intrastateData);
    XLSX.utils.book_append_sheet(workbook, intrastateSheet, 'Intrastate');
  }

  // Interstate sheet
  if (reportData.interstate.length > 0) {
    const interstateData = [
      ['Interstate Purchases (IGST)'],
      [],
      ['Supplier GSTIN', 'Supplier Name', 'Invoice Number', 'Invoice Date', 'Taxable Value', 'IGST', 'Total']
    ];

    reportData.interstate.forEach(purchase => {
      interstateData.push([
        purchase.supplierGSTIN,
        purchase.supplierName,
        purchase.invoiceNumber,
        new Date(purchase.invoiceDate).toLocaleDateString(),
        purchase.taxableValue,
        purchase.igst,
        purchase.total
      ]);
    });

    const interstateSheet = XLSX.utils.aoa_to_sheet(interstateData);
    XLSX.utils.book_append_sheet(workbook, interstateSheet, 'Interstate');
  }

  // Summary sheet
  const summaryData = [
    ['GST Purchase Report Summary'],
    [],
    ['Description', 'Amount'],
    ['Intrastate Total', reportData.totals.intrastateTotal],
    ['Interstate Total', reportData.totals.interstateTotal],
    ['Total Taxable Value', reportData.totals.totalTaxableValue],
    ['Total GST', reportData.totals.totalGST]
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  exportToPDF,
  exportToExcel
};
