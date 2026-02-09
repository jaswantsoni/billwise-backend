const prisma = require('../config/prisma');
const { sendDebitNoteEmail } = require('../utils/emailService');

exports.createDebitNote = async (req, res) => {
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

    const orgState = organisation.state || '';
    const invoiceState = invoice.placeOfSupply || '';
    const isInterstate = orgState && invoiceState && orgState !== invoiceState;

    const year = new Date().getFullYear();
    const lastNote = await prisma.debitNote.findFirst({
      where: { noteNumber: { startsWith: `DN-${year}-` }, organisationId },
      orderBy: { createdAt: 'desc' }
    });

    let noteNumber;
    if (lastNote) {
      const lastNumber = parseInt(lastNote.noteNumber.split('-')[2]);
      noteNumber = `DN-${year}-${String(lastNumber + 1).padStart(4, '0')}`;
    } else {
      noteNumber = `DN-${year}-0001`;
    }

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

    const debitNote = await prisma.debitNote.create({
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

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        balanceAmount: { increment: totalAmount }
      }
    });

    if (sendEmail && invoice.customer.email) {
      try {
        const user = await prisma.user.findUnique({ where: { id: req.userId } });
        await sendDebitNoteEmail(debitNote, invoice.customer, organisation, user.email);
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    }

    res.json({ success: true, data: debitNote });
  } catch (error) {
    console.error('Debit note creation error:', error);
    res.status(500).json({ error: 'Failed to create debit note', details: error.message });
  }
};

exports.getDebitNotes = async (req, res) => {
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const debitNotes = await prisma.debitNote.findMany({
      where: { organisationId: organisations[0].id },
      include: {
        items: true,
        customer: true,
        invoice: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: debitNotes });
  } catch (error) {
    console.error('Get debit notes error:', error);
    res.status(500).json({ error: 'Failed to fetch debit notes' });
  }
};

exports.getDebitNote = async (req, res) => {
  try {
    const { id } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    const debitNote = await prisma.debitNote.findFirst({
      where: { id, organisationId: organisations[0].id },
      include: {
        items: { include: { product: true } },
        customer: true,
        invoice: true
      }
    });

    if (!debitNote) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    res.json({ success: true, data: debitNote });
  } catch (error) {
    console.error('Get debit note error:', error);
    res.status(500).json({ error: 'Failed to fetch debit note' });
  }
};

exports.getDebitNotePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    const debitNote = await prisma.debitNote.findFirst({
      where: { id, organisationId: organisations[0].id },
      include: {
        items: { include: { product: true } },
        customer: true,
        invoice: true
      }
    });

    if (!debitNote) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    const organisation = organisations[0];
    const html = generateDebitNoteHTML(debitNote, organisation);

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
    res.setHeader('Content-Disposition', `attachment; filename=DebitNote-${debitNote.noteNumber}.pdf`);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Debit note PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

exports.getDebitNotePDFPublic = async (req, res) => {
  try {
    const { id } = req.params;
    const debitNote = await prisma.debitNote.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        invoice: true
      }
    });

    if (!debitNote) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: debitNote.organisationId }
    });

    const html = generateDebitNoteHTML(debitNote, organisation);
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
    res.setHeader('Content-Disposition', `inline; filename=DebitNote-${debitNote.noteNumber}.pdf`);
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('Debit note PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

function generateDebitNoteHTML(debitNote, organisation) {
  const toWords = require('number-to-words');
  const amountInWords = toWords.toWords(Math.floor(debitNote.totalAmount));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
    .title { font-size: 24px; font-weight: bold; color: #1976d2; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    .total { font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">DEBIT NOTE</div>
    <h2>${organisation.name}</h2>
    <p>${organisation.address}, ${organisation.city}, ${organisation.state} - ${organisation.pincode}</p>
    <p>GSTIN: ${organisation.gstin || 'N/A'} | Phone: ${organisation.phone}</p>
  </div>

  <table>
    <tr><td><strong>Debit Note No:</strong></td><td>${debitNote.noteNumber}</td></tr>
    <tr><td><strong>Date:</strong></td><td>${new Date(debitNote.issueDate).toLocaleDateString()}</td></tr>
    <tr><td><strong>Original Invoice:</strong></td><td>${debitNote.invoice.invoiceNumber}</td></tr>
    <tr><td><strong>Original Invoice Amount:</strong></td><td>₹${debitNote.invoice.total.toFixed(2)}</td></tr>
    <tr><td><strong>Customer:</strong></td><td>${debitNote.customer.name}</td></tr>
    <tr><td><strong>Reason:</strong></td><td>${debitNote.reason || 'N/A'}</td></tr>
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
      ${debitNote.items.map(item => `
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
      <tr><td colspan="5" class="total">Subtotal</td><td>₹${debitNote.subtotal.toFixed(2)}</td></tr>
      ${debitNote.cgst > 0 ? `<tr><td colspan="5">CGST</td><td>₹${debitNote.cgst.toFixed(2)}</td></tr>` : ''}
      ${debitNote.sgst > 0 ? `<tr><td colspan="5">SGST</td><td>₹${debitNote.sgst.toFixed(2)}</td></tr>` : ''}
      ${debitNote.igst > 0 ? `<tr><td colspan="5">IGST</td><td>₹${debitNote.igst.toFixed(2)}</td></tr>` : ''}
      <tr><td colspan="5" class="total">Total</td><td class="total">₹${debitNote.totalAmount.toFixed(2)}</td></tr>
    </tfoot>
  </table>

  <table style="margin-top: 10px;">
    <tr style="background-color: #fff3cd;"><td colspan="5" class="total">Original Invoice Total:</td><td class="total">₹${debitNote.invoice.total.toFixed(2)}</td></tr>
    <tr style="background-color: #d1ecf1;"><td colspan="5" class="total">Add: Debit Note Amount:</td><td class="total">+₹${debitNote.totalAmount.toFixed(2)}</td></tr>
    <tr style="background-color: #d4edda;"><td colspan="5" class="total">Revised Invoice Amount:</td><td class="total">₹${(debitNote.invoice.total + debitNote.totalAmount).toFixed(2)}</td></tr>
  </table>

  <p><strong>Amount in Words:</strong> ${amountInWords.toUpperCase()} RUPEES ONLY</p>
  <p style="margin-top: 40px;">This is a computer-generated debit note.</p>
</body>
</html>
  `;
}

exports.getInvoiceDebitNotes = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const debitNotes = await prisma.debitNote.findMany({
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

    res.json({ success: true, data: debitNotes });
  } catch (error) {
    console.error('Get invoice debit notes error:', error);
    res.status(500).json({ error: 'Failed to fetch debit notes' });
  }
};
