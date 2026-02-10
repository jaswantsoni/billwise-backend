# Tax on Extra Charges Feature

## Overview
Added support for applying GST/tax on delivery charges, packing charges, and other charges in invoices.

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
- Added `chargesTaxRate` field to Invoice model (Float, default: 0)

### 2. Invoice Creation (`controllers/invoiceController.js`)
- Added `chargesTaxRate` parameter to request body
- Calculate tax on extra charges (delivery + packing + other)
- Apply CGST/SGST for intrastate or IGST for interstate
- Include charges tax in total CGST/SGST/IGST amounts
- Save `chargesTaxRate` in invoice

### 3. PDF Template (`controllers/pdfController.js`)
- Show "(Taxable)" label on charges when tax rate > 0
- Display separate line for "Tax on Charges" with rate and amount
- Properly calculate and display in invoice summary

## API Usage

### Create Invoice with Taxable Charges

```json
POST /api/invoices

{
  "customerId": "...",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "items": [...],
  "deliveryCharges": 500,
  "packingCharges": 200,
  "otherCharges": 100,
  "chargesTaxRate": 18
}
```

## Tax Calculation Example

**Scenario**: Interstate Invoice
- Delivery Charges: ₹500
- Packing Charges: ₹200  
- Other Charges: ₹100
- Charges Tax Rate: 18%

**Calculation**:
- Total Extra Charges: ₹800
- Tax on Charges (18%): ₹144 (IGST)
- Total with Tax: ₹944

**Scenario**: Intrastate Invoice
- Same charges as above
- Tax splits into:
  - CGST (9%): ₹72
  - SGST (9%): ₹72

## PDF Display

The invoice PDF will show:
```
Subtotal:                    ₹10,000.00
CGST:                        ₹900.00
SGST:                        ₹900.00
Delivery Charges (Taxable):  ₹500.00
Packing Charges (Taxable):   ₹200.00
Other Charges (Taxable):     ₹100.00
Tax on Charges (18%):        ₹144.00
Grand Total:                 ₹12,744.00
```

## Notes
- If `chargesTaxRate` is 0 or not provided, charges are added without tax (backward compatible)
- Tax on charges is included in the invoice's total CGST/SGST/IGST amounts
- Interstate vs intrastate detection works the same way as for items
