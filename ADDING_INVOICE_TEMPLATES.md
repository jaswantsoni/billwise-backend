# Adding Invoice Templates to Kampony

This guide explains how to add a new built-in invoice template. You touch **2 files** and follow a simple pattern.

---

## Files to Edit

| File | What you do |
|------|-------------|
| `invoice-backend/services/invoiceTemplates.js` | Write the render function + register it |
| `bizbill-pro/src/pages/InvoiceTemplates.tsx` | Add name/description + thumbnail preview |

---

## Step 1 — Write the render function (`invoiceTemplates.js`)

Add your function **before** the `// Template Registry` comment at the bottom of the file.

```js
const myTemplate = (invoice, organisation, billingAddress, shippingAddress, h) => {
  const hasDiscount = invoice.items.some(i => i.discount > 0);
  const total = invoice.total || invoice.totalAmount || 0;

  return `<!DOCTYPE html><html><head><style>
    ${baseCSS}
    /* Your custom CSS here */
    body { font-family: Arial, sans-serif; }
    .header { background: #your-color; color: #fff; padding: 20px; }
    /* ... */
  </style></head><body>
    <div class="invoice">
      <!-- Use the helper functions below -->
    </div>
  </body></html>`;
};
```

### Available helper functions

These are pre-built — just call them inside your template string:

#### `orgHeader(organisation, style?)`
Renders company name, address, GSTIN, PAN, phone, email, logo.
```js
${orgHeader(organisation, 'text-align:center;')}
```

#### `addressBlock(label, customer, address, h)`
Renders a Bill To / Ship To block with GSTIN, state code, phone.
```js
${addressBlock('Bill To', invoice.customer, billingAddress, h)}
${addressBlock('Ship To', invoice.customer, shippingAddress || billingAddress, h)}
```

#### `invoiceMeta(invoice, billingAddress, h)`
Renders invoice number, date, due date, place of supply, reverse charge, vehicle/transport fields as `<tr>` rows (wrap in a `<table>`).
```js
<table><tbody>${invoiceMeta(invoice, billingAddress, h)}</tbody></table>
```

#### `buildItemRows(items, isInterstate, hasDiscount)`
Returns an array of row objects. Each object has:
- `row.productName` — product name
- `row.subDesc` — description (if different from product name)
- `row.hsnSac` — HSN/SAC code
- `row.item` — the full item object (quantity, rate, cgst, sgst, igst, amount, etc.)

```js
${invoice.items.map((item, idx) => {
  const row = buildItemRows([item], h.isInterstate, hasDiscount)[0];
  return `<tr>
    <td>${idx + 1}</td>
    <td>${row.productName}${row.subDesc ? `<br><small>${row.subDesc}</small>` : ''}</td>
    <td>${row.hsnSac}</td>
    <td>${item.quantity}</td>
    <td>${item.unit}</td>
    <td>${formatCurrency(item.rate)}</td>
    ${hasDiscount ? `<td>${formatCurrency(item.discount || 0)}</td>` : ''}
    <td>${item.taxRate}%</td>
    ${!h.isInterstate
      ? `<td>${formatCurrency(item.cgst || 0)}</td><td>${formatCurrency(item.sgst || 0)}</td>`
      : `<td>${formatCurrency(item.igst || 0)}</td>`}
    <td>${formatCurrency(item.amount)}</td>
  </tr>`;
}).join('')}
```

#### `totalsBlock(invoice, isInterstate)`
Returns `<tr>` rows for subtotal, CGST/SGST or IGST, charges, round-off, grand total. Wrap in a `<table>`.
```js
<table>${totalsBlock(invoice, h.isInterstate)}</table>
```

#### `bankDetailsSection(organisation, qrCodeDataUrl)`
Renders bank name, account number, IFSC, UPI + QR code image. Returns empty string if no bank details.
```js
${bankDetailsSection(organisation, h.qrCodeDataUrl)}
```

#### `notesSection(invoice)`
Renders notes, terms, payment instructions, delivery instructions, return policy, warranty, declaration — only fields that have values.
```js
${notesSection(invoice)}
```

#### `formatCurrency(amount)`
Formats a number as `₹1,234.56`.
```js
${formatCurrency(item.amount)}
```

---

### The `h` (helpers) object

Your function receives `h` as the 5th argument. It contains:

| Property | Type | Description |
|----------|------|-------------|
| `h.isInterstate` | `boolean` | `true` if org state ≠ customer state → use IGST |
| `h.qrCodeDataUrl` | `string` | Base64 UPI QR code image (empty if no UPI set) |
| `h.amountToWords(n)` | `function` | Converts number to Indian words e.g. `"One Thousand Five Hundred Rupees Only"` |
| `h.STATE_CODES` | `object` | Map of state name → GST state code e.g. `{ 'Maharashtra': '27' }` |

---

### Invoice object fields

Key fields available on `invoice`:

```
invoice.invoiceNumber       "INV/24-25/001"
invoice.invoiceDate         Date string
invoice.dueDate             Date string
invoice.invoiceType         "TAX_INVOICE" | "BILL_OF_SUPPLY" | "PROFORMA" | "DELIVERY_CHALLAN"
invoice.invoiceCopyType     "ORIGINAL FOR BUYER" | "DUPLICATE FOR TRANSPORTER" | ...
invoice.placeOfSupply       State name
invoice.reverseCharge       boolean
invoice.paymentTerms        "NET_30" etc.

invoice.subtotal            number
invoice.cgst                number
invoice.sgst                number
invoice.igst                number
invoice.cess                number
invoice.deliveryCharges     number
invoice.otherCharges        number
invoice.roundOff            number
invoice.total / invoice.totalAmount   number (use: invoice.total || invoice.totalAmount || 0)

invoice.items[]             array of InvoiceItem
  .product.name             string
  .description              string
  .hsnSac                   string
  .quantity                 number
  .unit                     string
  .rate                     number
  .discount                 number
  .taxRate                  number
  .cgst / .sgst / .igst     number
  .amount                   number

invoice.customer.name       string
invoice.customer.gstin      string
invoice.customer.phone      string

invoice.notes               string
invoice.termsConditions     string
invoice.declaration         string
invoice.vehicleNumber       string
invoice.transportName       string
invoice.ewayBillNumber      string
invoice.lrNumber            string
```

---

## Step 2 — Register the template

At the bottom of `invoiceTemplates.js`, add your template to the `TEMPLATES` object:

```js
const TEMPLATES = {
  classic:      { name: 'Classic',      description: '...', render: classicTemplate },
  modern:       { name: 'Modern',       description: '...', render: modernTemplate },
  // ... existing templates ...
  mytemplate:   { name: 'My Template',  description: 'Short description', render: myTemplate }, // ← add here
};
```

The `id` (key) must be lowercase, no spaces. This is what gets passed as `?template=mytemplate` in the URL.

---

## Step 3 — Add to frontend (`InvoiceTemplates.tsx`)

### 3a. Add to `BUILTIN_TEMPLATES` array:

```tsx
const BUILTIN_TEMPLATES = [
  // ... existing ...
  { id: 'mytemplate', name: 'My Template', description: 'Short description', color: '#hexcolor' },
];
```

`color` is used as the accent color in the template card UI.

### 3b. Add thumbnail HTML to `THUMBNAILS`:

This is a tiny inline HTML preview (~140px tall). Keep it simple — just show the header style and a fake table row.

```tsx
const THUMBNAILS: Record<string, string> = {
  // ... existing ...
  mytemplate: `<div style="font-family:Arial;font-size:7px;height:100%;overflow:hidden;">
    <div style="background:#yourcolor;color:#fff;padding:8px;">
      <div style="font-weight:bold;font-size:9px;">ACME Corp</div>
      <div style="font-size:6px;opacity:0.8;">GSTIN: 27XXXXX</div>
    </div>
    <div style="padding:5px;">
      <table style="width:100%;border-collapse:collapse;font-size:5.5px;">
        <tr style="background:#yourcolor;color:#fff;">
          <td style="padding:2px;">Item</td>
          <td style="padding:2px;">Qty</td>
          <td style="padding:2px;">Amt</td>
        </tr>
        <tr>
          <td style="padding:2px;border-bottom:1px solid #eee;">Product A</td>
          <td style="padding:2px;border-bottom:1px solid #eee;">2</td>
          <td style="padding:2px;border-bottom:1px solid #eee;">₹1000</td>
        </tr>
      </table>
      <div style="text-align:right;font-weight:bold;font-size:6px;margin-top:4px;">Total: ₹1500</div>
    </div>
  </div>`,
};
```

---

## Testing your template

After adding, restart the backend and test via:

```
GET /api/invoices/:id/pdf?template=mytemplate
```

Or select it in the app under **Invoice Templates** page.

---

## Quick checklist

- [ ] Render function written in `invoiceTemplates.js`
- [ ] Uses `${baseCSS}` in the `<style>` block
- [ ] Handles `h.isInterstate` for CGST/SGST vs IGST columns
- [ ] Uses `invoice.total || invoice.totalAmount || 0` for the total
- [ ] Registered in `TEMPLATES` object with unique lowercase id
- [ ] Added to `BUILTIN_TEMPLATES` in `InvoiceTemplates.tsx`
- [ ] Thumbnail HTML added to `THUMBNAILS`
