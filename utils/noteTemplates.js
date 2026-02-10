const { toWords } = require('number-to-words');

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

const generateCreditNoteHTML = (creditNote, organisation) => {
  const isInterstate = creditNote.igst > 0;
  const itemRows = creditNote.items.map((item, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td>${item.description}</td>
      <td style="text-align: center;">${item.hsnSac || '-'}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: center;">${item.unit}</td>
      <td style="text-align: right;">₹${item.rate.toFixed(2)}</td>
      <td style="text-align: center;">${item.taxRate}%</td>
      ${!isInterstate ? `
        <td style="text-align: right;">₹${item.cgst.toFixed(2)}</td>
        <td style="text-align: right;">₹${item.sgst.toFixed(2)}</td>
      ` : `<td style="text-align: right;">₹${item.igst.toFixed(2)}</td>`}
      <td style="text-align: right; font-weight: 600;">₹${item.lineTotal.toFixed(2)}</td>
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
        .tax-invoice { text-align: center; background: #d32f2f; color: #fff; padding: 4px; font-weight: bold; font-size: 11pt; }
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
        
        <div class="tax-invoice">CREDIT NOTE</div>
        
        <div class="meta-section">
          <div class="meta-row">
            <div class="meta-cell meta-label">Credit Note No:</div>
            <div class="meta-cell">${creditNote.noteNumber}</div>
            <div class="meta-cell meta-label">Date:</div>
            <div class="meta-cell">${new Date(creditNote.issueDate).toLocaleDateString('en-IN')}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Original Invoice:</div>
            <div class="meta-cell">${creditNote.invoice.invoiceNumber}</div>
            <div class="meta-cell meta-label">Invoice Date:</div>
            <div class="meta-cell">${new Date(creditNote.invoice.invoiceDate).toLocaleDateString('en-IN')}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Original Amount:</div>
            <div class="meta-cell">₹${creditNote.invoice.total.toFixed(2)}</div>
            <div class="meta-cell meta-label">Reason:</div>
            <div class="meta-cell">${creditNote.reason || 'N/A'}</div>
          </div>
        </div>
        
        <div class="party-section">
          <div class="party-col">
            <div class="party-title">Customer Details</div>
            <div class="party-detail"><strong>${creditNote.customer.name}</strong></div>
            ${creditNote.customer.gstin ? `<div class="party-detail"><strong>GSTIN:</strong> ${creditNote.customer.gstin}</div>` : '<div class="party-detail"><strong>Unregistered Customer</strong></div>'}
            ${creditNote.customer.phone ? `<div class="party-detail"><strong>Phone:</strong> ${creditNote.customer.phone}</div>` : ''}
            ${creditNote.customer.email ? `<div class="party-detail"><strong>Email:</strong> ${creditNote.customer.email}</div>` : ''}
          </div>
          <div class="party-col">
            <div class="party-title">Credit Note Summary</div>
            <div class="party-detail"><strong>Type:</strong> Credit Note (Reduction)</div>
            <div class="party-detail"><strong>Status:</strong> ${creditNote.status}</div>
            <div class="party-detail"><strong>Credit Amount:</strong> ₹${creditNote.totalAmount.toFixed(2)}</div>
            <div class="party-detail"><strong>Revised Balance:</strong> ₹${(creditNote.invoice.total - creditNote.totalAmount).toFixed(2)}</div>
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
              <div class="amount-words">Amount in Words:</div>
              <div style="font-size: 9pt;">${amountToWords(creditNote.totalAmount)}</div>
            </div>
            <div class="summary-right">
              <div class="summary-line"><span>Subtotal:</span><span>₹${creditNote.subtotal.toFixed(2)}</span></div>
              ${!isInterstate && creditNote.cgst > 0 ? `<div class="summary-line"><span>CGST:</span><span>₹${creditNote.cgst.toFixed(2)}</span></div>` : ''}
              ${!isInterstate && creditNote.sgst > 0 ? `<div class="summary-line"><span>SGST:</span><span>₹${creditNote.sgst.toFixed(2)}</span></div>` : ''}
              ${isInterstate && creditNote.igst > 0 ? `<div class="summary-line"><span>IGST:</span><span>₹${creditNote.igst.toFixed(2)}</span></div>` : ''}
              <div class="summary-line total"><span>Credit Amount:</span><span>₹${creditNote.totalAmount.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
        
        <div class="footer-section">
          <div class="footer-title">Impact on Original Invoice:</div>
          <div class="footer-text">• Original Invoice Amount: ₹${creditNote.invoice.total.toFixed(2)}</div>
          <div class="footer-text" style="color: #d32f2f;">• Less: Credit Note Amount: -₹${creditNote.totalAmount.toFixed(2)}</div>
          <div class="footer-text" style="font-weight: 600; color: #2e7d32;">• Revised Invoice Amount: ₹${(creditNote.invoice.total - creditNote.totalAmount).toFixed(2)}</div>
          <div class="signature">
            <div>For ${organisation.name}</div>
            <div style="margin-top: 30px; border-top: 1px solid #000; display: inline-block; padding-top: 2px;">Authorized Signatory</div>
          </div>
        </div>
        
        <div class="computer-generated">This is a computer generated credit note and does not require a physical signature</div>
      </div>
    </body>
    </html>
  `;
};

const generateDebitNoteHTML = (debitNote, organisation) => {
  const isInterstate = debitNote.igst > 0;
  const itemRows = debitNote.items.map((item, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td>${item.description}</td>
      <td style="text-align: center;">${item.hsnSac || '-'}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: center;">${item.unit}</td>
      <td style="text-align: right;">₹${item.rate.toFixed(2)}</td>
      <td style="text-align: center;">${item.taxRate}%</td>
      ${!isInterstate ? `
        <td style="text-align: right;">₹${item.cgst.toFixed(2)}</td>
        <td style="text-align: right;">₹${item.sgst.toFixed(2)}</td>
      ` : `<td style="text-align: right;">₹${item.igst.toFixed(2)}</td>`}
      <td style="text-align: right; font-weight: 600;">₹${item.lineTotal.toFixed(2)}</td>
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
        .tax-invoice { text-align: center; background: #1976d2; color: #fff; padding: 4px; font-weight: bold; font-size: 11pt; }
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
        
        <div class="tax-invoice">DEBIT NOTE</div>
        
        <div class="meta-section">
          <div class="meta-row">
            <div class="meta-cell meta-label">Debit Note No:</div>
            <div class="meta-cell">${debitNote.noteNumber}</div>
            <div class="meta-cell meta-label">Date:</div>
            <div class="meta-cell">${new Date(debitNote.issueDate).toLocaleDateString('en-IN')}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Original Invoice:</div>
            <div class="meta-cell">${debitNote.invoice.invoiceNumber}</div>
            <div class="meta-cell meta-label">Invoice Date:</div>
            <div class="meta-cell">${new Date(debitNote.invoice.invoiceDate).toLocaleDateString('en-IN')}</div>
          </div>
          <div class="meta-row">
            <div class="meta-cell meta-label">Original Amount:</div>
            <div class="meta-cell">₹${debitNote.invoice.total.toFixed(2)}</div>
            <div class="meta-cell meta-label">Reason:</div>
            <div class="meta-cell">${debitNote.reason || 'N/A'}</div>
          </div>
        </div>
        
        <div class="party-section">
          <div class="party-col">
            <div class="party-title">Customer Details</div>
            <div class="party-detail"><strong>${debitNote.customer.name}</strong></div>
            ${debitNote.customer.gstin ? `<div class="party-detail"><strong>GSTIN:</strong> ${debitNote.customer.gstin}</div>` : '<div class="party-detail"><strong>Unregistered Customer</strong></div>'}
            ${debitNote.customer.phone ? `<div class="party-detail"><strong>Phone:</strong> ${debitNote.customer.phone}</div>` : ''}
            ${debitNote.customer.email ? `<div class="party-detail"><strong>Email:</strong> ${debitNote.customer.email}</div>` : ''}
          </div>
          <div class="party-col">
            <div class="party-title">Debit Note Summary</div>
            <div class="party-detail"><strong>Type:</strong> Debit Note (Addition)</div>
            <div class="party-detail"><strong>Status:</strong> ${debitNote.status}</div>
            <div class="party-detail"><strong>Additional Amount:</strong> ₹${debitNote.totalAmount.toFixed(2)}</div>
            <div class="party-detail"><strong>Revised Balance:</strong> ₹${(debitNote.invoice.total + debitNote.totalAmount).toFixed(2)}</div>
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
              <div class="amount-words">Amount in Words:</div>
              <div style="font-size: 9pt;">${amountToWords(debitNote.totalAmount)}</div>
            </div>
            <div class="summary-right">
              <div class="summary-line"><span>Subtotal:</span><span>₹${debitNote.subtotal.toFixed(2)}</span></div>
              ${!isInterstate && debitNote.cgst > 0 ? `<div class="summary-line"><span>CGST:</span><span>₹${debitNote.cgst.toFixed(2)}</span></div>` : ''}
              ${!isInterstate && debitNote.sgst > 0 ? `<div class="summary-line"><span>SGST:</span><span>₹${debitNote.sgst.toFixed(2)}</span></div>` : ''}
              ${isInterstate && debitNote.igst > 0 ? `<div class="summary-line"><span>IGST:</span><span>₹${debitNote.igst.toFixed(2)}</span></div>` : ''}
              <div class="summary-line total"><span>Debit Amount:</span><span>₹${debitNote.totalAmount.toFixed(2)}</span></div>
            </div>
          </div>
        </div>
        
        <div class="footer-section">
          <div class="footer-title">Impact on Original Invoice:</div>
          <div class="footer-text">• Original Invoice Amount: ₹${debitNote.invoice.total.toFixed(2)}</div>
          <div class="footer-text" style="color: #1976d2;">• Add: Debit Note Amount: +₹${debitNote.totalAmount.toFixed(2)}</div>
          <div class="footer-text" style="font-weight: 600; color: #f57c00;">• Revised Invoice Amount: ₹${(debitNote.invoice.total + debitNote.totalAmount).toFixed(2)}</div>
          <div class="signature">
            <div>For ${organisation.name}</div>
            <div style="margin-top: 30px; border-top: 1px solid #000; display: inline-block; padding-top: 2px;">Authorized Signatory</div>
          </div>
        </div>
        
        <div class="computer-generated">This is a computer generated debit note and does not require a physical signature</div>
      </div>
    </body>
    </html>
  `;
};

module.exports = { generateCreditNoteHTML, generateDebitNoteHTML };
