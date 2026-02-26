/**
 * Validation Service
 * Handles validation for suppliers, products, and purchases
 * Includes GST number validation for Indian GST format
 */

/**
 * Validates Indian GST number format
 * Format: 15 characters
 * - 2 digits: State code (01-37)
 * - 10 characters: PAN (5 letters, 4 digits, 1 letter)
 * - 1 digit: Entity number (1-9, A-Z)
 * - 1 character: Z (always 'Z')
 * - 1 character: Check digit (alphanumeric)
 * 
 * Example: 27AABCU9603R1ZM
 * 
 * @param {string} gstin - GST number to validate
 * @returns {Object} Validation result with isValid and error message
 */
function validateGSTIN(gstin) {
  // Check if GSTIN is provided
  if (!gstin) {
    return { isValid: true }; // GSTIN is optional
  }

  // Remove whitespace and convert to uppercase
  const normalizedGSTIN = gstin.trim().toUpperCase();

  // Check length
  if (normalizedGSTIN.length !== 15) {
    return {
      isValid: false,
      error: 'GSTIN must be exactly 15 characters long'
    };
  }

  // Validate format using regex
  // Pattern: 2 digits + 10 char PAN + 1 alphanumeric + Z + 1 alphanumeric
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstinPattern.test(normalizedGSTIN)) {
    return {
      isValid: false,
      error: 'Invalid GSTIN format. Expected format: 2 digits (state code) + 10 characters (PAN) + 1 alphanumeric (entity) + Z + 1 alphanumeric (check digit)'
    };
  }

  // Validate state code (01-37)
  const stateCode = parseInt(normalizedGSTIN.substring(0, 2));
  if (stateCode < 1 || stateCode > 37) {
    return {
      isValid: false,
      error: 'Invalid state code. State code must be between 01 and 37'
    };
  }

  // Check that 13th character is 'Z' (index 12, 0-based)
  // Format: 2 digits + 10 chars (PAN) + 1 char (entity) + Z + 1 char (check)
  // Position 13 is at index 12
  if (normalizedGSTIN.charAt(13) !== 'Z') {
    return {
      isValid: false,
      error: 'Character at position 14 must be Z'
    };
  }

  return { isValid: true };
}

/**
 * Validates supplier data
 * @param {Object} data - Supplier data to validate
 * @returns {Object} Validation result with isValid and errors array
 */
function validateSupplierData(data) {
  const errors = [];

  // Required field: name
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Supplier name is required');
  }

  // Validate name length
  if (data.name && data.name.length > 200) {
    errors.push('Supplier name must not exceed 200 characters');
  }

  // Validate GSTIN format if provided
  if (data.gstin) {
    const gstinValidation = validateGSTIN(data.gstin);
    if (!gstinValidation.isValid) {
      errors.push(gstinValidation.error);
    }
  }

  // Validate email format if provided
  if (data.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data.email)) {
      errors.push('Invalid email format');
    }
  }

  // Validate mobile format if provided (10 digits)
  if (data.mobile) {
    const mobilePattern = /^[0-9]{10}$/;
    const normalizedMobile = data.mobile.replace(/\s+/g, '');
    if (!mobilePattern.test(normalizedMobile)) {
      errors.push('Mobile number must be exactly 10 digits');
    }
  }

  // Validate opening balance if provided
  if (data.openingBalance !== undefined && data.openingBalance !== null) {
    if (typeof data.openingBalance !== 'number' || isNaN(data.openingBalance)) {
      errors.push('Opening balance must be a valid number');
    }
  }

  // Validate payment terms if provided
  if (data.paymentTerms) {
    const validPaymentTerms = ['NET_30', 'NET_60', 'NET_90', 'COD', 'ADVANCE'];
    if (!validPaymentTerms.includes(data.paymentTerms)) {
      errors.push('Invalid payment terms. Must be one of: NET_30, NET_60, NET_90, COD, ADVANCE');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates product data
 * @param {Object} data - Product data to validate
 * @returns {Object} Validation result with isValid and errors array
 */
function validateProductData(data) {
  const errors = [];

  // Required fields
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Product name is required');
  }

  if (!data.sku || data.sku.trim().length === 0) {
    errors.push('SKU is required');
  }

  if (!data.unit || data.unit.trim().length === 0) {
    errors.push('Unit is required');
  }

  // Validate name length
  if (data.name && data.name.length > 200) {
    errors.push('Product name must not exceed 200 characters');
  }

  // Validate SKU length
  if (data.sku && data.sku.length > 100) {
    errors.push('SKU must not exceed 100 characters');
  }

  // Validate prices (must be non-negative)
  if (data.price !== undefined && data.price !== null) {
    if (typeof data.price !== 'number' || isNaN(data.price) || data.price < 0) {
      errors.push('Selling price must be a non-negative number');
    }
  }

  if (data.purchasePrice !== undefined && data.purchasePrice !== null) {
    if (typeof data.purchasePrice !== 'number' || isNaN(data.purchasePrice) || data.purchasePrice < 0) {
      errors.push('Purchase price must be a non-negative number');
    }
  }

  // Validate stock quantity (must be non-negative)
  if (data.stockQuantity !== undefined && data.stockQuantity !== null) {
    if (typeof data.stockQuantity !== 'number' || isNaN(data.stockQuantity) || data.stockQuantity < 0) {
      errors.push('Stock quantity must be a non-negative number');
    }
  }

  // Validate minimum stock (must be non-negative)
  if (data.minStock !== undefined && data.minStock !== null) {
    if (typeof data.minStock !== 'number' || isNaN(data.minStock) || data.minStock < 0) {
      errors.push('Minimum stock must be a non-negative number');
    }
  }

  // Validate GST rate (0-28%)
  if (data.taxRate !== undefined && data.taxRate !== null) {
    if (typeof data.taxRate !== 'number' || isNaN(data.taxRate) || data.taxRate < 0 || data.taxRate > 28) {
      errors.push('GST rate must be between 0 and 28');
    }
  }

  // Validate unit
  if (data.unit) {
    const validUnits = ['PCS', 'KG', 'GM', 'LTR', 'ML', 'MTR', 'CM', 'BOX', 'PACK', 'SET', 'DOZEN'];
    if (!validUnits.includes(data.unit.toUpperCase())) {
      // Allow custom units but warn if not in standard list
      // This is a soft validation - we don't add to errors
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates purchase data
 * @param {Object} data - Purchase data to validate
 * @returns {Object} Validation result with isValid and errors array
 */
function validatePurchaseData(data) {
  const errors = [];

  // Required field: supplier
  if (!data.supplierId || data.supplierId.trim().length === 0) {
    errors.push('Supplier is required');
  }

  // Required field: purchase date
  if (!data.purchaseDate) {
    errors.push('Purchase date is required');
  } else {
    // Validate date format
    const date = new Date(data.purchaseDate);
    if (isNaN(date.getTime())) {
      errors.push('Invalid purchase date format');
    }
  }

  // Validate due date if provided
  if (data.dueDate) {
    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) {
      errors.push('Invalid due date format');
    } else if (data.purchaseDate) {
      const purchaseDate = new Date(data.purchaseDate);
      if (dueDate < purchaseDate) {
        errors.push('Due date cannot be before purchase date');
      }
    }
  }

  // Required field: items array
  if (!data.items || !Array.isArray(data.items)) {
    errors.push('Items array is required');
  } else if (data.items.length === 0) {
    errors.push('At least one item is required in the purchase');
  } else {
    // Validate each item
    data.items.forEach((item, index) => {
      // Required fields for each item
      if (!item.productId || item.productId.trim().length === 0) {
        errors.push(`Item ${index + 1}: Product is required`);
      }

      if (item.quantity === undefined || item.quantity === null) {
        errors.push(`Item ${index + 1}: Quantity is required`);
      } else if (typeof item.quantity !== 'number' || isNaN(item.quantity) || item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be a positive number`);
      }

      if (item.rate === undefined || item.rate === null) {
        errors.push(`Item ${index + 1}: Rate is required`);
      } else if (typeof item.rate !== 'number' || isNaN(item.rate) || item.rate < 0) {
        errors.push(`Item ${index + 1}: Rate must be a non-negative number`);
      }

      // Validate discount if provided
      if (item.discount !== undefined && item.discount !== null) {
        if (typeof item.discount !== 'number' || isNaN(item.discount) || item.discount < 0) {
          errors.push(`Item ${index + 1}: Discount must be a non-negative number`);
        }
      }

      // Validate tax rate
      if (item.taxRate === undefined || item.taxRate === null) {
        errors.push(`Item ${index + 1}: Tax rate is required`);
      } else if (typeof item.taxRate !== 'number' || isNaN(item.taxRate) || item.taxRate < 0 || item.taxRate > 28) {
        errors.push(`Item ${index + 1}: Tax rate must be between 0 and 28`);
      }
    });
  }

  // Validate transport charges if provided
  if (data.transportCharges !== undefined && data.transportCharges !== null) {
    if (typeof data.transportCharges !== 'number' || isNaN(data.transportCharges) || data.transportCharges < 0) {
      errors.push('Transport charges must be a non-negative number');
    }
  }

  // Validate payment mode if provided
  if (data.paymentMode) {
    const validPaymentModes = ['CASH', 'CREDIT', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD'];
    if (!validPaymentModes.includes(data.paymentMode)) {
      errors.push('Invalid payment mode. Must be one of: CASH, CREDIT, BANK_TRANSFER, CHEQUE, UPI, CARD');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateGSTIN,
  validateSupplierData,
  validateProductData,
  validatePurchaseData
};
