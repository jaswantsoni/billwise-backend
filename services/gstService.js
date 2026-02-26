/**
 * GST Service
 * Handles GST calculations for purchases and sales
 * Supports CGST/SGST (intrastate) and IGST (interstate) calculations
 */

/**
 * Determines the GST type based on supplier and business states
 * @param {string} supplierState - State of the supplier
 * @param {string} businessState - State of the business/organization
 * @returns {string} 'INTRA' for intrastate (same state) or 'INTER' for interstate (different states)
 */
function determineGSTType(supplierState, businessState) {
  // Normalize states for comparison (trim and convert to uppercase)
  const normalizedSupplierState = (supplierState || '').trim().toUpperCase();
  const normalizedBusinessState = (businessState || '').trim().toUpperCase();

  // If either state is missing or empty, default to interstate
  if (!normalizedSupplierState || !normalizedBusinessState) {
    return 'INTER';
  }

  // Compare states
  return normalizedSupplierState === normalizedBusinessState ? 'INTRA' : 'INTER';
}

/**
 * Splits GST amount into CGST, SGST, and IGST based on GST type
 * @param {number} amount - Total GST amount to split
 * @param {number} gstRate - GST rate percentage (not used in splitting, but included for future enhancements)
 * @param {string} type - GST type: 'INTRA' or 'INTER'
 * @returns {Object} Object with cgst, sgst, and igst amounts
 */
function splitGST(amount, gstRate, type) {
  if (type === 'INTRA') {
    // For intrastate: split equally between CGST and SGST
    const halfAmount = amount / 2;
    return {
      cgst: halfAmount,
      sgst: halfAmount,
      igst: 0
    };
  } else {
    // For interstate: full amount goes to IGST
    return {
      cgst: 0,
      sgst: 0,
      igst: amount
    };
  }
}

/**
 * Calculates GST breakdown for purchase items
 * @param {Array} items - Array of purchase items with quantity, rate, discount, and taxRate
 * @param {string} supplierState - State of the supplier
 * @param {string} businessState - State of the business/organization
 * @returns {Object} Object with subtotal, totalCGST, totalSGST, totalIGST, totalTax, and itemsWithGST
 */
function calculatePurchaseGST(items, supplierState, businessState) {
  // Determine GST type
  const gstType = determineGSTType(supplierState, businessState);

  let subtotal = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let totalTax = 0;

  // Calculate GST for each item
  const itemsWithGST = items.map(item => {
    // Calculate item amount before tax
    const itemAmount = item.quantity * item.rate - (item.discount || 0);
    
    // Calculate tax amount
    const itemTaxAmount = itemAmount * (item.taxRate / 100);
    
    // Split GST based on type
    const gstSplit = splitGST(itemTaxAmount, item.taxRate, gstType);

    // Accumulate totals
    subtotal += itemAmount;
    totalTax += itemTaxAmount;
    totalCGST += gstSplit.cgst;
    totalSGST += gstSplit.sgst;
    totalIGST += gstSplit.igst;

    // Return item with GST breakdown
    return {
      ...item,
      amount: itemAmount,
      taxAmount: itemTaxAmount,
      cgst: gstSplit.cgst,
      sgst: gstSplit.sgst,
      igst: gstSplit.igst
    };
  });

  return {
    subtotal,
    totalCGST,
    totalSGST,
    totalIGST,
    totalTax,
    itemsWithGST,
    gstType
  };
}

module.exports = {
  determineGSTType,
  splitGST,
  calculatePurchaseGST
};
