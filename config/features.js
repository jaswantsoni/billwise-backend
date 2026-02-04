// Feature access control by plan tier
const FEATURES = {
  // Basic Plan Features
  BASIC: [
    'invoice_create',
    'invoice_view',
    'invoice_pdf',
    'invoice_print',
    'customer_management',
    'product_management',
    'hsn_sac_support',
    'gst_calculation',
    'discount_roundoff',
    'basic_reports',
    'business_profile',
    'auto_invoice_number'
  ],
  
  // Premium Plan Features (includes all Basic)
  PREMIUM: [
    'credit_note',
    'debit_note',
    'estimates',
    'proforma_invoice',
    'inventory_management',
    'low_stock_alerts',
    'purchase_management',
    'supplier_management',
    'customer_ledger',
    'outstanding_tracking',
    'advanced_reports',
    'whatsapp_sharing',
    'payment_reminders',
    'upi_qr_code',
    'multiple_payment_modes',
    'recurring_invoices',
    'multi_user_access',
    'multiple_businesses',
    'cloud_backup',
    'offline_billing',
    'custom_branding',
    'eway_bill',
    'gst_search',
    'hsn_search',
    'multiple_organisations'
  ]
};

// Route to feature mapping
const ROUTE_FEATURES = {
  // Premium only routes
  'POST /api/eway/generate': 'eway_bill',
  'GET /api/eway/:ewbNo': 'eway_bill',
  'POST /api/eway/cancel/:ewbNo': 'eway_bill',
  'POST /api/invoices/whatsapp': 'whatsapp_sharing',
  'POST /api/invoices/recurring': 'recurring_invoices',
  'GET /api/reports/advanced': 'advanced_reports',
  'GET /api/inventory': 'inventory_management',
  'POST /api/purchase': 'purchase_management',
  'GET /api/ledger': 'customer_ledger',
  'GET /api/gst/:gstin': 'gst_search',
  'GET /api/hsn/search': 'hsn_search',
  'POST /api/organisations': 'multiple_organisations',
  
  // Basic plan routes (all users with paid plan)
  'POST /api/invoices': 'invoice_create',
  'GET /api/invoices': 'invoice_view',
  'GET /api/invoices/:id/pdf': 'invoice_pdf',
  'POST /api/customers': 'customer_management',
  'POST /api/products': 'product_management'
};

// Check if user can access feature
const canAccessFeature = (userTier, feature) => {
  if (userTier === 'premium') {
    return FEATURES.BASIC.includes(feature) || FEATURES.PREMIUM.includes(feature);
  }
  if (userTier === 'basic') {
    return FEATURES.BASIC.includes(feature);
  }
  return false; // free tier
};

// Get all features for a plan
const getPlanFeatures = (tier) => {
  if (tier === 'premium') {
    return [...FEATURES.BASIC, ...FEATURES.PREMIUM];
  }
  if (tier === 'basic') {
    return FEATURES.BASIC;
  }
  return [];
};

module.exports = {
  FEATURES,
  ROUTE_FEATURES,
  canAccessFeature,
  getPlanFeatures
};
