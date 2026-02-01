# Frontend Integration Guide - Invoice Backend API

## Base URL
```
Development: http://localhost:3000
Production: https://your-app-runner-url.com
```

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

---

## 1. ORGANISATION API

### Create Organisation
```http
POST /api/organisations
```

**Request Body:**
```json
{
  "name": "ABC Industries Pvt Ltd",
  "tradeName": "ABC Industries",
  "gstin": "27AABCU9603R1ZM",
  "pan": "AABCU9603R",
  "address": "123 Industrial Area",
  "city": "Mumbai",
  "state": "Maharashtra",
  "stateCode": "27",
  "pincode": "400001",
  "phone": "9876543210",
  "email": "info@abc.com",
  "logo": "https://example.com/logo.png",
  
  // Bank Details
  "bankName": "HDFC Bank",
  "branch": "Andheri West",
  "accountHolderName": "ABC Industries Pvt Ltd",
  "accountNumber": "50200012345678",
  "ifsc": "HDFC0001234",
  "upi": "abc@hdfcbank",
  
  // Legal
  "authorizedSignatory": "John Doe",
  "signatureUrl": "https://example.com/signature.png",
  "companySealUrl": "https://example.com/seal.png"
}
```

**Required Fields:** name, address, phone, email

---

## 2. INVOICE API

### Create Invoice
```http
POST /api/invoices
```

**Request Body:**
```json
{
  // Basic Info
  "customerId": "697cdd0a348b55d8de670df3",
  "billingAddressId": "697cdd0a348b55d8de670df4",
  "shippingAddressId": "697cead79da801502f4842e9",
  "invoiceDate": "2024-01-31",
  "dueDate": "2024-02-28",
  
  // Invoice Type
  "invoiceType": "TAX_INVOICE",  // TAX_INVOICE | BILL_OF_SUPPLY | PROFORMA
  "invoiceCopyType": "ORIGINAL",  // ORIGINAL | DUPLICATE | TRIPLICATE
  
  // GST Details
  "placeOfSupply": "Maharashtra",
  "reverseCharge": false,
  
  // Line Items
  "items": [
    {
      "productId": "697ce29267d6d8db692a97ee",
      "description": "Product Name",
      "hsnSac": "1234",
      "quantity": 10,
      "unit": "PCS",
      "rate": 100,
      "discount": 0,
      "taxRate": 18
    }
  ],
  
  // Additional Charges
  "deliveryCharges": 100,
  "packingCharges": 50,
  "otherCharges": 0,
  
  // Delivery & Transport
  "modeOfDelivery": "COURIER",  // IN_HAND | COURIER | TRANSPORT | SELF_PICKUP
  "vehicleNumber": "MH01AB1234",
  "transportName": "Blue Dart",
  "lrNumber": "BD123456",
  "ewayBillNumber": "123456789012",
  "placeOfDelivery": "Mumbai",
  "deliveryDate": "2024-02-05",
  "freightTerms": "PAID",  // PAID | TO_PAY
  
  // Payment
  "paymentMethod": "UPI",  // CASH | UPI | NEFT | CHEQUE | CARD
  "paymentTerms": "NET_30",  // NET_15 | NET_30 | NET_45 | NET_60 | IMMEDIATE
  
  // Notes & Instructions
  "notes": "Thank you for your business",
  "termsConditions": "Payment due within 30 days",
  "declaration": "We declare that this invoice shows actual price",
  "paymentInstructions": "Pay via UPI or bank transfer",
  "deliveryInstructions": "Handle with care",
  "returnPolicy": "No returns after 7 days",
  "lateFeePolicy": "2% per month on overdue amount",
  "warrantyInfo": "1 year manufacturer warranty",
  "supportContact": "support@abc.com"
}
```

**Required Fields:** customerId, invoiceDate, dueDate, items

**Auto-Calculated Fields:**
- invoiceNumber (INV-2024-001)
- subtotal
- cgst/sgst (intrastate) OR igst (interstate)
- totalTax
- total
- amountInWords
- balanceAmount

---

## 3. INVOICE RESPONSE

### Get Invoice
```http
GET /api/invoices/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "697cf0e5e0e8e0e8e0e8e0e8",
    "invoiceNumber": "INV-2024-001",
    "invoiceType": "TAX_INVOICE",
    "invoiceCopyType": "ORIGINAL",
    "invoiceDate": "2024-01-31T00:00:00.000Z",
    "dueDate": "2024-02-28T00:00:00.000Z",
    
    // Amounts
    "subtotal": 1000,
    "cgst": 90,
    "sgst": 90,
    "igst": 0,
    "deliveryCharges": 100,
    "packingCharges": 50,
    "totalTax": 180,
    "total": 1330,
    "amountInWords": "One Thousand Three Hundred Thirty Rupees Only",
    
    // Payment
    "paymentStatus": "UNPAID",
    "paidAmount": 0,
    "balanceAmount": 1330,
    
    // Customer
    "customer": {
      "id": "697cdd0a348b55d8de670df3",
      "name": "Customer Name",
      "gstin": "27AABCU9603R1ZM",
      "phone": "9876543210"
    },
    
    // Items
    "items": [
      {
        "id": "item_id",
        "description": "Product Name",
        "hsnSac": "1234",
        "quantity": 10,
        "unit": "PCS",
        "rate": 100,
        "discount": 0,
        "taxRate": 18,
        "cgst": 90,
        "sgst": 90,
        "igst": 0,
        "amount": 1000,
        "taxAmount": 180
      }
    ],
    
    "status": "DRAFT",
    "createdAt": "2024-01-31T14:47:56.099Z"
  }
}
```

---

## 4. GENERATE PDF

### Get Invoice PDF
```http
GET /api/invoices/:id/pdf
```

**Response:** PDF file (application/pdf)

**Usage in Frontend:**
```javascript
// Download PDF
const response = await fetch(`${API_URL}/api/invoices/${invoiceId}/pdf`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `Invoice-${invoiceNumber}.pdf`;
a.click();

// Or open in new tab
window.open(`${API_URL}/api/invoices/${invoiceId}/pdf`, '_blank');
```

---

## 5. KEY FEATURES

### Automatic Tax Calculation
- **Intrastate (same state)**: CGST + SGST (50% each)
- **Interstate (different states)**: IGST (100%)
- Backend automatically detects based on organisation state vs billing address state

### Invoice Numbering
- Auto-generated: `INV-YYYY-###`
- Sequential per year
- Example: INV-2024-001, INV-2024-002

### Amount in Words
- Auto-converted to Indian format
- Example: "One Thousand Two Hundred Thirty Rupees Only"

### PDF Features
- Professional GST-compliant layout
- A4 print-optimized
- Black & white safe
- Includes all sections: header, items, tax summary, bank details, terms

---

## 6. ENUMS & CONSTANTS

### Invoice Type
- `TAX_INVOICE` (default)
- `BILL_OF_SUPPLY`
- `PROFORMA`

### Invoice Copy Type
- `ORIGINAL` (default)
- `DUPLICATE`
- `TRIPLICATE`

### Mode of Delivery
- `IN_HAND` (default)
- `COURIER`
- `TRANSPORT`
- `SELF_PICKUP`

### Freight Terms
- `PAID` (default)
- `TO_PAY`

### Payment Terms
- `NET_15`
- `NET_30` (default)
- `NET_45`
- `NET_60`
- `IMMEDIATE`

### Payment Method
- `CASH`
- `UPI`
- `NEFT`
- `CHEQUE`
- `CARD`

### Payment Status
- `UNPAID` (default)
- `PARTIALLY_PAID`
- `PAID`
- `OVERDUE`

### Invoice Status
- `DRAFT` (default)
- `ISSUED`
- `PAID`
- `CANCELLED`

---

## 7. STATE CODES (for GST)

```javascript
const STATE_CODES = {
  'Andhra Pradesh': '37',
  'Karnataka': '29',
  'Kerala': '32',
  'Tamil Nadu': '33',
  'Telangana': '36',
  'Goa': '30',
  'Gujarat': '24',
  'Maharashtra': '27',
  'Rajasthan': '08',
  'Delhi': '07',
  'Haryana': '06',
  'Punjab': '03',
  'Uttar Pradesh': '09',
  'West Bengal': '19',
  // ... see full list in backend
};
```

---

## 8. ERROR HANDLING

### Common Errors
```json
// 400 - Validation Error
{
  "error": "Customer not found"
}

// 401 - Unauthorized
{
  "error": "Invalid token"
}

// 404 - Not Found
{
  "error": "Invoice not found"
}

// 500 - Server Error
{
  "success": false,
  "error": "Failed to create invoice",
  "details": "Error message"
}
```

---

## 9. SAMPLE WORKFLOW

### Complete Invoice Creation Flow
```javascript
// 1. Create Organisation (one-time)
const org = await createOrganisation({
  name: "ABC Industries",
  gstin: "27AABCU9603R1ZM",
  // ... other fields
});

// 2. Create Customer
const customer = await createCustomer({
  name: "XYZ Corp",
  gstin: "29AABCU9603R1ZM"
});

// 3. Add Customer Address
const address = await createAddress({
  customerId: customer.id,
  type: "BILLING",
  line1: "123 Street",
  city: "Bangalore",
  state: "Karnataka",
  pincode: "560001"
});

// 4. Create Products
const product = await createProduct({
  name: "Product A",
  hsnCode: "1234",
  unit: "PCS",
  price: 100,
  taxRate: 18
});

// 5. Create Invoice
const invoice = await createInvoice({
  customerId: customer.id,
  billingAddressId: address.id,
  invoiceDate: "2024-01-31",
  dueDate: "2024-02-28",
  items: [{
    productId: product.id,
    description: product.name,
    quantity: 10,
    rate: product.price,
    taxRate: product.taxRate
  }]
});

// 6. Download PDF
downloadPDF(invoice.id);
```

---

## 10. TIPS FOR FRONTEND

1. **Store JWT token** securely (localStorage/sessionStorage)
2. **Validate required fields** before API call
3. **Handle loading states** during PDF generation (can take 2-3 seconds)
4. **Show tax breakup** clearly (CGST/SGST vs IGST)
5. **Auto-fill** product details when selected
6. **Calculate totals** on frontend for preview (backend will recalculate)
7. **Use date pickers** for invoiceDate, dueDate, deliveryDate
8. **Provide dropdowns** for enums (invoiceType, modeOfDelivery, etc.)
9. **Show state codes** next to state selection
10. **Preview invoice** before generating PDF

---

## Support
For issues or questions, check Swagger docs at: `http://localhost:3000/api-docs`
