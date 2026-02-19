const prisma = require('../config/prisma');
const { renderTemplate } = require('../services/emailTemplates');
const { sendEmail } = require('./gmailController');

/**
 * @swagger
 * /api/email/draft:
 *   post:
 *     summary: Create email draft
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
 *               - to
 *               - subject
 *             properties:
 *               to:
 *                 type: string
 *                 example: customer@mail.com
 *               subject:
 *                 type: string
 *                 example: Invoice #1021
 *               template_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               variables:
 *                 type: object
 *                 example: {customer_name: "Rahul", invoice_no: "1021", amount: "5500"}
 *               html:
 *                 type: string
 *     responses:
 *       200:
 *         description: Draft created successfully
 *       400:
 *         description: Missing required fields
 */

// POST /email/draft - Save email draft
exports.createDraft = async (req, res) => {
  try {
    const { to, subject, template_id, variables } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'to and subject are required' });
    }

    let html = '';
    let finalSubject = subject;

    // If template_id provided, render template
    if (template_id) {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: template_id },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const rendered = await renderTemplate(template.name, variables || {});
      html = rendered.html;
      finalSubject = rendered.subject;
    } else {
      html = req.body.html || '';
    }

    const draft = await prisma.emailLog.create({
      data: {
        userId: req.userId,
        toEmail: to,
        subject: finalSubject,
        html,
        templateId: template_id || null,
        variables: variables || null,
        status: 'draft',
      },
    });

    res.json({ success: true, draft });
  } catch (error) {
    console.error('Create draft error:', error);
    res.status(500).json({ error: 'Failed to create draft', details: error.message });
  }
};

/**
 * @swagger
 * /api/email/send:
 *   post:
 *     summary: Send email from draft
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
 *               - draft_id
 *             properties:
 *               draft_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       404:
 *         description: Draft not found
 *       403:
 *         description: Unauthorized
 */
// POST /email/send - Send email from draft
exports.sendFromDraft = async (req, res) => {
  try {
    const { draft_id } = req.body;

    if (!draft_id) {
      return res.status(400).json({ error: 'draft_id is required' });
    }

    const draft = await prisma.emailLog.findUnique({
      where: { id: draft_id },
    });

    if (!draft) {
      return res.status(404).json({ error: 'Draft not found' });
    }

    if (draft.userId !== req.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (draft.status === 'sent') {
      return res.status(400).json({ error: 'Email already sent' });
    }

    try {
      // Send via Gmail
      const result = await sendEmail(req.userId, {
        to: draft.toEmail,
        subject: draft.subject,
        html: draft.html,
      });

      // Update draft status
      await prisma.emailLog.update({
        where: { id: draft_id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          gmailMessageId: result.messageId || null,
        },
      });

      res.json({ success: true, message: 'Email sent successfully' });
    } catch (sendError) {
      // Update draft with error
      await prisma.emailLog.update({
        where: { id: draft_id },
        data: {
          status: 'failed',
          errorMessage: sendError.message,
        },
      });

      throw sendError;
    }
  } catch (error) {
    console.error('Send email error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
};

/**
 * @swagger
 * /api/email/read:
 *   get:
 *     summary: Get email logs
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sending, sent, failed]
 *         description: Filter by status
 *       - in: query
 *         name: template_id
 *         schema:
 *           type: string
 *         description: Filter by template ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Skip records
 *     responses:
 *       200:
 *         description: Email logs retrieved
 */
// GET /email/read - Get email logs
exports.getEmailLogs = async (req, res) => {
  try {
    const { status, template_id, limit = 50, skip = 0 } = req.query;

    const where = {
      userId: req.userId,
    };

    if (status) {
      where.status = status;
    }

    if (template_id) {
      where.templateId = template_id;
    }

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(skip),
      }),
      prisma.emailLog.count({ where }),
    ]);

    res.json({
      success: true,
      logs,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
    });
  } catch (error) {
    console.error('Get email logs error:', error);
    res.status(500).json({ error: 'Failed to fetch logs', details: error.message });
  }
};

/**
 * @swagger
 * /api/email/send-direct:
 *   post:
 *     summary: Send email directly without draft
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
 *               - to
 *               - subject
 *             properties:
 *               to:
 *                 type: string
 *                 example: customer@mail.com
 *               subject:
 *                 type: string
 *                 example: Invoice #1021
 *               template_id:
 *                 type: string
 *                 example: 507f1f77bcf86cd799439011
 *               variables:
 *                 type: object
 *                 example: {customer_name: "Rahul", invoice_no: "1021", amount: "5500"}
 *               html:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email sent successfully
 *       400:
 *         description: Missing required fields
 */
// POST /email/send-direct - Send email directly without draft
exports.sendDirect = async (req, res) => {
  try {
    const { to, subject, template_id, variables, html } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ error: 'to and subject are required' });
    }

    let emailHtml = html || '';
    let finalSubject = subject;

    // If template_id provided, render template
    if (template_id) {
      const template = await prisma.emailTemplate.findUnique({
        where: { id: template_id },
      });

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      const rendered = await renderTemplate(template.name, variables || {});
      emailHtml = rendered.html;
      finalSubject = rendered.subject;
    }

    // Create log entry
    const log = await prisma.emailLog.create({
      data: {
        userId: req.userId,
        toEmail: to,
        subject: finalSubject,
        html: emailHtml,
        templateId: template_id || null,
        variables: variables || null,
        status: 'sending',
      },
    });

    try {
      // Send via Gmail
      const result = await sendEmail(req.userId, {
        to,
        subject: finalSubject,
        html: emailHtml,
      });

      // Update log
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          gmailMessageId: result.messageId || null,
        },
      });

      res.json({ success: true, message: 'Email sent successfully', logId: log.id });
    } catch (sendError) {
      // Update log with error
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          errorMessage: sendError.message,
        },
      });

      throw sendError;
    }
  } catch (error) {
    console.error('Send direct error:', error);
    res.status(500).json({ error: 'Failed to send email', details: error.message });
  }
};

module.exports = {
  createDraft: exports.createDraft,
  sendFromDraft: exports.sendFromDraft,
  getEmailLogs: exports.getEmailLogs,
  sendDirect: exports.sendDirect,
};
