# Feature Access Control

## Plan Features

### Free Plan
- View only (read-only access)
- Limited to 5 invoices
- No PDF download
- Basic dashboard
- **1 business/organisation** (first one free)

### Basic Plan (₹149/month or ₹1,499/year)
✅ GST invoice
✅ Non-GST invoice
✅ Auto invoice number
✅ Customer management
✅ Product / service management
✅ HSN / SAC support
✅ CGST / SGST / IGST calculation
✅ Discount & round-off
✅ PDF invoice download
✅ Print invoice
✅ Basic sales report
✅ Business profile setup
✅ Single user access

### Premium Plan (₹399/month or ₹3,999/year)
✅ All Basic plan features
✅ Credit note
✅ Debit note
✅ Estimates / quotations
✅ Proforma invoices
✅ Inventory management
✅ Low stock alerts
✅ Purchase & supplier management
✅ Customer ledger
✅ Outstanding balance tracking
✅ Advanced sales & GST reports
✅ WhatsApp invoice sharing
✅ Payment reminders
✅ UPI QR code on invoice
✅ Multiple payment modes
✅ Recurring invoices
✅ Multi-user access
✅ Multiple businesses
✅ Cloud backup & sync
✅ Offline billing
✅ Custom invoice branding
✅ E-Way Bill generation

## Frontend Implementation

### 1. Feature Constants
```javascript
// constants/features.js
export const FEATURES = {
  BASIC: [
    'invoice_create',
    'invoice_pdf',
    'customer_management',
    'product_management',
    'basic_reports'
  ],
  PREMIUM: [
    'eway_bill',
    'whatsapp_sharing',
    'recurring_invoices',
    'advanced_reports',
    'inventory_management',
    'custom_branding'
  ]
};
```

### 2. Feature Check Hook
```javascript
// hooks/useFeature.js
import { usePlan } from './usePlan';
import { FEATURES } from '../constants/features';

export function useFeature(feature) {
  const { tier, isActive } = usePlan();

  if (!isActive) return false;

  if (tier === 'premium') {
    return FEATURES.BASIC.includes(feature) || FEATURES.PREMIUM.includes(feature);
  }

  if (tier === 'basic') {
    return FEATURES.BASIC.includes(feature);
  }

  return false;
}
```

### 3. Usage Examples
```javascript
// Hide premium features
function InvoiceActions() {
  const hasEwayBill = useFeature('eway_bill');
  const hasWhatsApp = useFeature('whatsapp_sharing');

  return (
    <div>
      <button>Download PDF</button>
      
      {hasEwayBill && (
        <button onClick={generateEwayBill}>Generate E-Way Bill</button>
      )}
      
      {hasWhatsApp && (
        <button onClick={shareWhatsApp}>Share via WhatsApp</button>
      )}
    </div>
  );
}

// With FeatureGate
<FeatureGate feature="eway_bill">
  <button>Generate E-Way Bill</button>
</FeatureGate>

// Conditional navigation
function Sidebar() {
  const hasInventory = useFeature('inventory_management');
  const hasAdvancedReports = useFeature('advanced_reports');

  return (
    <nav>
      <Link to="/invoices">Invoices</Link>
      <Link to="/customers">Customers</Link>
      
      {hasInventory && <Link to="/inventory">Inventory</Link>}
      {hasAdvancedReports && <Link to="/reports/advanced">Advanced Reports</Link>}
    </nav>
  );
}
```

### 4. Feature Gate Component
```javascript
// components/FeatureGate.jsx
import { useFeature } from '../hooks/useFeature';
import { Link } from 'react-router-dom';

export default function FeatureGate({ feature, children, showUpgrade = true }) {
  const hasAccess = useFeature(feature);

  if (!hasAccess) {
    if (!showUpgrade) return null;
    
    return (
      <div className="upgrade-prompt">
        <p>🔒 This is a premium feature</p>
        <Link to="/pricing">Upgrade to Premium</Link>
      </div>
    );
  }

  return children;
}
```

### 5. API Error Handling
```javascript
// When backend returns 403
{
  "error": "Premium plan required",
  "requiresUpgrade": true,
  "currentPlan": "basic",
  "requiredPlan": "premium",
  "feature": "eway_bill"
}

// Handle in interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.requiresUpgrade) {
      showUpgradeModal({
        feature: error.response.data.feature,
        requiredPlan: error.response.data.requiredPlan
      });
    }
    return Promise.reject(error);
  }
);
```

## Backend Routes Protection

### Premium Routes
```javascript
// E-Way Bill
POST /api/eway/generate - requirePremium
GET /api/eway/:ewbNo - requirePremium
POST /api/eway/cancel/:ewbNo - requirePremium

// WhatsApp
POST /api/invoices/whatsapp - requirePremium

// Recurring
POST /api/invoices/recurring - requirePremium

// Advanced Reports
GET /api/reports/advanced - requirePremium

// Inventory
GET /api/inventory - requirePremium
POST /api/inventory - requirePremium

// Purchase
POST /api/purchase - requirePremium
```

### Basic Routes (Paid Plans)
```javascript
// Invoices
POST /api/invoices - requireBasic
GET /api/invoices - requireBasic
GET /api/invoices/:id/pdf - requireBasic

// Customers
POST /api/customers - requireBasic
GET /api/customers - requireBasic

// Products
POST /api/products - requireBasic
GET /api/products - requireBasic
```

## Testing
```javascript
// Test with different plans
localStorage.setItem('token', 'basic_user_token');
// Should see basic features only

localStorage.setItem('token', 'premium_user_token');
// Should see all features
```
