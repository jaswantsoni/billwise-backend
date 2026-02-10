const prisma = require('../config/prisma');
const { sendCreditNoteEmail } = require('../utils/emailService');
const { generateCreditNoteHTML } = require('../utils/noteTemplates');

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
    const prefix = organisation.creditNotePrefix || 'CN';
    const counter = organisation.creditNoteCounter || 1;
    const noteNumber = `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
    
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { creditNoteCounter: counter + 1 }
    });

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
        const creditNoteWithInvoice = { ...creditNote, invoice };
        await sendCreditNoteEmail(creditNoteWithInvoice, invoice.customer, organisation, user.email);
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
