const { sendInvoiceEmail } = require('../services/emailHelpers');
const prisma = require('../config/prisma');
const { generateSignature } = require('./pdfController');
const axios = require('axios');
const FormData = require('form-data');

exports.sendInvoiceByEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ success: false, error: 'Organisation not found' });
    }

    const organisation = organisations[0];

    const invoice = await prisma.invoice.findFirst({
      where: { id, organisationId: organisation.id },
      include: {
        items: { include: { product: true } },
        customer: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const recipientEmail = email || invoice.customer?.email;
    if (!recipientEmail) {
      return res.status(400).json({ success: false, error: 'No email address provided' });
    }

    const signature = generateSignature(id);
    const pdfLink = `${req.protocol}://${req.get('host')}/public/invoice/${id}/${signature}`;

    // Generate PDF buffer using Gotenberg
    let pdfBuffer = null;
    try {
      const generateInvoiceHTML = require('./pdfController').generateInvoiceHTML;
      
      let billingAddress = null;
      let shippingAddress = null;

      if (invoice.billingAddressId) {
        billingAddress = await prisma.address.findUnique({ where: { id: invoice.billingAddressId } });
      }
      if (invoice.shippingAddressId) {
        shippingAddress = await prisma.address.findUnique({ where: { id: invoice.shippingAddressId } });
      }

      const html = await generateInvoiceHTML(invoice, organisation, billingAddress, shippingAddress);
      
      // Use Gotenberg for PDF generation
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
      
      pdfBuffer = Buffer.from(response.data);
    } catch (err) {
      console.error('PDF generation for attachment failed:', err.message);
    }

    await sendInvoiceEmail(invoice, { ...invoice.customer, email: recipientEmail }, organisation, pdfBuffer, pdfLink);

    res.json({ success: true, message: 'Invoice sent successfully' });
  } catch (error) {
    console.error('Send invoice email error:', error);
    res.status(500).json({ success: false, error: 'Failed to send invoice', details: error.message });
  }
};

module.exports = exports;
