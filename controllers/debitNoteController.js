const prisma = require('../config/prisma');
const { sendDebitNoteEmail } = require('../utils/emailService');
const { generateDebitNoteHTML } = require('../utils/noteTemplates');

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
    const prefix = organisation.debitNotePrefix || 'DN';
    const counter = organisation.debitNoteCounter || 1;
    const noteNumber = `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
    
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { debitNoteCounter: counter + 1 }
    });

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
        const debitNoteWithInvoice = { ...debitNote, invoice };
        await sendDebitNoteEmail(debitNoteWithInvoice, invoice.customer, organisation, user.email);
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    const [debitNotes, total] = await Promise.all([
      prisma.debitNote.findMany({
        where: { organisationId: organisations[0].id },
        include: {
          items: true,
          customer: true,
          invoice: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.debitNote.count({ where: { organisationId: organisations[0].id } })
    ]);

    res.json({ 
      success: true, 
      data: debitNotes,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
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
