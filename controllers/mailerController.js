const axios = require('axios');
const prisma = require('../config/prisma');

const MAILER_API = process.env.MAILER_BACKEND_URL || 'http://localhost:4000';

exports.getMailerTemplates = async (req, res) => {
  try {
    const token = req.headers.authorization;
    const response = await axios.get(`${MAILER_API}/api/templates/billing`, {
      headers: { Authorization: token },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch mailer templates' });
  }
};

exports.sendInvoiceEmail = async (req, res) => {
  try {
    const { invoiceId, templateId, recipients, customVariables } = req.body;
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const variables = {
      customer_name: invoice.customer.name,
      invoice_id: invoice.invoiceNumber,
      invoice_date: invoice.invoiceDate.toLocaleDateString(),
      due_date: invoice.dueDate.toLocaleDateString(),
      amount: `₹${invoice.total.toFixed(2)}`,
      company_name: 'Your Company',
      ...customVariables,
    };

    const token = req.headers.authorization;
    const response = await axios.post(
      `${MAILER_API}/api/email/send`,
      {
        templateId,
        recipients: recipients || [invoice.customer.email],
        variables,
        useGmail: true,
      },
      { headers: { Authorization: token } }
    );

    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send invoice email' });
  }
};

exports.getMailerToken = async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: req.userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const mailerUrl = `${process.env.MAILER_FRONTEND_URL || 'http://localhost:8081'}?token=${token}`;
    res.json({ token, mailerUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate mailer token' });
  }
};
