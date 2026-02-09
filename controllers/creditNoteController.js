const prisma = require('../config/prisma');
const { sendCreditNoteEmail } = require('../utils/emailService');

exports.createCreditNote = async (req, res) => {
  try {
    const { invoiceId, issueDate, reason, items, sendEmail } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found' });
    }

    const organisationId = organisations[0].id;
    const organisation = organisations[0];

    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organisationId },
      include: { items: true, customer: true }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Determine if interstate
    const orgState = organisation.state || '';
    const invoiceState = invoice.placeOfSupply || '';
    const isInterstate = orgState && invoiceState && orgState !== invoiceState;

    // Generate note number
    const year = new Date().getFullYear();
    const lastNote = await prisma.creditNote.findFirst({
      where: { noteNumber: { startsWith: `CN-${year}-` }, organisationId },
      orderBy: { createdAt: 'desc' }
    });

    let noteNumber;
    if (lastNote) {
      const lastNumber = parseInt(lastNote.noteNumber.split('-')[2]);
      noteNumber = `CN-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
    } else {
      noteNumber = `CN-${year}-0001`;
    }

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const validatedItems = items.map(item => {
      const lineTotal = item.quantity * item.rate;
      const taxAmount = lineTotal * (item.taxRate / 100);
      subtotal += lineTotal;
      totalTax += taxAmount;

      let cgst = 0, sgst = 0, igst = 0;
      if (isInterstate) {
        igst = taxAmount;
        totalIGST += igst;
      } else {
        cgst = taxAmount / 2;
        sgst = taxAmount / 2;
        totalCGST += cgst;
        totalSGST += sgst;
      }

      return {
        productId: item.productId,
        invoiceItemId: item.invoiceItemId || null,
        description: item.description,
        hsnSac: item.hsnSac,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        taxRate: item.taxRate,
        cgst,
        sgst,
        igst,
        lineTotal,
        taxAmount
      };
    });

    const totalAmount = subtotal + totalTax;

    // Check if credit note exceeds invoice balance
    const existingCreditNotes = await prisma.creditNote.findMany({
      where: { invoiceId, status: { not: 'CANCELLED' } }
    });
    const totalCreditAmount = existingCreditNotes.reduce((sum, cn) => sum + cn.totalAmount, 0);
    
    if (totalCreditAmount + totalAmount > invoice.total) {
      return res.status(400).json({ error: 'Credit note amount exceeds invoice total' });
    }

    const creditNote = await prisma.creditNote.create({
      data: {
        noteNumber,
        invoiceId,
        customerId: invoice.customerId,
        issueDate: new Date(issueDate),
        reason,
        subtotal,
        cgst: totalCGST,
        sgst: totalSGST,
        igst: totalIGST,
        totalTax,
        totalAmount,
        status: 'ISSUED',
        organisationId,
        items: {
          create: validatedItems
        }
      },
      include: { items: true }
    });

    // Update invoice balance
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        balanceAmount: { decrement: totalAmount }
      }
    });

    // Update invoice item credited quantities
    for (const item of validatedItems) {
      if (item.invoiceItemId) {
        await prisma.invoiceItem.update({
          where: { id: item.invoiceItemId },
          data: { creditedQty: { increment: item.quantity } }
        });
      }
    }

    if (sendEmail && invoice.customer.email) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        await sendCreditNoteEmail(creditNote, invoice.customer, organisation, user.email);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    }

    res.json({ success: true, data: creditNote });
  } catch (error) {
    console.error('Credit note creation error:', error);
    res.status(500).json({ error: 'Failed to create credit note', details: error.message });
  }
};

exports.getCreditNotes = async (req, res) => {
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const creditNotes = await prisma.creditNote.findMany({
      where: { organisationId: organisations[0].id },
      include: {
        items: true,
        customer: true,
        invoice: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: creditNotes });
  } catch (error) {
    console.error('Get credit notes error:', error);
    res.status(500).json({ error: 'Failed to fetch credit notes' });
  }
};

exports.getCreditNote = async (req, res) => {
  try {
    const { id } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    const creditNote = await prisma.creditNote.findFirst({
      where: { id, organisationId: organisations[0].id },
      include: {
        items: { include: { product: true } },
        customer: true,
        invoice: true
      }
    });

    if (!creditNote) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    res.json({ success: true, data: creditNote });
  } catch (error) {
    console.error('Get credit note error:', error);
    res.status(500).json({ error: 'Failed to fetch credit note' });
  }
};

exports.getCreditNotePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    const creditNote = await prisma.creditNote.findFirst({
      where: { id, organisationId: organisations[0].id },
      include: {
        items: { include: { product: true } },
        customer: true,
        invoice: true
      }
    });

    if (!creditNote) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    const organisation = organisations[0];
    const html = generateCreditNoteHTML(creditNote, organisation);

    const FormData = require('form-data');
    const axios = require('axios');
    const formData = new FormData();
    formData.append('files', Buffer.from(html), { filename: 'index.html' });

    const response = await axios.post(
      `${process.env.GOTENBERG_URL || 'http://localhost:3001'}/forms/chromium/convert/html`,
      formData,
      {
        headers: formData.getHeaders(),
        responseType: 'arraybuffer'
      }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=CreditNote-${creditNote.noteNumber}.pdf`);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Credit note PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

exports.getCreditNotePDFPublic = async (req, res) => {
  try {
    const { id } = req.params;
    const creditNote = await prisma.creditNote.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        invoice: true
      }
    });

    if (!creditNote) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: creditNote.organisationId }
    });

    const html = generateCreditNoteHTML(creditNote, organisation);
    const FormData = require('form-data');
    const axios = require('axios');
    const formData = new FormData();
    formData.append('files', Buffer.from(html), { filename: 'index.html' });

    const response = await axios.post(
      `${process.env.GOTENBERG_URL || 'http://localhost:3001'}/forms/chromium/convert/html`,
      formData,
      {
        headers: formData.getHeaders(),
        responseType: 'arraybuffer'
      }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename=CreditNote-${creditNote.noteNumber}.pdf`);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Credit note PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

function generateCreditNoteHTML(creditNote, organisation) {
  const toWords = require('number-to-words');
  const amountInWords = toWords.toWords(Math.floor(creditNote.totalAmount));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .title { font-size: 24px; font-weight: bold; color: #d32f2f; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    .total { font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">CREDIT NOTE</div>
    <h2>${organisation.name}</h2>
    <p>${organisation.address}, ${organisation.city}, ${organisation.state} - ${organisation.pincode}</p>
    <p>GSTIN: ${organisation.gstin || 'N/A'} | Phone: ${organisation.phone}</p>
  </div>

  <table>
    <tr><td><strong>Credit Note No:</strong></td><td>${creditNote.noteNumber}</td></tr>
    <tr><td><strong>Date:</strong></td><td>${new Date(creditNote.issueDate).toLocaleDateString()}</td></tr>
    <tr><td><strong>Original Invoice:</strong></td><td>${creditNote.invoice.invoiceNumber}</td></tr>
    <tr><td><strong>Original Invoice Amount:</strong></td><td>₹${creditNote.invoice.total.toFixed(2)}</td></tr>
    <tr><td><strong>Customer:</strong></td><td>${creditNote.customer.name}</td></tr>
    <tr><td><strong>Reason:</strong></td><td>${creditNote.reason || 'N/A'}</td></tr>
  </table>

  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>HSN/SAC</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Tax %</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      ${creditNote.items.map(item => `
        <tr>
          <td>${item.description}</td>
          <td>${item.hsnSac || ''}</td>
          <td>${item.quantity} ${item.unit}</td>
          <td>₹${item.rate.toFixed(2)}</td>
          <td>${item.taxRate}%</td>
          <td>₹${item.lineTotal.toFixed(2)}</td>
        </tr>
      `).join('')}
    </tbody>
    <tfoot>
      <tr><td colspan="5" class="total">Subtotal</td><td>₹${creditNote.subtotal.toFixed(2)}</td></tr>
      ${creditNote.cgst > 0 ? `<tr><td colspan="5">CGST</td><td>₹${creditNote.cgst.toFixed(2)}</td></tr>` : ''}
      ${creditNote.sgst > 0 ? `<tr><td colspan="5">SGST</td><td>₹${creditNote.sgst.toFixed(2)}</td></tr>` : ''}
      ${creditNote.igst > 0 ? `<tr><td colspan="5">IGST</td><td>₹${creditNote.igst.toFixed(2)}</td></tr>` : ''}
      <tr><td colspan="5" class="total">Total</td><td class="total">₹${creditNote.totalAmount.toFixed(2)}</td></tr>
    </tfoot>
  </table>

  <table style="margin-top: 10px;">
    <tr style="background-color: #fff3cd;"><td colspan="5" class="total">Original Invoice Total:</td><td class="total">₹${creditNote.invoice.total.toFixed(2)}</td></tr>
    <tr style="background-color: #f8d7da;"><td colspan="5" class="total">Less: Credit Note Amount:</td><td class="total">-₹${creditNote.totalAmount.toFixed(2)}</td></tr>
    <tr style="background-color: #d4edda;"><td colspan="5" class="total">Revised Invoice Amount:</td><td class="total">₹${(creditNote.invoice.total - creditNote.totalAmount).toFixed(2)}</td></tr>
  </table>

  <p><strong>Amount in Words:</strong> ${amountInWords.toUpperCase()} RUPEES ONLY</p>
  <p style="margin-top: 40px;">This is a computer-generated credit note.</p>
</body>
</html>
  `;
}

exports.getInvoiceCreditNotes = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const creditNotes = await prisma.creditNote.findMany({
      where: { 
        invoiceId,
        organisationId: organisations[0].id 
      },
      include: {
        items: true,
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: creditNotes });
  } catch (error) {
    console.error('Get invoice credit notes error:', error);
    res.status(500).json({ error: 'Failed to fetch credit notes' });
  }
};
