const prisma = require('../config/prisma');
const { renderTemplate } = require('../services/emailTemplates');
const { sendEmail: sendViaGmail } = require('./gmailController');
const { sendEmail: sendViaKampony } = require('../services/emailService');

// Smart email sender: Use user's Gmail if connected, otherwise use Kampony email
async function sendEmail(userId, { to, subject, html, fromName }) {
  try {
    // Check if user has Gmail connected
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gmailAccessToken: true, gmailRefreshToken: true },
    });

    if (user?.gmailAccessToken && user?.gmailRefreshToken) {
      // Use user's Gmail account
      return await sendViaGmail(userId, { to, subject, html, fromName });
    } else {
      // Fallback to Kampony's email service
      return await sendViaKampony({ to, subject, html });
    }
  } catch (error) {
    // If Gmail fails, try Kampony email as fallback
    console.error('Gmail send failed, trying Kampony email:', error);
    return await sendViaKampony({ to, subject, html });
  }
}

/**
 * @swagger
 * /api/email/send-invoice:
 *   post:
 *     summary: Send invoice email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoice_id
 *             properties:
 *               invoice_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Invoice email sent
 */
exports.sendInvoiceEmail = async (req, res) => {
  try {
    const { invoice_id } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoice_id },
      include: {
        customer: true,
      },
    });

    if (!invoice || invoice.organisationId !== req.organisationId) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: invoice.organisationId },
    });

    const { subject, html } = await renderTemplate('invoice', {
      customer_name: invoice.customer.name,
      company_name: organisation.name,
      invoice_no: invoice.invoiceNumber,
      invoice_type: invoice.invoiceType?.replace('_', ' ') || 'TAX INVOICE',
      invoice_date: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
      due_date: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
      amount: invoice.total.toFixed(2),
      invoice_link: `${process.env.FRONTEND_URL}/invoices/${invoice.id}`,
    });

    const log = await prisma.emailLog.create({
      data: {
        userId: req.userId,
        toEmail: invoice.customer.email,
        subject,
        html,
        status: 'sending',
      },
    });

    try {
      const result = await sendEmail(req.userId, {
        fromName: organisation.name,
        to: invoice.customer.email,
        subject,
        html,
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          gmailMessageId: result.messageId,
        },
      });

      res.json({ success: true, message: 'Invoice email sent' });
    } catch (sendError) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'failed', errorMessage: sendError.message },
      });
      throw sendError;
    }
  } catch (error) {
    console.error('Send invoice email error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
};

/**
 * @swagger
 * /api/email/send-credit-note:
 *   post:
 *     summary: Send credit note email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - credit_note_id
 *             properties:
 *               credit_note_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Credit note email sent
 */
exports.sendCreditNoteEmail = async (req, res) => {
  try {
    const { credit_note_id } = req.body;

    const creditNote = await prisma.creditNote.findUnique({
      where: { id: credit_note_id },
      include: {
        customer: true,
        invoice: true,
      },
    });

    if (!creditNote || creditNote.organisationId !== req.organisationId) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: creditNote.organisationId },
    });

    const { subject, html } = await renderTemplate('credit-note', {
      customer_name: creditNote.customer.name,
      company_name: organisation.name,
      credit_note_no: creditNote.noteNumber,
      invoice_no: creditNote.invoice.invoiceNumber,
      credit_note_date: new Date(creditNote.issueDate).toLocaleDateString('en-IN'),
      reason: creditNote.reason || 'N/A',
      amount: creditNote.totalAmount.toFixed(2),
      credit_note_link: `${process.env.FRONTEND_URL}/credit-notes/${creditNote.id}`,
    });

    const log = await prisma.emailLog.create({
      data: {
        userId: req.userId,
        toEmail: creditNote.customer.email,
        subject,
        html,
        status: 'sending',
      },
    });

    try {
      const result = await sendEmail(req.userId, {
        fromName: organisation.name,
        to: creditNote.customer.email,
        subject,
        html,
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          gmailMessageId: result.messageId,
        },
      });

      res.json({ success: true, message: 'Credit note email sent' });
    } catch (sendError) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'failed', errorMessage: sendError.message },
      });
      throw sendError;
    }
  } catch (error) {
    console.error('Send credit note email error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
};

/**
 * @swagger
 * /api/email/send-reminder:
 *   post:
 *     summary: Send payment reminder
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoice_id
 *             properties:
 *               invoice_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reminder sent
 */
exports.sendPaymentReminder = async (req, res) => {
  try {
    const { invoice_id } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoice_id },
      include: { customer: true },
    });

    if (!invoice || invoice.organisationId !== req.organisationId) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const organisation = await prisma.organisation.findUnique({
      where: { id: invoice.organisationId },
    });

    const isOverdue = new Date() > new Date(invoice.dueDate);

    const { subject, html } = await renderTemplate('reminder', {
      customer_name: invoice.customer.name,
      company_name: organisation.name,
      invoice_no: invoice.invoiceNumber,
      invoice_date: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
      due_date: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
      amount: invoice.total.toFixed(2),
      overdue_status: isOverdue ? 'overdue' : 'due soon',
      payment_link: `${process.env.FRONTEND_URL}/pay/${invoice.id}`,
      invoice_link: `${process.env.FRONTEND_URL}/invoices/${invoice.id}`,
    });

    const log = await prisma.emailLog.create({
      data: {
        userId: req.userId,
        toEmail: invoice.customer.email,
        subject,
        html,
        status: 'sending',
      },
    });

    try {
      const result = await sendEmail(req.userId, {
        fromName: organisation.name,
        to: invoice.customer.email,
        subject,
        html,
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          gmailMessageId: result.messageId,
        },
      });

      res.json({ success: true, message: 'Reminder sent' });
    } catch (sendError) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'failed', errorMessage: sendError.message },
      });
      throw sendError;
    }
  } catch (error) {
    console.error('Send reminder error:', error);
    res.status(500).json({ error: 'Failed to send reminder', details: error.message });
  }
};

// Helper function for automatic email sending (non-HTTP)
async function sendInvoiceEmailAuto(userId, invoiceData) {
  try {
    const { subject, html } = await renderTemplate('invoice', {
      customer_name: invoiceData.customerName,
      company_name: invoiceData.companyName,
      invoice_no: invoiceData.invoiceNumber,
      invoice_type: invoiceData.invoiceType?.replace('_', ' ') || 'TAX INVOICE',
      invoice_date: invoiceData.invoiceDate,
      due_date: invoiceData.dueDate,
      amount: invoiceData.total.toFixed(2),
      invoice_link: `${process.env.FRONTEND_URL}/invoices/${invoiceData.id}`,
    });

    const log = await prisma.emailLog.create({
      data: {
        userId,
        toEmail: invoiceData.customerEmail,
        subject,
        html,
        status: 'sending',
      },
    });

    try {
      const result = await sendEmail(userId, {
        fromName: invoiceData.companyName,
        to: invoiceData.customerEmail,
        subject,
        html,
      });

      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          gmailMessageId: result.messageId,
        },
      });
    } catch (sendError) {
      await prisma.emailLog.update({
        where: { id: log.id },
        data: { status: 'failed', errorMessage: sendError.message },
      });
    }
  } catch (error) {
    console.error('Auto send invoice email error:', error);
  }
}

module.exports = {
  ...require('./emailController'),
  sendInvoiceEmail: exports.sendInvoiceEmail,
  sendCreditNoteEmail: exports.sendCreditNoteEmail,
  sendPaymentReminder: exports.sendPaymentReminder,
  sendInvoiceEmailAuto,
};
