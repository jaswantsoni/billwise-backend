# GST on Delivery, Freight & Other Charges

## Overview
Added separate GST calculation for delivery charges, freight charges (renamed from packing), and other charges in invoices.

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)
- Renamed `packingCharges` → `freightCharges`
- Removed `chargesTaxRate`
- Added separate tax fields:
  - `deliveryChargesTax` (Float, default: 0)
  - `freightChargesTax` (Float, default: 0)
  - `otherChargesTax` (Float, default: 0)

### 2. Invoice Creation (`controllers/invoiceController.js`)
- Accept separate tax rates for each charge type:
  - `deliveryChargesTaxRate`
  - `freightChargesTaxRate`
  - `otherChargesTaxRate`
- Calculate GST separately for each charge
- Apply CGST/SGST (intrastate) or IGST (interstate)
- Include all charges tax in total CGST/SGST/IGST
- Save calculated tax amounts in invoice

### 3. PDF Template (`controllers/pdfController.js`)
- Show each charge with its GST on separate lines
- Display format:
  ```
  Delivery Charges:     ₹500.00
  GST on Delivery:      ₹90.00
  Freight Charges:      ₹200.00
  GST on Freight:       ₹36.00
  Other Charges:        ₹100.00
  GST on Other Charges: ₹18.00
  ```

## API Usage

### Create Invoice with GST on Charges

```json
POST /api/invoices

{
  "customerId": "...",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "items": [...],
  "deliveryCharges": 500,
  "deliveryChargesTaxRate": 18,
  "freightCharges": 200,
  "freightChargesTaxRate": 18,
  "otherCharges": 100,
  "otherChargesTaxRate": 18
}
```

## Tax Calculation Example

**Scenario**: Interstate Invoice
- Delivery Charges: ₹500 @ 18% = ₹90 IGST
- Freight Charges: ₹200 @ 18% = ₹36 IGST
- Other Charges: ₹100 @ 18% = ₹18 IGST
- **Total Charges**: ₹800
- **Total GST**: ₹144 (IGST)
- **Grand Total**: ₹944

**Scenario**: Intrastate Invoice
- Same charges split into:
  - Delivery: ₹45 CGST + ₹45 SGST
  - Freight: ₹18 CGST + ₹18 SGST
  - Other: ₹9 CGST + ₹9 SGST
  - **Total**: ₹72 CGST + ₹72 SGST

## PDF Display

```
Subtotal:                ₹10,000.00
CGST:                    ₹972.00
SGST:                    ₹972.00
Delivery Charges:        ₹500.00
GST on Delivery:         ₹90.00
Freight Charges:         ₹200.00
GST on Freight:          ₹36.00
Other Charges:           ₹100.00
GST on Other Charges:    ₹18.00
Grand Total:             ₹12,888.00
```

## Migration Notes
- **Breaking Change**: `packingCharges` renamed to `freightCharges`
- Existing invoices with `packingCharges` need data migration
- Tax rates are optional - if not provided, charges are added without GST
- Each charge can have different tax rates (e.g., 5%, 12%, 18%, 28%)

## Run Migration
```bash
npx prisma generate
```
