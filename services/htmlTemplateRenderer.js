/**
 * HTML Template Renderer
 *
 * Loads .html files from invoice-backend/templates/
 * Replaces {{tokens}} with real invoice data.
 * Auto-registers each file as a template — no code changes needed.
 *
 * Usage: drop a .html file in /templates, restart server.
 * Template ID = filename without extension (e.g. "mydesign.html" → id "mydesign")
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../templates');

// ─── Helpers ──────────────────────────────────────────────────────

const fmt = (n) => `₹${Number(n || 0).toFixed(2)}`;

const safeDate = (d) => {
  try { return d ? new Date(d).toLocaleDateString('en-IN') : '-'; } catch { return '-'; }
};

const STATE_CODES = {
  'Andhra Pradesh': '37', 'Arunachal Pradesh': '12', 'Assam': '18', 'Bihar': '10',
  'Chhattisgarh': '22', 'Goa': '30', 'Gujarat': '24', 'Haryana': '06', 'Himachal Pradesh': '02',
  'Jharkhand': '20', 'Karnataka': '29', 'Kerala': '32', 'Madhya Pradesh': '23', 'Maharashtra': '27',
  'Manipur': '14', 'Meghalaya': '17', 'Mizoram': '15', 'Nagaland': '13', 'Odisha': '21',
  'Punjab': '03', 'Rajasthan': '08', 'Sikkim': '11', 'Tamil Nadu': '33', 'Telangana': '36',
  'Tripura': '16', 'Uttar Pradesh': '09', 'Uttarakhand': '05', 'West Bengal': '19',
  'Delhi': '07', 'Chandigarh': '04', 'Jammu and Kashmir': '01', 'Ladakh': '02',
  'Puducherry': '34', 'Lakshadweep': '31',
};

// ─── Block renderers (replace {{items}}, {{totals}}, etc.) ────────

function renderItemsTable(invoice, isInterstate) {
  const hasDiscount = invoice.items.some(i => i.discount > 0);
  const rows = invoice.items.map((item, idx) => {
    const name = (item.product && item.product.name) || item.description || '';
    const desc = (item.product && item.product.name && item.description && item.description !== item.product.name)
      ? `<br><small style="color:#666;">${item.description}</small>` : '';
    const hsn = item.hsnSac || (item.product && (item.product.hsnCode || item.product.sacCode)) || '-';
    return `<tr>
      <td style="text-align:center;">${idx + 1}</td>
      <td>${name}${desc}</td>
      <td style="text-align:center;">${hsn}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:center;">${item.unit}</td>
      <td style="text-align:right;">${fmt(item.rate)}</td>
      ${hasDiscount ? `<td style="text-align:right;">${fmt(item.discount || 0)}</td>` : ''}
      <td style="text-align:center;">${item.taxRate}%</td>
      ${!isInterstate
        ? `<td style="text-align:right;">${fmt(item.cgst || 0)}</td><td style="text-align:right;">${fmt(item.sgst || 0)}</td>`
        : `<td style="text-align:right;">${fmt(item.igst || 0)}</td>`}
      <td style="text-align:right;font-weight:600;">${fmt(item.amount)}</td>
    </tr>`;
  }).join('');

  return `<table style="width:100%;border-collapse:collapse;">
    <thead><tr>
      <th style="text-align:center;">#</th>
      <th>Description</th>
      <th>HSN/SAC</th>
      <th>Qty</th>
      <th>Unit</th>
      <th>Rate</th>
      ${hasDiscount ? '<th>Disc</th>' : ''}
      <th>Tax%</th>
      ${!isInterstate ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}
      <th>Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderTotals(invoice, isInterstate) {
  const total = invoice.total || invoice.totalAmount || 0;
  const rows = [
    `<tr><td>Subtotal</td><td style="text-align:right;">${fmt(invoice.subtotal)}</td></tr>`,
    !isInterstate && invoice.cgst > 0 ? `<tr><td>CGST</td><td style="text-align:right;">${fmt(invoice.cgst)}</td></tr>` : '',
    !isInterstate && invoice.sgst > 0 ? `<tr><td>SGST</td><td style="text-align:right;">${fmt(invoice.sgst)}</td></tr>` : '',
    isInterstate && invoice.igst > 0 ? `<tr><td>IGST</td><td style="text-align:right;">${fmt(invoice.igst)}</td></tr>` : '',
    invoice.cess > 0 ? `<tr><td>CESS</td><td style="text-align:right;">${fmt(invoice.cess)}</td></tr>` : '',
    invoice.deliveryCharges > 0 ? `<tr><td>Delivery Charges</td><td style="text-align:right;">${fmt(invoice.deliveryCharges)}</td></tr>` : '',
    invoice.otherCharges > 0 ? `<tr><td>Other Charges</td><td style="text-align:right;">${fmt(invoice.otherCharges)}</td></tr>` : '',
    invoice.roundOff && invoice.roundOff !== 0 ? `<tr><td>Round Off</td><td style="text-align:right;">${fmt(invoice.roundOff)}</td></tr>` : '',
    `<tr style="font-weight:bold;font-size:14px;"><td>Grand Total</td><td style="text-align:right;">${fmt(total)}</td></tr>`,
  ].filter(Boolean).join('');

  return `<table style="width:100%;border-collapse:collapse;">${rows}</table>`;
}

function renderBank(organisation, qrCodeDataUrl) {
  if (!organisation.bankName) return '';
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <p><strong>Bank:</strong> ${organisation.bankName}${organisation.branch ? ', ' + organisation.branch : ''}</p>
      ${organisation.accountHolderName ? `<p><strong>A/c Holder:</strong> ${organisation.accountHolderName}</p>` : ''}
      ${organisation.accountNumber ? `<p><strong>A/c No:</strong> ${organisation.accountNumber}</p>` : ''}
      ${organisation.ifsc ? `<p><strong>IFSC:</strong> ${organisation.ifsc}</p>` : ''}
      ${organisation.upi ? `<p><strong>UPI:</strong> ${organisation.upi}</p>` : ''}
    </div>
    ${qrCodeDataUrl ? `<div style="text-align:center;"><p style="font-size:10px;font-weight:bold;">Scan to Pay</p><img src="${qrCodeDataUrl}" style="width:100px;height:100px;"></div>` : ''}
  </div>`;
}

function renderNotes(invoice) {
  return [
    invoice.notes ? `<p><strong>Notes:</strong> ${invoice.notes}</p>` : '',
    invoice.termsConditions ? `<p><strong>Terms & Conditions:</strong> ${invoice.termsConditions}</p>` : '',
    invoice.paymentInstructions ? `<p><strong>Payment Instructions:</strong> ${invoice.paymentInstructions}</p>` : '',
    invoice.deliveryInstructions ? `<p><strong>Delivery Instructions:</strong> ${invoice.deliveryInstructions}</p>` : '',
    invoice.returnPolicy ? `<p><strong>Return Policy:</strong> ${invoice.returnPolicy}</p>` : '',
    invoice.warrantyInfo ? `<p><strong>Warranty:</strong> ${invoice.warrantyInfo}</p>` : '',
    invoice.declaration ? `<p><strong>Declaration:</strong> ${invoice.declaration}</p>` : '',
  ].filter(Boolean).join('');
}

function renderAddress(customer, address) {
  if (!address) return '<p>Same as billing address</p>';
  return `<p><strong>${customer.name}</strong></p>
    <p>${address.line1 || address.address || ''}</p>
    ${address.line2 ? `<p>${address.line2}</p>` : ''}
    <p>${address.city}, ${address.state} - ${address.pincode}</p>
    ${customer.gstin ? `<p>GSTIN: ${customer.gstin}</p>` : '<p>Unregistered Customer</p>'}
    ${address.state ? `<p>State: ${address.state}${STATE_CODES[address.state] ? ' (' + STATE_CODES[address.state] + ')' : ''}</p>` : ''}
    ${customer.phone ? `<p>Phone: ${customer.phone}</p>` : ''}`;
}

// ─── Token map builder ────────────────────────────────────────────

function buildTokenMap(invoice, organisation, billingAddress, shippingAddress, helpers) {
  const { isInterstate, qrCodeDataUrl, amountToWords } = helpers;
  const total = invoice.total || invoice.totalAmount || 0;

  return {
    // ── Organisation ──
    'organisation.name':        organisation.name || '',
    'organisation.address':     organisation.address || '',
    'organisation.city':        organisation.city || '',
    'organisation.state':       organisation.state || '',
    'organisation.pincode':     organisation.pincode || '',
    'organisation.gstin':       organisation.gstin || '',
    'organisation.pan':         organisation.pan || '',
    'organisation.phone':       organisation.phone || '',
    'organisation.email':       organisation.email || '',
    'organisation.upi':         organisation.upi || '',
    'organisation.bankName':    organisation.bankName || '',
    'organisation.branch':      organisation.branch || '',
    'organisation.accountNumber': organisation.accountNumber || '',
    'organisation.ifsc':        organisation.ifsc || '',
    'organisation.accountHolderName': organisation.accountHolderName || '',
    'organisation.logo':        organisation.logo ? `<img src="${organisation.logo}" alt="Logo" style="max-height:60px;">` : '',

    // ── Invoice meta ──
    'invoice.invoiceNumber':    invoice.invoiceNumber || '',
    'invoice.invoiceDate':      safeDate(invoice.invoiceDate),
    'invoice.dueDate':          safeDate(invoice.dueDate),
    'invoice.invoiceType':      (invoice.invoiceType || 'TAX INVOICE').replace('_', ' '),
    'invoice.copyType':         invoice.invoiceCopyType || '',
    'invoice.placeOfSupply':    invoice.placeOfSupply || billingAddress?.state || '',
    'invoice.reverseCharge':    invoice.reverseCharge ? 'Yes' : 'No',
    'invoice.paymentTerms':     invoice.paymentTerms || 'NET_30',
    'invoice.vehicleNumber':    invoice.vehicleNumber || '',
    'invoice.transportName':    invoice.transportName || '',
    'invoice.lrNumber':         invoice.lrNumber || '',
    'invoice.ewayBillNumber':   invoice.ewayBillNumber || '',
    'invoice.modeOfDelivery':   invoice.modeOfDelivery || '',

    // ── Amounts ──
    'invoice.subtotal':         fmt(invoice.subtotal),
    'invoice.cgst':             fmt(invoice.cgst),
    'invoice.sgst':             fmt(invoice.sgst),
    'invoice.igst':             fmt(invoice.igst),
    'invoice.cess':             fmt(invoice.cess),
    'invoice.deliveryCharges':  fmt(invoice.deliveryCharges),
    'invoice.otherCharges':     fmt(invoice.otherCharges),
    'invoice.roundOff':         fmt(invoice.roundOff),
    'invoice.total':            fmt(total),
    'invoice.amountInWords':    amountToWords(total),

    // ── Customer ──
    'customer.name':            invoice.customer?.name || '',
    'customer.gstin':           invoice.customer?.gstin || '',
    'customer.phone':           invoice.customer?.phone || '',
    'customer.email':           invoice.customer?.email || '',

    // ── Addresses ──
    'billing.line1':            billingAddress?.line1 || billingAddress?.address || '',
    'billing.line2':            billingAddress?.line2 || '',
    'billing.city':             billingAddress?.city || '',
    'billing.state':            billingAddress?.state || '',
    'billing.pincode':          billingAddress?.pincode || '',
    'billing.stateCode':        STATE_CODES[billingAddress?.state] || '',
    'billing.block':            renderAddress(invoice.customer, billingAddress),

    'shipping.line1':           shippingAddress?.line1 || shippingAddress?.address || '',
    'shipping.line2':           shippingAddress?.line2 || '',
    'shipping.city':            shippingAddress?.city || '',
    'shipping.state':           shippingAddress?.state || '',
    'shipping.pincode':         shippingAddress?.pincode || '',
    'shipping.stateCode':       STATE_CODES[shippingAddress?.state] || '',
    'shipping.block':           renderAddress(invoice.customer, shippingAddress || billingAddress),

    // ── Notes ──
    'invoice.notes':            invoice.notes || '',
    'invoice.termsConditions':  invoice.termsConditions || '',
    'invoice.declaration':      invoice.declaration || '',
    'invoice.paymentInstructions': invoice.paymentInstructions || '',
    'invoice.warrantyInfo':     invoice.warrantyInfo || '',

    // ── Block tokens (render full HTML sections) ──
    'items':        renderItemsTable(invoice, isInterstate),
    'totals':       renderTotals(invoice, isInterstate),
    'bank':         renderBank(organisation, qrCodeDataUrl),
    'notes':        renderNotes(invoice),
    'qr':           qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" style="width:120px;height:120px;" alt="UPI QR">` : '',
    'year':         new Date().getFullYear().toString(),
  };
}

// ─── Main render function ─────────────────────────────────────────

function renderHtmlTemplate(htmlContent, invoice, organisation, billingAddress, shippingAddress, helpers) {
  const tokens = buildTokenMap(invoice, organisation, billingAddress, shippingAddress, helpers);

  let output = htmlContent;

  // Replace all {{token}} occurrences
  for (const [key, value] of Object.entries(tokens)) {
    const regex = new RegExp(`\\{\\{${key.replace('.', '\\.')}\\}\\}`, 'g');
    output = output.replace(regex, value ?? '');
  }

  // Remove any remaining unreplaced tokens (optional fields not set)
  output = output.replace(/\{\{[^}]+\}\}/g, '');

  return output;
}

// ─── File-based template loader ───────────────────────────────────

function loadHtmlTemplates() {
  const loaded = {};

  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
    return loaded;
  }

  const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.html'));

  for (const file of files) {
    const id = path.basename(file, '.html').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const filePath = path.join(TEMPLATES_DIR, file);

    try {
      const htmlContent = fs.readFileSync(filePath, 'utf8');

      // Extract name/description from HTML comments at top:
      // <!-- name: My Template -->
      // <!-- description: A clean modern layout -->
      const nameMatch = htmlContent.match(/<!--\s*name:\s*(.+?)\s*-->/i);
      const descMatch = htmlContent.match(/<!--\s*description:\s*(.+?)\s*-->/i);

      loaded[id] = {
        name: nameMatch ? nameMatch[1] : id.charAt(0).toUpperCase() + id.slice(1),
        description: descMatch ? descMatch[1] : 'Custom HTML template',
        isHtmlFile: true,
        render: (invoice, organisation, billingAddress, shippingAddress, helpers) => {
          // Re-read file each time in development for hot-reload
          const content = process.env.NODE_ENV === 'production'
            ? htmlContent
            : fs.readFileSync(filePath, 'utf8');
          return renderHtmlTemplate(content, invoice, organisation, billingAddress, shippingAddress, helpers);
        },
      };

      console.log(`[Templates] Loaded HTML template: "${id}" from ${file}`);
    } catch (err) {
      console.error(`[Templates] Failed to load ${file}:`, err.message);
    }
  }

  return loaded;
}

module.exports = { loadHtmlTemplates, renderHtmlTemplate };
