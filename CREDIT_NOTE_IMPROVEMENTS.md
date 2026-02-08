# Credit Note Integration Improvements

## Changes Made

### 1. Schema Updates (prisma/schema.prisma)
- Added `creditedQty` and `debitedQty` fields to `InvoiceItem` model to track returned/adjusted quantities
- Added `invoiceItemId` field to `CreditNoteItem` and `DebitNoteItem` models to link back to original invoice items

### 2. Invoice API Updates (controllers/invoiceController.js)
- **GET /api/invoices** - Now includes `creditNotes` and `debitNotes` in response
- **GET /api/invoices/:id** - Now includes full credit/debit note details with items

### 3. Credit Note Controller Updates (controllers/creditNoteController.js)
- Credit note creation now accepts `invoiceItemId` in items array
- Automatically updates `creditedQty` on invoice items when credit note is issued
- Links credit note items back to original invoice items for tracking

## How It Works

### Creating a Credit Note with Item Tracking

**Request:**
```json
POST /api/credit-notes
{
  "invoiceId": "invoice_id_here",
  "issueDate": "2024-01-15",
  "reason": "Damaged goods returned",
  "items": [
    {
      "productId": "product_id",
      "invoiceItemId": "invoice_item_id",  // NEW: Links to original invoice item
      "description": "Product Name",
      "hsnSac": "1234",
      "quantity": 2,
      "unit": "PCS",
      "rate": 100,
      "taxRate": 18
    }
  ]
}
```

### Invoice Response Now Includes Credit Notes

**Response:**
```json
GET /api/invoices/:id
{
  "success": true,
  "data": {
    "id": "invoice_id",
    "invoiceNumber": "INV-2024-001",
    "total": 5000,
    "balanceAmount": 4500,
    "items": [
      {
        "id": "item_id",
        "quantity": 10,
        "creditedQty": 2,  // NEW: Shows how many were credited
        "rate": 100
      }
    ],
    "creditNotes": [  // NEW: All credit notes for this invoice
      {
        "id": "cn_id",
        "noteNumber": "CN-2024-0001",
        "totalAmount": 500,
        "status": "ISSUED",
        "items": [...]
      }
    ]
  }
}
```

## Migration Steps

1. **Update Schema:**
```bash
npx prisma db push
```

2. **Restart Server:**
```bash
npm start
```

## Benefits

1. **Full Traceability** - Each credit note item links back to the original invoice item
2. **Quantity Tracking** - Invoice items show how much has been credited/returned
3. **API Integration** - Frontend can display credit notes alongside invoices
4. **Balance Management** - Invoice balance automatically adjusts with credit notes
5. **Audit Trail** - Complete history of adjustments visible in invoice response

## Frontend Integration

### Display Credit Notes on Invoice
```javascript
// Fetch invoice with credit notes
const invoice = await fetch('/api/invoices/' + invoiceId);

// Show credit notes section
invoice.creditNotes.forEach(cn => {
  console.log(`Credit Note: ${cn.noteNumber} - ₹${cn.totalAmount}`);
});

// Show credited quantities on items
invoice.items.forEach(item => {
  const remaining = item.quantity - item.creditedQty;
  console.log(`${item.description}: ${remaining}/${item.quantity} remaining`);
});
```

### Create Credit Note from Invoice Items
```javascript
// User selects items to credit from invoice
const creditNoteData = {
  invoiceId: invoice.id,
  issueDate: new Date(),
  reason: "Customer return",
  items: selectedItems.map(item => ({
    productId: item.productId,
    invoiceItemId: item.id,  // Link back to invoice item
    description: item.description,
    hsnSac: item.hsnSac,
    quantity: returnQuantity,
    unit: item.unit,
    rate: item.rate,
    taxRate: item.taxRate
  }))
};

await fetch('/api/credit-notes', {
  method: 'POST',
  body: JSON.stringify(creditNoteData)
});
```

## Notes

- Credit notes automatically reduce invoice `balanceAmount`
- Credited quantities are tracked but original invoice items remain unchanged
- Credit notes with status 'CANCELLED' are excluded from invoice response
- System validates that total credit amount doesn't exceed invoice total
