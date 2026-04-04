/**
 * Invoice HTML Templates
 * 
 * Each template exports a function: (invoice, organisation, billingAddress, shippingAddress, helpers) => HTML string
 * 
 * helpers = { isInterstate, qrCodeDataUrl, amountToWords, STATE_CODES, formatCurrency }
 */

const formatCurrency = (amount) => `₹${Number(amount || 0).toFixed(2)}`;

// ─── Shared CSS Reset ─────────────────────────────────────────────
const baseCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; }
  @media print {
    body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .invoice { margin: 0; padding: 10mm; }
  }
  table { width: 100%; border-collapse: collapse; }
`;

// ─── Helper: Item Rows Generator ──────────────────────────────────
const buildItemRows = (items, isInterstate, hasDiscount) => {
  return items.map((item, idx) => {
    const productName = (item.product && item.product.name) || item.description || '';
    const subDesc = (item.product && item.product.name && item.description && item.description !== item.product.name) ? item.description : '';
    const hsnSac = item.hsnSac || (item.product && (item.product.hsnCode || item.product.sacCode)) || '-';
    return { idx: idx + 1, productName, subDesc, hsnSac, item };
  });
};

// ─── Helper: Common sections ──────────────────────────────────────
const orgHeader = (organisation, style = '') => `
  <div style="${style}">
    ${organisation.logo ? `<img src="${organisation.logo}" alt="Logo" style="max-height:60px;margin-bottom:8px;">` : ''}
    <h2 style="margin:0;font-size:18px;">${organisation.name}</h2>
    <p style="margin:2px 0;font-size:11px;">${organisation.address}${organisation.city ? ', ' + organisation.city : ''}${organisation.state ? ', ' + organisation.state : ''}${organisation.pincode ? ' - ' + organisation.pincode : ''}</p>
    ${organisation.gstin ? `<p style="margin:1px 0;font-size:11px;">GSTIN: ${organisation.gstin}</p>` : ''}
    ${organisation.pan ? `<p style="margin:1px 0;font-size:11px;">PAN: ${organisation.pan}</p>` : ''}
    <p style="margin:1px 0;font-size:11px;">Phone: ${organisation.phone} | Email: ${organisation.email}</p>
  </div>
`;

const addressBlock = (label, customer, address, helpers) => {
  if (!address) return `<div><strong>${label}</strong><p>Same as Billing Address</p></div>`;
  return `
    <div>
      <strong>${label}</strong>
      <p style="font-weight:600;">${customer.name}</p>
      <p>${address.line1 || address.address || ''}</p>
      ${address.line2 ? `<p>${address.line2}</p>` : ''}
      <p>${address.city}, ${address.state} - ${address.pincode}</p>
      ${customer.gstin ? `<p>GSTIN: ${customer.gstin}</p>` : '<p>Unregistered Customer</p>'}
      ${address.state ? `<p>State: ${address.state} ${helpers.STATE_CODES[address.state] ? '(' + helpers.STATE_CODES[address.state] + ')' : ''}</p>` : ''}
      ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}
    </div>
  `;
};

const bankDetailsSection = (organisation, qrCodeDataUrl) => {
  if (!organisation.bankName) return '';
  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:15px;">
      <div>
        <strong>Bank Details</strong>
        <p>Bank: ${organisation.bankName}${organisation.branch ? ', ' + organisation.branch : ''}</p>
        ${organisation.accountHolderName ? `<p>A/c Holder: ${organisation.accountHolderName}</p>` : ''}
        ${organisation.accountNumber ? `<p>A/c No: ${organisation.accountNumber}</p>` : ''}
        ${organisation.ifsc ? `<p>IFSC: ${organisation.ifsc}</p>` : ''}
        ${organisation.upi ? `<p>UPI: ${organisation.upi}</p>` : ''}
      </div>
      ${qrCodeDataUrl ? `<div style="text-align:center;"><p style="font-size:10px;">Scan to Pay</p><img src="${qrCodeDataUrl}" alt="QR" style="width:120px;"></div>` : ''}
    </div>
  `;
};

const notesSection = (invoice) => {
  const fields = [
    { key: 'notes', label: 'Notes' },
    { key: 'termsConditions', label: 'Terms & Conditions' },
    { key: 'paymentInstructions', label: 'Payment Instructions' },
    { key: 'deliveryInstructions', label: 'Delivery Instructions' },
    { key: 'returnPolicy', label: 'Return Policy' },
    { key: 'lateFeePolicy', label: 'Late Fee Policy' },
    { key: 'warrantyInfo', label: 'Warranty' },
    { key: 'supportContact', label: 'Support Contact' },
    { key: 'declaration', label: 'Declaration' },
  ];
  return fields.filter(f => invoice[f.key]).map(f => `<p><strong>${f.label}:</strong> ${invoice[f.key]}</p>`).join('');
};

const totalsBlock = (invoice, isInterstate) => {
  const total = invoice.total || invoice.totalAmount || 0;
  const subtotal = invoice.subtotal || 0;
  const cgst = invoice.cgst || 0;
  const sgst = invoice.sgst || 0;
  const igst = invoice.igst || 0;
  const cess = invoice.cess || 0;
  let rows = `<tr><td>Subtotal</td><td style="text-align:right;">${formatCurrency(subtotal)}</td></tr>`;
  if (!isInterstate && cgst > 0) rows += `<tr><td>CGST</td><td style="text-align:right;">${formatCurrency(cgst)}</td></tr>`;
  if (!isInterstate && sgst > 0) rows += `<tr><td>SGST</td><td style="text-align:right;">${formatCurrency(sgst)}</td></tr>`;
  if (isInterstate && igst > 0) rows += `<tr><td>IGST</td><td style="text-align:right;">${formatCurrency(igst)}</td></tr>`;
  if (cess > 0) rows += `<tr><td>CESS</td><td style="text-align:right;">${formatCurrency(cess)}</td></tr>`;
  if (invoice.deliveryCharges > 0) rows += `<tr><td>Delivery Charges</td><td style="text-align:right;">${formatCurrency(invoice.deliveryCharges)}</td></tr>`;
  if (invoice.otherCharges > 0) rows += `<tr><td>Other Charges</td><td style="text-align:right;">${formatCurrency(invoice.otherCharges)}</td></tr>`;
  if (invoice.roundOff && invoice.roundOff !== 0) rows += `<tr><td>Round Off</td><td style="text-align:right;">${formatCurrency(invoice.roundOff)}</td></tr>`;
  rows += `<tr style="font-weight:bold;font-size:14px;"><td>Grand Total</td><td style="text-align:right;">${formatCurrency(total)}</td></tr>`;
  return rows;
};

const invoiceMeta = (invoice, billingAddress, helpers) => {
  const billState = billingAddress?.state || '';
  return `
    <tr><td><strong>Invoice No:</strong></td><td>${invoice.invoiceNumber}</td><td><strong>Invoice Date:</strong></td><td>${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</td></tr>
    <tr><td><strong>Due Date:</strong></td><td>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '-'}</td><td><strong>Place of Supply:</strong></td><td>${invoice.placeOfSupply || billState} ${billState && helpers.STATE_CODES[billState] ? '(' + helpers.STATE_CODES[billState] + ')' : ''}</td></tr>
    <tr><td><strong>Reverse Charge:</strong></td><td>${invoice.reverseCharge ? 'Yes' : 'No'}</td><td><strong>Payment Terms:</strong></td><td>${invoice.paymentTerms || 'NET_30'}</td></tr>
    ${invoice.vehicleNumber ? `<tr><td><strong>Vehicle No:</strong></td><td>${invoice.vehicleNumber}</td><td></td><td></td></tr>` : ''}
    ${invoice.ewayBillNumber ? `<tr><td><strong>E-Way Bill:</strong></td><td>${invoice.ewayBillNumber}</td><td></td><td></td></tr>` : ''}
    ${invoice.transportName ? `<tr><td><strong>Transport:</strong></td><td>${invoice.transportName}</td><td></td><td></td></tr>` : ''}
    ${invoice.lrNumber ? `<tr><td><strong>LR No:</strong></td><td>${invoice.lrNumber}</td><td></td><td></td></tr>` : ''}
  `;
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 1: CLASSIC (Original style - clean bordered table layout)
// ═══════════════════════════════════════════════════════════════════
const classicTemplate = (invoice, organisation, billingAddress, shippingAddress, h) => {
  const hasDiscount = invoice.items.some(i => i.discount > 0);
  const total = invoice.total || invoice.totalAmount || 0;
  const subtotal = invoice.subtotal || 0;
  return `<!DOCTYPE html><html><head><style>
    ${baseCSS}
    .invoice { max-width: 800px; margin: 0 auto; padding: 20px; border: 2px solid #333; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .meta-table td { padding: 3px 8px; font-size: 11px; }
    .items th { background: #333; color: #fff; padding: 6px 4px; font-size: 10px; text-align: center; }
    .items td { border: 1px solid #ddd; padding: 5px 4px; font-size: 10px; text-align: center; }
    .items tr:nth-child(even) { background: #f9f9f9; }
    .section { margin: 10px 0; }
    .addr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .addr-grid p { font-size: 11px; margin: 1px 0; }
    .totals td { padding: 3px 8px; font-size: 12px; }
    .footer { text-align: center; font-size: 9px; color: #888; margin-top: 15px; border-top: 1px solid #ddd; padding-top: 5px; }
  </style></head><body><div class="invoice">
    <div class="header">
      ${orgHeader(organisation)}
      <div style="text-align:right;">
        <h3 style="font-size:16px;text-transform:uppercase;">${invoice.invoiceType?.replace('_', ' ') || 'TAX INVOICE'}</h3>
        <p style="font-size:10px;color:#666;">${invoice.invoiceCopyType || ''}</p>
      </div>
    </div>
    <div class="section"><table class="meta-table">${invoiceMeta(invoice, billingAddress, h)}</table></div>
    <div class="section addr-grid">
      ${addressBlock('Bill To', invoice.customer, billingAddress, h)}
      ${addressBlock('Ship To', invoice.customer, shippingAddress || billingAddress, h)}
    </div>
    <table class="items">
      <thead><tr>
        <th>Sr</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Unit</th><th>Rate</th>
        ${hasDiscount ? '<th>Disc</th>' : ''}
        <th>Tax%</th>${!h.isInterstate ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}<th>Amount</th>
      </tr></thead>
      <tbody>
        ${invoice.items.map((item, idx) => {
          const row = buildItemRows([item], h.isInterstate, hasDiscount)[0];
          return `<tr>
            <td>${row.idx}</td><td style="text-align:left;">${row.productName}${row.subDesc ? '<br><small>' + row.subDesc + '</small>' : ''}</td>
            <td>${row.hsnSac}</td><td>${item.quantity}</td><td>${item.unit}</td><td>${formatCurrency(item.rate)}</td>
            ${hasDiscount ? `<td>${formatCurrency(item.discount || 0)}</td>` : ''}
            <td>${item.taxRate}%</td>
            ${!h.isInterstate ? `<td>${formatCurrency(item.cgst || 0)}</td><td>${formatCurrency(item.sgst || 0)}</td>` : `<td>${formatCurrency(item.igst || 0)}</td>`}
            <td>${formatCurrency(item.amount)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="section" style="display:flex;justify-content:space-between;">
      <div style="flex:1;font-size:11px;">
        <p><strong>Amount in Words:</strong> ${h.amountToWords(total)}</p>
      </div>
      <table style="width:250px;" class="totals">${totalsBlock(invoice, h.isInterstate)}</table>
    </div>
    ${bankDetailsSection(organisation, h.qrCodeDataUrl)}
    <div class="section" style="font-size:10px;">${notesSection(invoice)}</div>
    <div style="text-align:right;margin-top:30px;">
      <p>For <strong>${organisation.name}</strong></p>
      <p style="margin-top:40px;">Authorized Signatory</p>
    </div>
    <div class="footer">This is a computer generated invoice and does not require a physical signature</div>
  </div></body></html>`;
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 2: MODERN (Blue accent, rounded corners, shadow)
// ═══════════════════════════════════════════════════════════════════
const modernTemplate = (invoice, organisation, billingAddress, shippingAddress, h) => {
  const hasDiscount = invoice.items.some(i => i.discount > 0);
  const total = invoice.total || invoice.totalAmount || 0;
  return `<!DOCTYPE html><html><head><style>
    ${baseCSS}
    .invoice { max-width: 800px; margin: 0 auto; padding: 25px; font-family: 'Helvetica Neue', Arial, sans-serif; }
    .header-bar { background: linear-gradient(135deg, #1a56db, #2563eb); color: #fff; padding: 20px 25px; border-radius: 8px 8px 0 0; display: flex; justify-content: space-between; align-items: center; }
    .header-bar h2 { margin: 0; font-size: 20px; }
    .header-bar p { margin: 2px 0; font-size: 11px; opacity: 0.9; }
    .body-wrap { border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 20px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 3px 10px; border-radius: 20px; font-size: 10px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; padding: 12px; border-radius: 6px; margin: 15px 0; }
    .meta-grid p { font-size: 11px; margin: 2px 0; }
    .addr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 15px 0; }
    .addr-grid p { font-size: 11px; margin: 1px 0; }
    .addr-card { background: #f8fafc; padding: 12px; border-radius: 6px; border-left: 3px solid #2563eb; }
    .items { margin: 15px 0; border-radius: 6px; overflow: hidden; }
    .items th { background: #f1f5f9; color: #334155; padding: 8px 6px; font-size: 10px; text-align: center; font-weight: 600; }
    .items td { padding: 6px; font-size: 10px; text-align: center; border-bottom: 1px solid #f1f5f9; }
    .totals-wrap { display: flex; justify-content: space-between; margin-top: 15px; }
    .totals td { padding: 4px 10px; font-size: 12px; }
    .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 20px; }
  </style></head><body><div class="invoice">
    <div class="header-bar">
      <div>
        ${organisation.logo ? `<img src="${organisation.logo}" alt="Logo" style="max-height:45px;margin-bottom:5px;filter:brightness(0) invert(1);">` : ''}
        <h2>${organisation.name}</h2>
        <p>${organisation.address}${organisation.city ? ', ' + organisation.city : ''}${organisation.state ? ', ' + organisation.state : ''}</p>
        ${organisation.gstin ? `<p>GSTIN: ${organisation.gstin}</p>` : ''}
        <p>${organisation.phone} | ${organisation.email}</p>
      </div>
      <div style="text-align:right;">
        <h3 style="font-size:22px;margin:0;">${invoice.invoiceType?.replace('_', ' ') || 'TAX INVOICE'}</h3>
        <span class="badge">${invoice.invoiceCopyType || ''}</span>
      </div>
    </div>
    <div class="body-wrap">
      <div class="meta-grid">
        <p><strong>Invoice No:</strong> ${invoice.invoiceNumber}</p>
        <p><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</p>
        <p><strong>Due Date:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '-'}</p>
        <p><strong>Place of Supply:</strong> ${invoice.placeOfSupply || billingAddress?.state || ''}</p>
        <p><strong>Reverse Charge:</strong> ${invoice.reverseCharge ? 'Yes' : 'No'}</p>
        <p><strong>Payment Terms:</strong> ${invoice.paymentTerms || 'NET_30'}</p>
        ${invoice.vehicleNumber ? `<p><strong>Vehicle:</strong> ${invoice.vehicleNumber}</p>` : ''}
        ${invoice.ewayBillNumber ? `<p><strong>E-Way Bill:</strong> ${invoice.ewayBillNumber}</p>` : ''}
      </div>
      <div class="addr-grid">
        <div class="addr-card">${addressBlock('Bill To', invoice.customer, billingAddress, h)}</div>
        <div class="addr-card">${addressBlock('Ship To', invoice.customer, shippingAddress || billingAddress, h)}</div>
      </div>
      <table class="items">
        <thead><tr>
          <th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th>
          ${hasDiscount ? '<th>Disc</th>' : ''}<th>Tax</th>
          ${!h.isInterstate ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}<th>Amount</th>
        </tr></thead>
        <tbody>
          ${invoice.items.map((item, idx) => {
            const row = buildItemRows([item], h.isInterstate, hasDiscount)[0];
            return `<tr>
              <td>${idx+1}</td><td style="text-align:left;">${row.productName}</td><td>${row.hsnSac}</td>
              <td>${item.quantity}</td><td>${item.unit}</td><td>${formatCurrency(item.rate)}</td>
              ${hasDiscount ? `<td>${formatCurrency(item.discount||0)}</td>` : ''}<td>${item.taxRate}%</td>
              ${!h.isInterstate ? `<td>${formatCurrency(item.cgst||0)}</td><td>${formatCurrency(item.sgst||0)}</td>` : `<td>${formatCurrency(item.igst||0)}</td>`}
              <td>${formatCurrency(item.amount)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="totals-wrap">
        <div style="font-size:11px;"><p><strong>In Words:</strong> ${h.amountToWords(total)}</p></div>
        <table style="width:250px;" class="totals">${totalsBlock(invoice, h.isInterstate)}</table>
      </div>
      ${bankDetailsSection(organisation, h.qrCodeDataUrl)}
      <div style="font-size:10px;margin-top:10px;">${notesSection(invoice)}</div>
      <div style="text-align:right;margin-top:30px;">
        <p>For <strong>${organisation.name}</strong></p><p style="margin-top:40px;">Authorized Signatory</p>
      </div>
    </div>
    <div class="footer">Computer generated invoice — no signature required</div>
  </div></body></html>`;
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 3: MINIMAL (Clean whitespace, thin lines)
// ═══════════════════════════════════════════════════════════════════
const minimalTemplate = (invoice, organisation, billingAddress, shippingAddress, h) => {
  const hasDiscount = invoice.items.some(i => i.discount > 0);
  const total = invoice.total || invoice.totalAmount || 0;
  return `<!DOCTYPE html><html><head><style>
    ${baseCSS}
    body { font-family: 'Georgia', serif; color: #222; }
    .invoice { max-width: 780px; margin: 0 auto; padding: 30px; }
    .header { display: flex; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid #e0e0e0; }
    .inv-title { font-size: 28px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase; color: #555; }
    .copy-type { font-size: 9px; color: #999; letter-spacing: 2px; }
    .meta { margin: 20px 0; font-size: 11px; color: #555; }
    .meta span { margin-right: 20px; }
    .addr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin: 20px 0; }
    .addr-grid p { font-size: 11px; margin: 1px 0; color: #444; }
    .items { margin: 20px 0; }
    .items th { border-bottom: 2px solid #222; padding: 8px 4px; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #666; text-align: left; }
    .items td { border-bottom: 1px solid #eee; padding: 8px 4px; font-size: 11px; }
    .totals-section { display: flex; justify-content: flex-end; margin-top: 20px; }
    .totals td { padding: 4px 12px; font-size: 11px; }
    .words { font-size: 10px; color: #666; font-style: italic; margin: 15px 0; }
    .sig { text-align: right; margin-top: 50px; font-size: 11px; }
    .footer { text-align: center; font-size: 8px; color: #bbb; margin-top: 30px; border-top: 1px solid #eee; padding-top: 8px; }
  </style></head><body><div class="invoice">
    <div class="header">
      <div>
        ${organisation.logo ? `<img src="${organisation.logo}" alt="" style="max-height:50px;margin-bottom:8px;">` : ''}
        <h2 style="margin:0;font-size:16px;font-weight:600;">${organisation.name}</h2>
        <p style="font-size:10px;color:#777;">${organisation.address}${organisation.city ? ', ' + organisation.city : ''}${organisation.state ? ', ' + organisation.state : ''}</p>
        ${organisation.gstin ? `<p style="font-size:10px;color:#777;">GSTIN: ${organisation.gstin}</p>` : ''}
      </div>
      <div style="text-align:right;">
        <div class="inv-title">${invoice.invoiceType?.replace('_', ' ') || 'Invoice'}</div>
        <div class="copy-type">${invoice.invoiceCopyType || ''}</div>
      </div>
    </div>
    <div class="meta">
      <span><strong>No:</strong> ${invoice.invoiceNumber}</span>
      <span><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
      <span><strong>Due:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '—'}</span>
      <span><strong>Terms:</strong> ${invoice.paymentTerms || 'NET_30'}</span>
    </div>
    <div class="addr-grid">
      ${addressBlock('Bill To', invoice.customer, billingAddress, h)}
      ${addressBlock('Ship To', invoice.customer, shippingAddress || billingAddress, h)}
    </div>
    <table class="items">
      <thead><tr>
        <th>#</th><th>Description</th><th>HSN</th><th style="text-align:center;">Qty</th><th>Rate</th>
        ${hasDiscount ? '<th>Disc</th>' : ''}<th>Tax</th>
        ${!h.isInterstate ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}<th style="text-align:right;">Amount</th>
      </tr></thead>
      <tbody>
        ${invoice.items.map((item, idx) => {
          const row = buildItemRows([item], h.isInterstate, hasDiscount)[0];
          return `<tr>
            <td>${idx+1}</td><td>${row.productName}</td><td>${row.hsnSac}</td>
            <td style="text-align:center;">${item.quantity} ${item.unit}</td><td>${formatCurrency(item.rate)}</td>
            ${hasDiscount ? `<td>${formatCurrency(item.discount||0)}</td>` : ''}<td>${item.taxRate}%</td>
            ${!h.isInterstate ? `<td>${formatCurrency(item.cgst||0)}</td><td>${formatCurrency(item.sgst||0)}</td>` : `<td>${formatCurrency(item.igst||0)}</td>`}
            <td style="text-align:right;">${formatCurrency(item.amount)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div class="words">${h.amountToWords(total)}</div>
    <div class="totals-section">
      <table style="width:220px;" class="totals">${totalsBlock(invoice, h.isInterstate)}</table>
    </div>
    ${bankDetailsSection(organisation, h.qrCodeDataUrl)}
    <div style="font-size:10px;margin-top:15px;color:#555;">${notesSection(invoice)}</div>
    <div class="sig"><p>For ${organisation.name}</p><p style="margin-top:40px;color:#999;">Authorized Signatory</p></div>
    <div class="footer">Computer generated invoice</div>
  </div></body></html>`;
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 4: PROFESSIONAL (Dark header, grey tones)
// ═══════════════════════════════════════════════════════════════════
const professionalTemplate = (invoice, organisation, billingAddress, shippingAddress, h) => {
  const hasDiscount = invoice.items.some(i => i.discount > 0);
  const total = invoice.total || invoice.totalAmount || 0;
  return `<!DOCTYPE html><html><head><style>
    ${baseCSS}
    .invoice { max-width: 800px; margin: 0 auto; }
    .header { background: #1e293b; color: #fff; padding: 25px; display: flex; justify-content: space-between; }
    .header h2 { margin: 0; font-size: 20px; }
    .header p { font-size: 10px; opacity: 0.85; margin: 1px 0; }
    .inv-type { font-size: 24px; font-weight: 700; text-align: right; }
    .copy-badge { background: #f59e0b; color: #1e293b; font-size: 9px; padding: 2px 8px; border-radius: 3px; font-weight: 600; }
    .content { padding: 20px 25px; }
    .meta-bar { background: #f1f5f9; padding: 10px 15px; border-radius: 4px; margin-bottom: 15px; display: flex; flex-wrap: wrap; gap: 15px; font-size: 11px; }
    .addr-row { display: flex; gap: 20px; margin: 15px 0; }
    .addr-box { flex: 1; border: 1px solid #e2e8f0; padding: 12px; border-radius: 4px; }
    .addr-box p { font-size: 11px; margin: 1px 0; }
    .items th { background: #334155; color: #fff; padding: 8px 5px; font-size: 10px; text-align: center; }
    .items td { padding: 6px 5px; font-size: 10px; text-align: center; border-bottom: 1px solid #e2e8f0; }
    .items tr:hover { background: #f8fafc; }
    .summary { display: flex; justify-content: space-between; margin-top: 15px; align-items: flex-start; }
    .totals td { padding: 4px 10px; font-size: 12px; }
    .total-row { background: #1e293b; color: #fff; border-radius: 4px; }
    .sig { text-align: right; margin-top: 40px; font-size: 11px; }
    .footer { background: #f8fafc; text-align: center; padding: 8px; font-size: 9px; color: #94a3b8; margin-top: 20px; }
  </style></head><body><div class="invoice">
    <div class="header">
      <div>
        ${organisation.logo ? `<img src="${organisation.logo}" alt="" style="max-height:50px;margin-bottom:5px;filter:brightness(0) invert(1);">` : ''}
        <h2>${organisation.name}</h2>
        <p>${organisation.address}${organisation.city ? ', ' + organisation.city : ''}${organisation.state ? ', ' + organisation.state : ''}</p>
        ${organisation.gstin ? `<p>GSTIN: ${organisation.gstin}</p>` : ''}
        <p>${organisation.phone} | ${organisation.email}</p>
      </div>
      <div>
        <div class="inv-type">${invoice.invoiceType?.replace('_', ' ') || 'TAX INVOICE'}</div>
        <span class="copy-badge">${invoice.invoiceCopyType || ''}</span>
      </div>
    </div>
    <div class="content">
      <div class="meta-bar">
        <span><strong>Invoice:</strong> ${invoice.invoiceNumber}</span>
        <span><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
        <span><strong>Due:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '-'}</span>
        <span><strong>Supply:</strong> ${invoice.placeOfSupply || billingAddress?.state || ''}</span>
        <span><strong>Terms:</strong> ${invoice.paymentTerms || 'NET_30'}</span>
      </div>
      <div class="addr-row">
        <div class="addr-box">${addressBlock('Bill To', invoice.customer, billingAddress, h)}</div>
        <div class="addr-box">${addressBlock('Ship To', invoice.customer, shippingAddress || billingAddress, h)}</div>
      </div>
      <table class="items">
        <thead><tr>
          <th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th>
          ${hasDiscount ? '<th>Disc</th>' : ''}<th>Tax</th>
          ${!h.isInterstate ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}<th>Amount</th>
        </tr></thead>
        <tbody>
          ${invoice.items.map((item, idx) => {
            const row = buildItemRows([item], h.isInterstate, hasDiscount)[0];
            return `<tr>
              <td>${idx+1}</td><td style="text-align:left;">${row.productName}</td><td>${row.hsnSac}</td>
              <td>${item.quantity}</td><td>${item.unit}</td><td>${formatCurrency(item.rate)}</td>
              ${hasDiscount ? `<td>${formatCurrency(item.discount||0)}</td>` : ''}<td>${item.taxRate}%</td>
              ${!h.isInterstate ? `<td>${formatCurrency(item.cgst||0)}</td><td>${formatCurrency(item.sgst||0)}</td>` : `<td>${formatCurrency(item.igst||0)}</td>`}
              <td>${formatCurrency(item.amount)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div class="summary">
        <p style="font-size:11px;flex:1;"><strong>In Words:</strong> ${h.amountToWords(total)}</p>
        <table style="width:250px;" class="totals">${totalsBlock(invoice, h.isInterstate)}</table>
      </div>
      ${bankDetailsSection(organisation, h.qrCodeDataUrl)}
      <div style="font-size:10px;margin-top:10px;">${notesSection(invoice)}</div>
      <div class="sig"><p>For <strong>${organisation.name}</strong></p><p style="margin-top:40px;">Authorized Signatory</p></div>
    </div>
    <div class="footer">Computer generated invoice — no physical signature required</div>
  </div></body></html>`;
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 5: COMPACT (Space-efficient, smaller fonts, dense layout)
// ═══════════════════════════════════════════════════════════════════
const compactTemplate = (invoice, organisation, billingAddress, shippingAddress, h) => {
  const hasDiscount = invoice.items.some(i => i.discount > 0);
  const total = invoice.total || invoice.totalAmount || 0;
  return `<!DOCTYPE html><html><head><style>
    ${baseCSS}
    body { font-size: 10px; }
    .invoice { max-width: 780px; margin: 0 auto; padding: 15px; }
    .header { display: flex; justify-content: space-between; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 8px; }
    .header h3 { margin: 0; font-size: 14px; }
    .header p { font-size: 9px; margin: 0; }
    .row { display: flex; gap: 10px; margin: 5px 0; }
    .col { flex: 1; }
    .col p { font-size: 9px; margin: 0; }
    .meta-inline { font-size: 9px; background: #f5f5f5; padding: 5px 8px; border-radius: 3px; margin: 5px 0; }
    .meta-inline span { margin-right: 12px; }
    .items th { background: #444; color: #fff; padding: 4px 3px; font-size: 8px; text-align: center; }
    .items td { padding: 3px; font-size: 9px; text-align: center; border-bottom: 1px solid #eee; }
    .totals td { padding: 2px 6px; font-size: 10px; }
    .footer { font-size: 8px; color: #aaa; text-align: center; margin-top: 10px; }
  </style></head><body><div class="invoice">
    <div class="header">
      <div>
        <h3>${organisation.name}</h3>
        <p>${organisation.address}${organisation.city ? ', ' + organisation.city : ''}${organisation.state ? ', ' + organisation.state : ''}</p>
        ${organisation.gstin ? `<p>GSTIN: ${organisation.gstin} ${organisation.pan ? '| PAN: ' + organisation.pan : ''}</p>` : ''}
        <p>${organisation.phone} | ${organisation.email}</p>
      </div>
      <div style="text-align:right;">
        <strong style="font-size:12px;">${invoice.invoiceType?.replace('_', ' ') || 'TAX INVOICE'}</strong>
        <p style="color:#888;">${invoice.invoiceCopyType || ''}</p>
      </div>
    </div>
    <div class="meta-inline">
      <span><strong>No:</strong> ${invoice.invoiceNumber}</span>
      <span><strong>Date:</strong> ${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</span>
      <span><strong>Due:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '-'}</span>
      <span><strong>Supply:</strong> ${invoice.placeOfSupply || billingAddress?.state || ''}</span>
      <span><strong>RC:</strong> ${invoice.reverseCharge ? 'Y' : 'N'}</span>
    </div>
    <div class="row">
      <div class="col">${addressBlock('Bill To', invoice.customer, billingAddress, h)}</div>
      <div class="col">${addressBlock('Ship To', invoice.customer, shippingAddress || billingAddress, h)}</div>
    </div>
    <table class="items">
      <thead><tr>
        <th>#</th><th>Item</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th>
        ${hasDiscount ? '<th>Disc</th>' : ''}<th>Tax</th>
        ${!h.isInterstate ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}<th>Amt</th>
      </tr></thead>
      <tbody>
        ${invoice.items.map((item, idx) => {
          const row = buildItemRows([item], h.isInterstate, hasDiscount)[0];
          return `<tr>
            <td>${idx+1}</td><td style="text-align:left;">${row.productName}</td><td>${row.hsnSac}</td>
            <td>${item.quantity}</td><td>${item.unit}</td><td>${formatCurrency(item.rate)}</td>
            ${hasDiscount ? `<td>${formatCurrency(item.discount||0)}</td>` : ''}<td>${item.taxRate}%</td>
            ${!h.isInterstate ? `<td>${formatCurrency(item.cgst||0)}</td><td>${formatCurrency(item.sgst||0)}</td>` : `<td>${formatCurrency(item.igst||0)}</td>`}
            <td>${formatCurrency(item.amount)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:8px;">
      <p style="font-size:9px;flex:1;"><strong>Words:</strong> ${h.amountToWords(total)}</p>
      <table style="width:200px;" class="totals">${totalsBlock(invoice, h.isInterstate)}</table>
    </div>
    ${bankDetailsSection(organisation, h.qrCodeDataUrl)}
    <div style="font-size:9px;margin-top:5px;">${notesSection(invoice)}</div>
    <div style="text-align:right;margin-top:20px;font-size:10px;">
      <p>For ${organisation.name}</p><p style="margin-top:25px;">Auth. Signatory</p>
    </div>
    <div class="footer">Computer generated invoice</div>
  </div></body></html>`;
};

// ═══════════════════════════════════════════════════════════════════
// TEMPLATE 6: ELEGANT (Green accent, serif fonts, watermark feel)
// ═══════════════════════════════════════════════════════════════════
const elegantTemplate = (invoice, organisation, billingAddress, shippingAddress, h) => {
  const hasDiscount = invoice.items.some(i => i.discount > 0);
  const total = invoice.total || invoice.totalAmount || 0;
  return `<!DOCTYPE html><html><head><style>
    ${baseCSS}
    body { font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif; color: #2d3436; }
    .invoice { max-width: 800px; margin: 0 auto; padding: 30px; }
    .header { text-align: center; border-bottom: 3px double #0d9488; padding-bottom: 15px; margin-bottom: 20px; }
    .header h2 { font-size: 22px; color: #0d9488; margin: 0; letter-spacing: 1px; }
    .header p { font-size: 10px; color: #666; margin: 2px 0; }
    .inv-label { font-size: 14px; color: #0d9488; text-transform: uppercase; letter-spacing: 4px; margin-top: 10px; }
    .copy-type { font-size: 9px; color: #999; letter-spacing: 1px; }
    .meta-table { width: auto; margin: 15px auto; }
    .meta-table td { padding: 3px 12px; font-size: 11px; }
    .addr-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; margin: 20px 0; }
    .addr-grid p { font-size: 11px; margin: 1px 0; }
    .addr-grid strong { color: #0d9488; font-size: 12px; }
    .items { margin: 15px 0; }
    .items th { background: #0d9488; color: #fff; padding: 7px 5px; font-size: 10px; text-align: center; }
    .items td { padding: 6px 5px; font-size: 10px; text-align: center; border-bottom: 1px solid #e0e0e0; }
    .items tr:nth-child(even) { background: #f0fdfa; }
    .totals td { padding: 4px 10px; font-size: 11px; }
    .grand { background: #0d9488; color: #fff; border-radius: 4px; }
    .footer { text-align: center; font-size: 8px; color: #aaa; margin-top: 25px; border-top: 1px solid #ddd; padding-top: 8px; }
  </style></head><body><div class="invoice">
    <div class="header">
      ${organisation.logo ? `<img src="${organisation.logo}" alt="" style="max-height:55px;margin-bottom:8px;">` : ''}
      <h2>${organisation.name}</h2>
      <p>${organisation.address}${organisation.city ? ', ' + organisation.city : ''}${organisation.state ? ', ' + organisation.state : ''}${organisation.pincode ? ' - ' + organisation.pincode : ''}</p>
      ${organisation.gstin ? `<p>GSTIN: ${organisation.gstin}</p>` : ''}
      <p>${organisation.phone} | ${organisation.email}</p>
      <div class="inv-label">${invoice.invoiceType?.replace('_', ' ') || 'Tax Invoice'}</div>
      <div class="copy-type">${invoice.invoiceCopyType || ''}</div>
    </div>
    <table class="meta-table">
      <tr><td><strong>Invoice No:</strong></td><td>${invoice.invoiceNumber}</td><td><strong>Date:</strong></td><td>${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</td></tr>
      <tr><td><strong>Due Date:</strong></td><td>${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '-'}</td><td><strong>Terms:</strong></td><td>${invoice.paymentTerms || 'NET_30'}</td></tr>
    </table>
    <div class="addr-grid">
      ${addressBlock('Bill To', invoice.customer, billingAddress, h)}
      ${addressBlock('Ship To', invoice.customer, shippingAddress || billingAddress, h)}
    </div>
    <table class="items">
      <thead><tr>
        <th>#</th><th>Description</th><th>HSN</th><th>Qty</th><th>Unit</th><th>Rate</th>
        ${hasDiscount ? '<th>Disc</th>' : ''}<th>Tax</th>
        ${!h.isInterstate ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}<th>Amount</th>
      </tr></thead>
      <tbody>
        ${invoice.items.map((item, idx) => {
          const row = buildItemRows([item], h.isInterstate, hasDiscount)[0];
          return `<tr>
            <td>${idx+1}</td><td style="text-align:left;">${row.productName}</td><td>${row.hsnSac}</td>
            <td>${item.quantity}</td><td>${item.unit}</td><td>${formatCurrency(item.rate)}</td>
            ${hasDiscount ? `<td>${formatCurrency(item.discount||0)}</td>` : ''}<td>${item.taxRate}%</td>
            ${!h.isInterstate ? `<td>${formatCurrency(item.cgst||0)}</td><td>${formatCurrency(item.sgst||0)}</td>` : `<td>${formatCurrency(item.igst||0)}</td>`}
            <td>${formatCurrency(item.amount)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="display:flex;justify-content:space-between;margin-top:15px;">
      <p style="font-size:10px;font-style:italic;flex:1;">${h.amountToWords(total)}</p>
      <table style="width:230px;" class="totals">${totalsBlock(invoice, h.isInterstate)}</table>
    </div>
    ${bankDetailsSection(organisation, h.qrCodeDataUrl)}
    <div style="font-size:10px;margin-top:10px;">${notesSection(invoice)}</div>
    <div style="text-align:right;margin-top:35px;font-size:11px;">
      <p>For ${organisation.name}</p><p style="margin-top:40px;color:#0d9488;">Authorized Signatory</p>
    </div>
    <div class="footer">Computer generated invoice — no signature required</div>
  </div></body></html>`;
};

// ═══════════════════════════════════════════════════════════════════
// Template Registry
// ═══════════════════════════════════════════════════════════════════
const TEMPLATES = {
  classic: { name: 'Classic', description: 'Traditional bordered layout with alternating rows', render: classicTemplate },
  modern: { name: 'Modern', description: 'Blue gradient header with card-style sections', render: modernTemplate },
  minimal: { name: 'Minimal', description: 'Clean whitespace with serif typography', render: minimalTemplate },
  professional: { name: 'Professional', description: 'Dark header with slate tones', render: professionalTemplate },
  compact: { name: 'Compact', description: 'Dense space-efficient layout', render: compactTemplate },
  elegant: { name: 'Elegant', description: 'Green accent with classic serif styling', render: elegantTemplate },
};

const getTemplate = (templateId) => {
  return TEMPLATES[templateId] || TEMPLATES.classic;
};

const listTemplates = () => {
  return Object.entries(TEMPLATES).map(([id, t]) => ({ id, name: t.name, description: t.description }));
};

module.exports = { TEMPLATES, getTemplate, listTemplates, formatCurrency };
