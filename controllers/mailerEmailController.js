const { sendEmail: sendViaGmail } = require('./gmailController');
const prisma = require('../config/prisma');

function replaceVariables(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables || {})) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

function blocksToHtml(blocks, variables) {
  let html = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">';
  blocks.forEach(block => {
    const style = Object.entries(block.style || {}).map(([k, v]) => `${k.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${v}${typeof v === 'number' ? 'px' : ''}`).join('; ');
    switch (block.type) {
      case 'heading':
        html += `<h1 style="${style}">${replaceVariables(block.content.text || '', variables)}</h1>`;
        break;
      case 'text':
        html += `<p style="${style}">${replaceVariables(block.content.text || '', variables).replace(/\n/g, '<br>')}</p>`;
        break;
      case 'button':
        html += `<div style="text-align: center; ${style}"><a href="${block.content.href}" style="display: inline-block; padding: 12px 24px; background-color: ${block.style.backgroundColor || '#2563eb'}; color: white; text-decoration: none; border-radius: ${block.style.borderRadius || 8}px;">${block.content.text}</a></div>`;
        break;
      case 'hero':
        html += `<div style="padding: 40px 20px; text-align: center; ${style}"><h1 style="color: white; margin: 0;">${replaceVariables(block.content.title || '', variables)}</h1><p style="color: rgba(255,255,255,0.9); margin-top: 8px;">${replaceVariables(block.content.subtitle || '', variables)}</p></div>`;
        break;
      case 'footer':
        html += `<div style="padding: 20px; text-align: center; font-size: 12px; color: #6b7280; ${style}">${replaceVariables(block.content.text || '', variables)}</div>`;
        break;
      case 'divider':
        html += `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; ${style}">`;
        break;
      case 'spacer':
        html += `<div style="height: ${block.style.height || 20}px;"></div>`;
        break;
    }
  });
  html += '</div>';
  return html;
}

exports.sendEmail = async (req, res) => {
  try {
    const { templateId, recipients, variables, fromName } = req.body;
    const template = await prisma.mailTemplate.findFirst({
      where: { id: templateId, OR: [{ userId: req.userId }, { isPublic: true }] },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const subject = replaceVariables(template.subject, variables);
    const html = template.htmlContent ? replaceVariables(template.htmlContent, variables) : blocksToHtml(template.blocks, variables);
    const results = [];

    for (const recipient of recipients) {
      try {
        await sendViaGmail(req.userId, { to: recipient, subject, html, fromName });
        await prisma.mailLog.create({
          data: { userId: req.userId, templateId, recipients: [recipient], subject, htmlContent: html, variables, status: 'sent', provider: 'gmail', sentAt: new Date() },
        });
        results.push({ recipient, success: true });
      } catch (error) {
        await prisma.mailLog.create({
          data: { userId: req.userId, templateId, recipients: [recipient], subject, htmlContent: html, variables, status: 'failed', errorMessage: error.message },
        });
        results.push({ recipient, success: false, error: error.message });
      }
    }

    res.json({ success: true, total: results.length, sent: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLogs = async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const where = { userId: req.userId };
    if (status) where.status = status;

    const logs = await prisma.mailLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: parseInt(limit), skip: parseInt(skip) });
    const total = await prisma.mailLog.count({ where });
    res.json({ logs, total });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const total = await prisma.mailLog.count({ where: { userId: req.userId } });
    const sent = await prisma.mailLog.count({ where: { userId: req.userId, status: 'sent' } });
    const failed = await prisma.mailLog.count({ where: { userId: req.userId, status: 'failed' } });
    res.json({ total, sent, failed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

exports.sendInvoiceEmail = async (req, res) => {
  try {
    const { invoiceId, templateId } = req.body;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId },
      include: { customer: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const variables = {
      customer_name: invoice.customer.name,
      invoice_id: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate.toLocaleDateString(),
      due_date: invoice.dueDate.toLocaleDateString(),
      amount: `₹${invoice.total.toFixed(2)}`,
      company_name: 'Your Company',
    };

    req.body = { templateId, recipients: [invoice.customer.email], variables };
    await exports.sendEmail(req, res);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send invoice email' });
  }
};
