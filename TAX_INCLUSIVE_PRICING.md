# Tax-Inclusive Pricing & Flexible Pricing

## Overview
Added support for:
1. **Tax-Inclusive Pricing** - Products where price includes GST
2. **Flexible Pricing** - Same product can be sold at different prices to different customers

## Changes Made

### 1. Database Schema (`prisma/schema.prisma`)

**Product Model:**
- Added `taxInclusive` (Boolean, default: false)
- Product price is just a reference - actual price set per invoice item

**InvoiceItem Model:**
- Added `taxInclusive` (Boolean, default: false)
- Each invoice item can have custom rate and tax settings

### 2. Invoice Creation (`controllers/invoiceController.js`)
- Accept `taxInclusive` flag per item
- Calculate tax differently based on flag:
  - **Tax Exclusive**: Tax added on top of price
  - **Tax Inclusive**: Tax extracted from price
- Allow custom `rate` per item (flexible pricing)

## Tax Calculation Logic

### Tax Exclusive (Default)
```
Item Rate: ₹1,000
Tax Rate: 18%
---
Subtotal: ₹1,000
Tax: ₹180
Total: ₹1,180
```

### Tax Inclusive
```
Item Rate: ₹1,180 (includes tax)
Tax Rate: 18%
---
Subtotal: ₹1,000 (extracted)
Tax: ₹180 (extracted)
Total: ₹1,180
```

**Formula for Tax Inclusive:**
```javascript
subtotal = totalWithTax / (1 + taxRate/100)
tax = totalWithTax - subtotal
```

## API Usage

### Example 1: Tax Exclusive (Traditional)
```json
POST /api/invoices

{
  "items": [
    {
      "productId": "...",
      "description": "Product A",
      "quantity": 10,
      "rate": 1000,
      "taxRate": 18,
      "taxInclusive": false
    }
  ]
}
```
**Result**: Subtotal ₹10,000 + Tax ₹1,800 = Total ₹11,800

### Example 2: Tax Inclusive
```json
{
  "items": [
    {
      "productId": "...",
      "description": "Product B",
      "quantity": 10,
      "rate": 1180,
      "taxRate": 18,
      "taxInclusive": true
    }
  ]
}
```
**Result**: Subtotal ₹10,000 + Tax ₹1,800 = Total ₹11,800

### Example 3: Flexible Pricing (Same Product, Different Prices)
```json
{
  "items": [
    {
      "productId": "PROD123",
      "description": "Widget",
      "quantity": 100,
      "rate": 50,
      "taxRate": 18,
      "taxInclusive": false
    }
  ]
}
```

**Different Invoice:**
```json
{
  "items": [
    {
      "productId": "PROD123",
      "description": "Widget - Bulk Discount",
      "quantity": 1000,
      "rate": 45,
      "taxRate": 18,
      "taxInclusive": false
    }
  ]
}
```

## Use Cases

### 1. Retail (Tax Inclusive)
- MRP: ₹118 (includes 18% GST)
- Customer sees: ₹118
- Invoice shows: Base ₹100 + GST ₹18 = ₹118

### 2. B2B (Tax Exclusive)
- Base Price: ₹1,000
- Customer sees: ₹1,000 + GST
- Invoice shows: Base ₹1,000 + GST ₹180 = ₹1,180

### 3. Volume Discounts
- Product Master: ₹100
- Customer A (10 units): ₹100/unit
- Customer B (1000 units): ₹85/unit
- Customer C (VIP): ₹75/unit

### 4. Negotiated Pricing
- Same product, different customers, different prices
- Price set at invoice creation time
- Product master price is just a reference

## PDF Display

Both tax-inclusive and tax-exclusive items show the same on invoice:
```
Item          Qty  Rate      Tax%   Amount
Widget        10   ₹1,000    18%    ₹10,000
GST (18%)                           ₹1,800
Total                               ₹11,800
```

The `taxInclusive` flag only affects calculation, not display.

## Notes
- Product `price` field is now a reference/default value
- Actual selling price is set per invoice item
- Tax calculation happens at invoice creation
- Both methods result in correct GST reporting
- Backward compatible - defaults to tax-exclusive

## Run Migration
```bash
npx prisma generate
```
