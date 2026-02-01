const puppeteer = require('puppeteer');

const prisma = require('../config/prisma');
const { toWords } = require('number-to-words');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');

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
    const upiString = `upi://pay?pa=${organisation.upi}&pn=${encodeURIComponent(organisation.name)}&am=${invoice.total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Invoice ' + invoice.invoiceNumber)}`;
    console.log('Generating QR for UPI:', upiString);
    try {
      qrCodeDataUrl = await QRCode.toDataURL(upiString, { width: 150, margin: 1 });
      console.log('QR Code generated successfully, length:', qrCodeDataUrl.length);
    } catch (err) {
      console.error('QR Code generation error:', err);
    }
  } else {
    console.log('No UPI ID found for organisation:', organisation.name);
  }
  
  const itemRows = invoice.items.map((item, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td>${item.description}</td>
      <td style="text-align: center;">${item.hsnSac || '-'}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: center;">${item.unit}</td>
      <td style="text-align: right;">₹${item.rate.toFixed(2)}</td>
      ${item.discount > 0 ? `<td style="text-align: right;">₹${item.discount.toFixed(2)}</td>` : ''}
      <td style="text-align: center;">${item.taxRate}%</td>
      ${!isInterstate ? `
        <td style="text-align: right;">₹${item.cgst.toFixed(2)}</td>
        <td style="text-align: right;">₹${item.sgst.toFixed(2)}</td>
      ` : `<td style="text-align: right;">₹${item.igst.toFixed(2)}</td>`}
      <td style="text-align: right; font-weight: 600;">₹${item.amount.toFixed(2)}</td>
    </tr>
  `).join('');

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
        
        <div class="tax-invoice">TAX INVOICE</div>
        <div class="copy-type">${invoice.invoiceCopyType}</div>
        
        <div class="meta-section">
          <div class="meta-row">
            <div class="meta-cell meta-label">Invoice No:</div>
            <div class="meta-cell">${invoice.invoiceNumber}</div>
            <div class="meta-cell meta-label">Invoice Date:</div>
            <div class="meta-cell">${new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Due Date:</div>
            <div class="meta-cell">${new Date(invoice.dueDate).toLocaleDateString('en-IN')}</div>
            <div class="meta-cell meta-label">Place of Supply:</div>
            <div class="meta-cell">${invoice.placeOfSupply || billState} ${billState && STATE_CODES[billState] ? '(' + STATE_CODES[billState] + ')' : ''}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Reverse Charge:</div>
            <div class="meta-cell">${invoice.reverseCharge ? 'Yes' : 'No'}</div>
            <div class="meta-cell meta-label">Payment Terms:</div>
            <div class="meta-cell">${invoice.paymentTerms || 'NET_30'}</div>
          </div>
          ${invoice.vehicleNumber || invoice.transportName || invoice.ewayBillNumber ? `
          <div class="meta-row">
            ${invoice.vehicleNumber ? `
              <div class="meta-cell meta-label">Vehicle No:</div>
              <div class="meta-cell">${invoice.vehicleNumber}</div>
            ` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
            ${invoice.ewayBillNumber ? `
              <div class="meta-cell meta-label">E-Way Bill:</div>
              <div class="meta-cell">${invoice.ewayBillNumber}</div>
            ` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
          </div>
          ` : ''}
          ${invoice.transportName || invoice.lrNumber ? `
          <div class="meta-row">
            ${invoice.transportName ? `
              <div class="meta-cell meta-label">Transport:</div>
              <div class="meta-cell">${invoice.transportName}</div>
            ` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
            ${invoice.lrNumber ? `
              <div class="meta-cell meta-label">LR No:</div>
              <div class="meta-cell">${invoice.lrNumber}</div>
            ` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
          </div>
          ` : ''}
          ${invoice.modeOfDelivery || invoice.placeOfDelivery ? `
          <div class="meta-row">
            ${invoice.modeOfDelivery ? `
              <div class="meta-cell meta-label">Mode of Delivery:</div>
              <div class="meta-cell">${invoice.modeOfDelivery}</div>
            ` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
            ${invoice.placeOfDelivery ? `
              <div class="meta-cell meta-label">Place of Delivery:</div>
              <div class="meta-cell">${invoice.placeOfDelivery}</div>
            ` : '<div class="meta-cell meta-label"></div><div class="meta-cell"></div>'}
          </div>
          ` : ''}
        </div>
        
        <div class="party-section">
          <div class="party-col">
            <div class="party-title">Bill To</div>
            <div class="party-detail"><strong>${invoice.customer.name}</strong></div>
            ${billingAddress ? `
              <div class="party-detail">${billingAddress.line1}</div>
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
              <div class="party-detail">${shippingAddress.line1}</div>
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
              ${!isInterstate ? `
                <th style="width: 60px;">CGST</th>
                <th style="width: 60px;">SGST</th>
              ` : '<th style="width: 60px;">IGST</th>'}
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
              <div style="font-size: 9pt; margin-bottom: 8px;">${amountToWords(invoice.subtotal)}</div>
              <div class="amount-words">Total Amount in Words:</div>
              <div style="font-size: 9pt;">${invoice.amountInWords || amountToWords(invoice.total)}</div>
            </div>
            <div class="summary-right">
              <div class="summary-line"><span>Subtotal:</span><span>₹${invoice.subtotal.toFixed(2)}</span></div>
              ${!isInterstate && invoice.cgst > 0 ? `<div class="summary-line"><span>CGST:</span><span>₹${invoice.cgst.toFixed(2)}</span></div>` : ''}
              ${!isInterstate && invoice.sgst > 0 ? `<div class="summary-line"><span>SGST:</span><span>₹${invoice.sgst.toFixed(2)}</span></div>` : ''}
              ${isInterstate && invoice.igst > 0 ? `<div class="summary-line"><span>IGST:</span><span>₹${invoice.igst.toFixed(2)}</span></div>` : ''}
              ${invoice.cess > 0 ? `<div class="summary-line"><span>CESS:</span><span>₹${invoice.cess.toFixed(2)}</span></div>` : ''}
              ${invoice.deliveryCharges > 0 ? `<div class="summary-line"><span>Delivery Charges:</span><span>₹${invoice.deliveryCharges.toFixed(2)}</span></div>` : ''}
              ${invoice.packingCharges > 0 ? `<div class="summary-line"><span>Packing Charges:</span><span>₹${invoice.packingCharges.toFixed(2)}</span></div>` : ''}
              ${invoice.otherCharges > 0 ? `<div class="summary-line"><span>Other Charges:</span><span>₹${invoice.otherCharges.toFixed(2)}</span></div>` : ''}
              ${invoice.roundOff !== 0 ? `<div class="summary-line"><span>Round Off:</span><span>₹${invoice.roundOff.toFixed(2)}</span></div>` : ''}
              <div class="summary-line total"><span>Grand Total:</span><span>₹${invoice.total.toFixed(2)}</span></div>
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
    </html>
  `;
};

exports.generateInvoicePDF = async (req, res) => {
  let browser;
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        items: { include: { product: true } }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: invoice.organisationId }
    });

    if (!organisation) {
      return res.status(404).json({ error: 'Organisation not found' });
    }

    let billingAddress = null;
    let shippingAddress = null;

    if (invoice.billingAddressId) {
      billingAddress = await prisma.address.findUnique({
        where: { id: invoice.billingAddressId }
      });
    }

    if (invoice.shippingAddressId) {
      shippingAddress = await prisma.address.findUnique({
        where: { id: invoice.shippingAddressId }
      });
    }

    browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Generate all 3 copies
    const copies = ['ORIGINAL FOR BUYER', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER'];
    const pdfBuffers = [];

    for (const copyType of copies) {
      const modifiedInvoice = { ...invoice, invoiceCopyType: copyType };
      const html = await generateInvoiceHTML(modifiedInvoice, organisation, billingAddress, shippingAddress);
      
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
      });
      
      pdfBuffers.push(pdf);
    }
    
    await browser.close();
    browser = null;

    // Merge all PDFs
    const mergedPdf = await PDFDocument.create();
    
    for (const pdfBuffer of pdfBuffers) {
      const pdf = await PDFDocument.load(pdfBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
    
    const mergedPdfBytes = await mergedPdf.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', mergedPdfBytes.length);
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${invoice.invoiceNumber}.pdf"`);
    res.end(Buffer.from(mergedPdfBytes), 'binary');
  } catch (error) {
    if (browser) await browser.close();
    console.error('PDF Generation Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
  }
};
