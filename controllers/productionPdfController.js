const prisma = require('../config/prisma');
const { toWords } = require('number-to-words');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
const queuedPdfService = require('../services/queuedPdfService');

const STATE_CODES = {
  'Andhra Pradesh': '37', 'Arunachal Pradesh': '12', 'Assam': '18', 'Bihar': '10',
  'Chhattisgarh': '22', 'Goa': '30', 'Gujarat': '24', 'Haryana': '06', 'Himachal Pradesh': '02',
  'Jharkhand': '20', 'Karnataka': '29', 'Kerala': '32', 'Madhya Pradesh': '23', 'Maharashtra': '27',
  'Manipur': '14', 'Meghalaya': '17', 'Mizoram': '15', 'Nagaland': '13', 'Odisha': '21',
  'Punjab': '03', 'Rajasthan': '08', 'Sikkim': '11', 'Tamil Nadu': '33', 'Telangana': '36',
  'Tripura': '16', 'Uttar Pradesh': '09', 'Uttarakhand': '05', 'West Bengal': '19',
  'Andaman and Nicobar Islands': '35', 'Chandigarh': '04', 'Dadra and Nagar Haveli and Daman and Diu': '26',
  'Delhi': '07', 'Jammu and Kashmir': '01', 'Ladakh': '02', 'Lakshadweep': '31', 'Puducherry': '34'
};

const amountToWords = (amount) => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = toWords(rupees).replace(/,/g, '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  words += ' Rupees';
  if (paise > 0) words += ` and ${toWords(paise).replace(/,/g, '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Paise`;
  return words + ' Only';
};

const generateInvoiceHTML = async (invoice, organisation, billingAddress, shippingAddress) => {
  const orgState = organisation.state || '';
  const billState = billingAddress?.state || '';
  const isInterstate = orgState && billState && orgState !== billState;
  
  // Generate UPI QR Code
  let qrCodeDataUrl = '';
  if (organisation.upi) {
    const upiString = `upi://pay?pa=${organisation.upi}&pn=${encodeURIComponent(organisation.name)}&am=${invoice.total ? invoice.total.toFixed(2) : invoice.totalAmount}&cu=INR&tn=${encodeURIComponent('Invoice ' + invoice.invoiceNumber)}`;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(upiString, { width: 150, margin: 1 });
    } catch (err) {
      console.error('QR Code generation error:', err);
    }
  }

  const total = invoice.total || invoice.totalAmount || 0;
  const subtotal = invoice.subtotal || 0;
  const cgst = invoice.cgst || 0;
  const sgst = invoice.sgst || 0;
  const igst = invoice.igst || 0;
  const cess = invoice.cess || 0;

  const itemRows = invoice.items.map((item, idx) => {
    const productName = (item.product && item.product.name) || item.description || '';
    const subDesc = (item.product && item.product.name && item.description && item.description !== item.product.name) ? item.description : '';
    const hsnSac = item.hsnSac || (item.product && (item.product.hsnCode || item.product.sacCode)) || '-';
    return `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td>${productName}${subDesc ? `<br><span style="font-size:8pt;color:#555;">${subDesc}</span>` : ''}</td>
      <td style="text-align: center;">${hsnSac}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: center;">${item.unit}</td>
      <td style="text-align: right;">₹${Number(item.rate).toFixed(2)}</td>
      ${invoice.items.some(i => i.discount > 0) ? `<td style="text-align: right;">₹${Number(item.discount || 0).toFixed(2)}</td>` : ''}
      <td style="text-align: center;">${item.taxRate}%</td>
      ${!isInterstate ? `
        <td style="text-align: right;">₹${Number(item.cgst || 0).toFixed(2)}</td>
        <td style="text-align: right;">₹${Number(item.sgst || 0).toFixed(2)}</td>
      ` : `<td style="text-align: right;">₹${Number(item.igst || 0).toFixed(2)}</td>`}
      <td style="text-align: right; font-weight: 600;">₹${Number(item.amount).toFixed(2)}</td>
    </tr>
  `}).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; }
        .invoice { width: 210mm; min-height: 297mm; padding: 10mm; margin: 0 auto; background: #fff; }
        .header { text-align: center; border: 2px solid #000; padding: 8px; margin-bottom: 2px; }
        .header h1 { font-size: 18pt; margin-bottom: 4px; }
        .header p { font-size: 9pt; margin: 2px 0; }
        .tax-invoice { text-align: center; background: #000; color: #fff; padding: 4px; font-weight: bold; font-size: 11pt; }
        .copy-type { text-align: right; font-size: 9pt; font-style: italic; margin: 2px 0; }
        .meta-section { display: table; width: 100%; border: 1px solid #000; border-bottom: none; }
        .meta-row { display: table-row; }
        .meta-cell { display: table-cell; border-bottom: 1px solid #000; border-right: 1px solid #000; padding: 4px 6px; font-size: 9pt; }
        .meta-cell:last-child { border-right: none; }
        .meta-label { font-weight: 600; width: 30%; }
        .party-section { display: table; width: 100%; border: 1px solid #000; border-top: none; border-bottom: none; }
        .party-col { display: table-cell; width: 50%; border-right: 1px solid #000; padding: 6px; vertical-align: top; }
        .party-col:last-child { border-right: none; }
        .party-title { font-weight: bold; font-size: 10pt; margin-bottom: 4px; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
        .party-detail { font-size: 9pt; margin: 2px 0; }
        table.items { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 0; }
        table.items th { background: #f0f0f0; border: 1px solid #000; padding: 5px 4px; font-size: 9pt; text-align: center; font-weight: 600; }
        table.items td { border: 1px solid #000; padding: 4px; font-size: 9pt; }
        .summary-section { display: table; width: 100%; border: 1px solid #000; border-top: none; }
        .summary-row { display: table-row; }
        .summary-left { display: table-cell; width: 60%; border-right: 1px solid #000; padding: 6px; vertical-align: top; }
        .summary-right { display: table-cell; width: 40%; padding: 0; }
        .summary-line { display: flex; justify-content: space-between; border-bottom: 1px solid #000; padding: 4px 6px; font-size: 9pt; }
        .summary-line:last-child { border-bottom: none; }
        .summary-line.total { background: #f0f0f0; font-weight: bold; font-size: 10pt; }
        .amount-words { font-weight: 600; font-size: 9pt; margin-bottom: 4px; }
        .bank-section { border: 1px solid #000; border-top: none; padding: 6px; }
        .bank-title { font-weight: bold; font-size: 10pt; margin-bottom: 4px; }
        .bank-detail { font-size: 9pt; margin: 2px 0; }
        .footer-section { border: 1px solid #000; border-top: none; padding: 6px; }
        .footer-title { font-weight: bold; font-size: 9pt; margin-bottom: 3px; }
        .footer-text { font-size: 8pt; margin: 2px 0; }
        .signature { text-align: right; margin-top: 20px; font-size: 9pt; }
        .computer-generated { text-align: center; font-size: 8pt; font-style: italic; margin-top: 10px; color: #666; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .invoice { margin: 0; padding: 10mm; }
        }
      </style>
    </head>
    <body>
      <div class="invoice">
        <div class="header">
          ${organisation.logo ? `<img src="${organisation.logo}" style="max-height: 40px; margin-bottom: 4px;" />` : ''}
          <h1>${organisation.name}</h1>
          <p>${organisation.address}${organisation.city ? ', ' + organisation.city : ''}${organisation.state ? ', ' + organisation.state : ''}${organisation.pincode ? ' - ' + organisation.pincode : ''}</p>
          ${organisation.gstin ? `<p><strong>GSTIN:</strong> ${organisation.gstin}</p>` : ''}
          ${organisation.pan ? `<p><strong>PAN:</strong> ${organisation.pan}</p>` : ''}
          <p><strong>Phone:</strong> ${organisation.phone} | <strong>Email:</strong> ${organisation.email}</p>
        </div>
        
        <div class="tax-invoice">${invoice.invoiceType?.replace('_', ' ') || 'TAX INVOICE'}</div>
        <div class="copy-type">${invoice.invoiceCopyType || ''}</div>
        
        <div class="meta-section">
          <div class="meta-row">
            <div class="meta-cell meta-label">Invoice No:</div>
            <div class="meta-cell">${invoice.invoiceNumber}</div>
            <div class="meta-cell meta-label">Invoice Date:</div>
            <div class="meta-cell">${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Due Date:</div>
            <div class="meta-cell">${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '-'}</div>
            <div class="meta-cell meta-label">Place of Supply:</div>
            <div class="meta-cell">${invoice.placeOfSupply || billState} ${billState && STATE_CODES[billState] ? '(' + STATE_CODES[billState] + ')' : ''}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Reverse Charge:</div>
            <div class="meta-cell">${invoice.reverseCharge ? 'Yes' : 'No'}</div>
            <div class="meta-cell meta-label">Payment Terms:</div>
            <div class="meta-cell">${invoice.paymentTerms || 'NET_30'}</div>
          </div>
          ${invoice.vehicleNumber || invoice.ewayBillNumber ? `
          <div class="meta-row">
            ${invoice.vehicleNumber ? `<div class="meta-cell meta-label">Vehicle No:</div><div class="meta-cell">${invoice.vehicleNumber}</div>` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
            ${invoice.ewayBillNumber ? `<div class="meta-cell meta-label">E-Way Bill:</div><div class="meta-cell">${invoice.ewayBillNumber}</div>` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
          </div>` : ''}
          ${invoice.transportName || invoice.lrNumber ? `
          <div class="meta-row">
            ${invoice.transportName ? `<div class="meta-cell meta-label">Transport:</div><div class="meta-cell">${invoice.transportName}</div>` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
            ${invoice.lrNumber ? `<div class="meta-cell meta-label">LR No:</div><div class="meta-cell">${invoice.lrNumber}</div>` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
          </div>` : ''}
          ${invoice.modeOfDelivery || invoice.placeOfDelivery ? `
          <div class="meta-row">
            ${invoice.modeOfDelivery ? `<div class="meta-cell meta-label">Mode of Delivery:</div><div class="meta-cell">${invoice.modeOfDelivery}</div>` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
            ${invoice.placeOfDelivery ? `<div class="meta-cell meta-label">Place of Delivery:</div><div class="meta-cell">${invoice.placeOfDelivery}</div>` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
          </div>` : ''}
        </div>
        
        <div class="party-section">
          <div class="party-col">
            <div class="party-title">Bill To</div>
            <div class="party-detail"><strong>${invoice.customer.name}</strong></div>
            ${billingAddress ? `
              <div class="party-detail">${billingAddress.line1 || billingAddress.address || ''}</div>
              ${billingAddress.line2 ? `<div class="party-detail">${billingAddress.line2}</div>` : ''}
              <div class="party-detail">${billingAddress.city}, ${billingAddress.state} - ${billingAddress.pincode}</div>
            ` : ''}
            ${invoice.customer.gstin ? `<div class="party-detail"><strong>GSTIN:</strong> ${invoice.customer.gstin}</div>` : '<div class="party-detail"><strong>Unregistered Customer</strong></div>'}
            ${billingAddress?.state ? `<div class="party-detail"><strong>State:</strong> ${billingAddress.state} ${STATE_CODES[billingAddress.state] ? '(' + STATE_CODES[billingAddress.state] + ')' : ''}</div>` : ''}
            ${invoice.customer.phone ? `<div class="party-detail"><strong>Phone:</strong> ${invoice.customer.phone}</div>` : ''}
          </div>
          <div class="party-col">
            <div class="party-title">Ship To</div>
            ${shippingAddress ? `
              <div class="party-detail"><strong>${invoice.customer.name}</strong></div>
              <div class="party-detail">${shippingAddress.line1 || shippingAddress.address || ''}</div>
              ${shippingAddress.line2 ? `<div class="party-detail">${shippingAddress.line2}</div>` : ''}
              <div class="party-detail">${shippingAddress.city}, ${shippingAddress.state} - ${shippingAddress.pincode}</div>
              ${shippingAddress.state ? `<div class="party-detail"><strong>State:</strong> ${shippingAddress.state} ${STATE_CODES[shippingAddress.state] ? '(' + STATE_CODES[shippingAddress.state] + ')' : ''}</div>` : ''}
            ` : '<div class="party-detail">Same as Billing Address</div>'}
          </div>
        </div>
        
        <table class="items">
          <thead>
            <tr>
              <th style="width: 30px;">Sr</th>
              <th>Description</th>
              <th style="width: 70px;">HSN/SAC</th>
              <th style="width: 50px;">Qty</th>
              <th style="width: 50px;">Unit</th>
              <th style="width: 70px;">Rate</th>
              ${invoice.items.some(i => i.discount > 0) ? '<th style="width: 60px;">Disc</th>' : ''}
              <th style="width: 50px;">Tax%</th>
              ${!isInterstate ? `<th style="width: 60px;">CGST</th><th style="width: 60px;">SGST</th>` : '<th style="width: 60px;">IGST</th>'}
              <th style="width: 80px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
        
        <div class="summary-section">
          <div class="summary-row">
            <div class="summary-left">
              <div class="amount-words">Taxable Amount in Words:</div>
              <div style="font-size: 9pt; margin-bottom: 8px;">${amountToWords(subtotal)}</div>
              <div class="amount-words">Total Amount in Words:</div>
              <div style="font-size: 9pt;">${amountToWords(total)}</div>
            </div>
            <div class="summary-right">
              <div class="summary-line"><span>Subtotal:</span><span>₹${subtotal.toFixed(2)}</span></div>
              ${!isInterstate && cgst > 0 ? `<div class="summary-line"><span>CGST:</span><span>₹${cgst.toFixed(2)}</span></div>` : ''}
              ${!isInterstate && sgst > 0 ? `<div class="summary-line"><span>SGST:</span><span>₹${sgst.toFixed(2)}</span></div>` : ''}
              ${isInterstate && igst > 0 ? `<div class="summary-line"><span>IGST:</span><span>₹${igst.toFixed(2)}</span></div>` : ''}
              ${cess > 0 ? `<div class="summary-line"><span>CESS:</span><span>₹${cess.toFixed(2)}</span></div>` : ''}
              ${invoice.deliveryCharges > 0 ? `<div class="summary-line"><span>Delivery Charges:</span><span>₹${Number(invoice.deliveryCharges).toFixed(2)}</span></div>` : ''}
              ${invoice.otherCharges > 0 ? `<div class="summary-line"><span>Other Charges:</span><span>₹${Number(invoice.otherCharges).toFixed(2)}</span></div>` : ''}
              ${invoice.roundOff && invoice.roundOff !== 0 ? `<div class="summary-line"><span>Round Off:</span><span>₹${Number(invoice.roundOff).toFixed(2)}</span></div>` : ''}
              <div class="summary-line total"><span>Grand Total:</span><span>₹${total.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
        
        ${organisation.bankName ? `
        <div class="bank-section">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
              <div class="bank-title">Bank Details</div>
              <div class="bank-detail"><strong>Bank:</strong> ${organisation.bankName}${organisation.branch ? ', ' + organisation.branch : ''}</div>
              ${organisation.accountHolderName ? `<div class="bank-detail"><strong>A/c Holder:</strong> ${organisation.accountHolderName}</div>` : ''}
              ${organisation.accountNumber ? `<div class="bank-detail"><strong>A/c No:</strong> ${organisation.accountNumber}</div>` : ''}
              ${organisation.ifsc ? `<div class="bank-detail"><strong>IFSC:</strong> ${organisation.ifsc}</div>` : ''}
              ${organisation.upi ? `<div class="bank-detail"><strong>UPI:</strong> ${organisation.upi}</div>` : ''}
            </div>
            ${qrCodeDataUrl ? `
            <div style="text-align: center; padding-left: 10px;">
              <div style="font-weight: bold; font-size: 9pt; margin-bottom: 4px;">Scan to Pay</div>
              <img src="${qrCodeDataUrl}" style="width: 120px; height: 120px; border: 1px solid #ddd;" />
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}
        
        <div class="footer-section">
          ${invoice.notes ? `<div class="footer-title">Notes:</div><div class="footer-text">${invoice.notes}</div>` : ''}
          ${invoice.termsConditions ? `<div class="footer-title" style="margin-top: 6px;">Terms & Conditions:</div><div class="footer-text">${invoice.termsConditions}</div>` : ''}
          ${invoice.paymentInstructions ? `<div class="footer-title" style="margin-top: 6px;">Payment Instructions:</div><div class="footer-text">${invoice.paymentInstructions}</div>` : ''}
          ${invoice.deliveryInstructions ? `<div class="footer-title" style="margin-top: 6px;">Delivery Instructions:</div><div class="footer-text">${invoice.deliveryInstructions}</div>` : ''}
          ${invoice.returnPolicy ? `<div class="footer-title" style="margin-top: 6px;">Return Policy:</div><div class="footer-text">${invoice.returnPolicy}</div>` : ''}
          ${invoice.lateFeePolicy ? `<div class="footer-title" style="margin-top: 6px;">Late Fee Policy:</div><div class="footer-text">${invoice.lateFeePolicy}</div>` : ''}
          ${invoice.warrantyInfo ? `<div class="footer-title" style="margin-top: 6px;">Warranty:</div><div class="footer-text">${invoice.warrantyInfo}</div>` : ''}
          ${invoice.supportContact ? `<div class="footer-title" style="margin-top: 6px;">Support Contact:</div><div class="footer-text">${invoice.supportContact}</div>` : ''}
          ${invoice.declaration ? `<div class="footer-title" style="margin-top: 6px;">Declaration:</div><div class="footer-text">${invoice.declaration}</div>` : ''}
          <div class="signature">
            <div>For ${organisation.name}</div>
            <div style="margin-top: 30px; border-top: 1px solid #000; display: inline-block; padding-top: 2px;">Authorized Signatory</div>
          </div>
        </div>
        
        <div class="computer-generated">This is a computer generated invoice and does not require a physical signature</div>
      </div>
    </body>
    </html>`;
};

exports.getInvoicePDF = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    console.log(`[Invoice PDF] 📄 Request ${requestId} - Generating PDF for invoice ${req.params.id}`);
    
    const { id } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found' });
    }

    const organisationId = organisations[0].id;

    const invoice = await prisma.invoice.findFirst({
      where: { 
        id, 
        organisationId 
      },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!invoice) {
      console.log(`[Invoice PDF] ❌ Request ${requestId} - Invoice not found: ${id}`);
      return res.status(404).json({ error: 'Invoice not found' });
    }

    console.log(`[Invoice PDF] 📋 Request ${requestId} - Found invoice ${invoice.invoiceNumber} with ${invoice.items.length} items`);

    // Get products separately and filter out null products
    const validItems = [];
    for (const item of invoice.items) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });
        
        if (product) {
          validItems.push({ ...item, product });
        } else {
          console.warn(`[Invoice PDF] ⚠️  Request ${requestId} - Item ${item.id} references deleted product ${item.productId}, skipping`);
        }
      } catch (error) {
        console.warn(`[Invoice PDF] ⚠️  Request ${requestId} - Error fetching product for item ${item.id}:`, error.message);
      }
    }

    if (validItems.length !== invoice.items.length) {
      console.warn(`[Invoice PDF] ⚠️  Request ${requestId} - Filtered ${invoice.items.length - validItems.length} items with missing products`);
    }

    // Update invoice object with valid items only
    invoice.items = validItems;

    // Recalculate totals if items were filtered out
    if (validItems.length === 0) {
      console.warn(`[Invoice PDF] ⚠️  Request ${requestId} - No valid items found, setting totals to zero`);
      invoice.subtotal = 0;
      invoice.taxAmount = 0;
      invoice.totalAmount = 0;
      invoice.discount = invoice.discount || 0;
      invoice.shippingCharges = invoice.shippingCharges || 0;
    } else {
      // Ensure all required fields have default values
      invoice.subtotal = invoice.subtotal || 0;
      invoice.taxAmount = invoice.taxAmount || 0;
      invoice.totalAmount = invoice.totalAmount || 0;
      invoice.discount = invoice.discount || 0;
      invoice.shippingCharges = invoice.shippingCharges || 0;
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: organisationId }
    });

    if (!organisation) {
      console.log(`[Invoice PDF] ❌ Request ${requestId} - Organisation not found: ${organisationId}`);
      return res.status(404).json({ error: 'Organisation not found' });
    }

    // Fetch addresses by ID (same as old pdfController)
    let billingAddress = null;
    let shippingAddress = null;
    if (invoice.billingAddressId) {
      billingAddress = await prisma.address.findUnique({ where: { id: invoice.billingAddressId } });
    }
    if (invoice.shippingAddressId) {
      shippingAddress = await prisma.address.findUnique({ where: { id: invoice.shippingAddressId } });
    }

    console.log(`[Invoice PDF] 🏗️  Request ${requestId} - Generating 4-copy PDF for invoice ${invoice.invoiceNumber}`);

    // Generate 4 copies and merge (same as old pdfController)
    const copies = ['ORIGINAL FOR BUYER', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER', 'QUADRUPLICATE FOR RECEIVER'];
    const pdfBuffers = [];

    for (const copyType of copies) {
      const modifiedInvoice = { ...invoice, invoiceCopyType: copyType };
      const htmlContent = await generateInvoiceHTML(modifiedInvoice, organisation, billingAddress, shippingAddress);
      const pdfBuffer = await queuedPdfService.generatePdf(htmlContent, {
        paperWidth: '8.27', paperHeight: '11.7',
        marginTop: '0.39', marginBottom: '0.39',
        marginLeft: '0.39', marginRight: '0.39',
        printBackground: 'true'
      });
      pdfBuffers.push(pdfBuffer);
    }

    const mergedPdf = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      const pdf = await PDFDocument.load(buf);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
    }
    const mergedBytes = await mergedPdf.save();

    const duration = Date.now() - startTime;
    console.log(`[Invoice PDF] ✅ Request ${requestId} - PDF generated in ${duration}ms`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(mergedBytes));

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Invoice PDF] 💥 Request ${requestId} - Failed after ${duration}ms:`, error.message);
    console.error(`[Invoice PDF] Stack trace:`, error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
  }
};

const generateSignature = (invoiceId) => {
  return crypto.createHash('sha256').update(invoiceId + process.env.JWT_SECRET).digest('hex').substring(0, 16);
};

exports.getInvoicePDFPublic = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);
  
  try {
    console.log(`[Public PDF] 📄 Request ${requestId} - Generating public PDF for invoice ${req.params.id}`);
    
    const { id, signature } = req.params;
    
    const validSignature = generateSignature(id);
    if (signature !== validSignature) {
      console.log(`[Public PDF] ❌ Request ${requestId} - Invalid signature for invoice ${id}`);
      return res.status(403).json({ error: 'Invalid signature' });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: { product: true }
        }
      }
    });

    if (!invoice) {
      console.log(`[Public PDF] ❌ Request ${requestId} - Invoice not found: ${id}`);
      return res.status(404).json({ error: 'Invoice not found' });
    }

    console.log(`[Public PDF] 📋 Request ${requestId} - Found invoice ${invoice.invoiceNumber} with ${invoice.items.length} items`);

    // Get products separately and filter out null products
    const validItems = [];
    for (const item of invoice.items) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });
        
        if (product) {
          validItems.push({ ...item, product });
        } else {
          console.warn(`[Public PDF] ⚠️  Request ${requestId} - Item ${item.id} references deleted product ${item.productId}, skipping`);
        }
      } catch (error) {
        console.warn(`[Public PDF] ⚠️  Request ${requestId} - Error fetching product for item ${item.id}:`, error.message);
      }
    }

    if (validItems.length !== invoice.items.length) {
      console.warn(`[Public PDF] ⚠️  Request ${requestId} - Filtered ${invoice.items.length - validItems.length} items with missing products`);
    }

    // Update invoice object with valid items only
    invoice.items = validItems;

    // Recalculate totals if items were filtered out
    if (validItems.length === 0) {
      console.warn(`[Public PDF] ⚠️  Request ${requestId} - No valid items found, setting totals to zero`);
      invoice.subtotal = 0;
      invoice.taxAmount = 0;
      invoice.totalAmount = 0;
      invoice.discount = invoice.discount || 0;
      invoice.shippingCharges = invoice.shippingCharges || 0;
    } else {
      // Ensure all required fields have default values
      invoice.subtotal = invoice.subtotal || 0;
      invoice.taxAmount = invoice.taxAmount || 0;
      invoice.totalAmount = invoice.totalAmount || 0;
      invoice.discount = invoice.discount || 0;
      invoice.shippingCharges = invoice.shippingCharges || 0;
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: invoice.organisationId }
    });

    if (!organisation) {
      console.log(`[Public PDF] ❌ Request ${requestId} - Organisation not found: ${invoice.organisationId}`);
      return res.status(404).json({ error: 'Organisation not found' });
    }

    // Fetch addresses by ID
    let billingAddress = null;
    let shippingAddress = null;
    if (invoice.billingAddressId) {
      billingAddress = await prisma.address.findUnique({ where: { id: invoice.billingAddressId } });
    }
    if (invoice.shippingAddressId) {
      shippingAddress = await prisma.address.findUnique({ where: { id: invoice.shippingAddressId } });
    }

    console.log(`[Public PDF] 🏗️  Request ${requestId} - Generating 4-copy PDF for invoice ${invoice.invoiceNumber}`);

    const copies = ['ORIGINAL FOR BUYER', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER', 'QUADRUPLICATE FOR RECEIVER'];
    const pdfBuffers = [];

    for (const copyType of copies) {
      const modifiedInvoice = { ...invoice, invoiceCopyType: copyType };
      const htmlContent = await generateInvoiceHTML(modifiedInvoice, organisation, billingAddress, shippingAddress);
      const pdfBuffer = await queuedPdfService.generatePdf(htmlContent, {
        paperWidth: '8.27', paperHeight: '11.7',
        marginTop: '0.39', marginBottom: '0.39',
        marginLeft: '0.39', marginRight: '0.39',
        printBackground: 'true'
      });
      pdfBuffers.push(pdfBuffer);
    }

    const mergedPdf = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      const pdf = await PDFDocument.load(buf);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
    }
    const mergedBytes = await mergedPdf.save();

    const duration = Date.now() - startTime;
    console.log(`[Public PDF] ✅ Request ${requestId} - PDF generated in ${duration}ms`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(mergedBytes));

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Public PDF] 💥 Request ${requestId} - Failed after ${duration}ms:`, error.message);
    console.error(`[Public PDF] Stack trace:`, error.stack);
    
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
  }
};

// Health check and queue management endpoints
exports.pdfServiceHealth = async (req, res) => {
  try {
    const isHealthy = await queuedPdfService.healthCheck();
    const stats = queuedPdfService.getQueueStats();
    
    res.json({ 
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'gotenberg-queued',
      timestamp: new Date().toISOString(),
      queue: stats
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

exports.pdfQueueStats = async (req, res) => {
  try {
    const stats = queuedPdfService.getQueueStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.clearPdfQueue = async (req, res) => {
  try {
    const clearedJobs = queuedPdfService.clearQueue();
    res.json({ 
      message: `Cleared ${clearedJobs} jobs from queue`,
      clearedJobs 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};