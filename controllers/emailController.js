const { sendInvoiceEmail } = require('../services/emailHelpers');
const prisma = require('../config/prisma');
const { generateSignature, getInvoicePDFPublic } = require('./pdfController');
const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib');

exports.sendInvoiceByEmail = async (req, res) => {
  let browser;
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

    // Generate PDF buffer for attachment
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

      browser = await puppeteer.launch({ 
        headless: true, 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
      });
      const page = await browser.newPage();
      const html = await generateInvoiceHTML(invoice, organisation, billingAddress, shippingAddress);
      await page.setContent(html, { waitUntil: 'domcontentloaded' });
      pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      await browser.close();
      browser = null;
    } catch (err) {
      if (browser) await browser.close();
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
