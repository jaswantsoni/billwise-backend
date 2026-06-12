const prisma = require('../config/prisma');
const { toWords } = require('number-to-words');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { PDFDocument } = require('pdf-lib');
const queuedPdfService = require('../services/queuedPdfService');
const { getTemplate, listTemplates } = require('./invoiceTemplates');

const STATE_CODES = {
  'Andhra Pradesh': '37', 'Arunachal Pradesh': '12', 'Assam': '18', 'Bihar': '10',
  'Chhattisgarh': '22', 'Goa': '30', 'Gujarat': '24', 'Haryana': '06', 'Himachal Pradesh': '02',
  'Jharkhand': '20', 'Karnataka': '29', 'Kerala': '32', 'Madhya Pradesh': '23', 'Maharashtra': '27',
  'Manipur': '14', 'Meghalaya': '17', 'Mizoram': '15', 'Nagaland': '13', 'Odisha': '21',
  'Punjab': '03', 'Rajasthan': '08', 'Sikkim': '11', 'Tamil Nadu': '33', 'Telangana': '36',
  'Tripura': '16', 'Uttar Pradesh': '09', 'Uttarakhand': '05', 'West Bengal': '19',
  'Andaman and Nicobar Islands': '35', 'Chandigarh': '04', 'Dadra and Nagar Haveli and Daman and Diu': '26',
  'Delhi': '07', 'Jammu and Kashmir': '01', 'Ladakh': '02', 'Lakshadweep': '31', 'Puducherry': '34'
};

const amountToWords = (amount) => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = toWords(rupees).replace(/,/g, '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  words += ' Rupees';
  if (paise > 0) words += ` and ${toWords(paise).replace(/,/g, '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Paise`;
  return words + ' Only';
};

// ─── Shared: Fetch & validate invoice data ────────────────────────
const fetchInvoiceData = async (invoiceQuery, requestId, logPrefix) => {
  const invoice = await prisma.invoice.findFirst({
    ...invoiceQuery,
    include: { customer: true, items: { include: { product: true } } }
  });

  if (!invoice) return null;

  console.log(`[${logPrefix}] 📋 Request ${requestId} - Found invoice ${invoice.invoiceNumber} with ${invoice.items.length} items`);

  // Filter out items with deleted products
  const validItems = [];
  for (const item of invoice.items) {
    try {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (product) {
        validItems.push({ ...item, product });
      } else {
        console.warn(`[${logPrefix}] ⚠️  Request ${requestId} - Item ${item.id} references deleted product ${item.productId}, skipping`);
      }
    } catch (error) {
      console.warn(`[${logPrefix}] ⚠️  Request ${requestId} - Error fetching product for item ${item.id}:`, error.message);
    }
  }

  if (validItems.length !== invoice.items.length) {
    console.warn(`[${logPrefix}] ⚠️  Request ${requestId} - Filtered ${invoice.items.length - validItems.length} items with missing products`);
  }

  invoice.items = validItems;

  if (validItems.length === 0) {
    invoice.subtotal = 0; invoice.taxAmount = 0; invoice.totalAmount = 0;
    invoice.discount = invoice.discount || 0; invoice.shippingCharges = invoice.shippingCharges || 0;
  } else {
    invoice.subtotal = invoice.subtotal || 0; invoice.taxAmount = invoice.taxAmount || 0;
    invoice.totalAmount = invoice.totalAmount || 0; invoice.discount = invoice.discount || 0;
    invoice.shippingCharges = invoice.shippingCharges || 0;
  }

  return invoice;
};

// ─── Shared: Generate merged 4-copy PDF ───────────────────────────
const generateMergedPdf = async (invoice, organisation, billingAddress, shippingAddress, templateId, requestId, logPrefix) => {
  const orgState = organisation.state || '';
  const billState = billingAddress?.state || '';
  const isInterstate = orgState && billState && orgState !== billState;

  // Generate UPI QR Code
  let qrCodeDataUrl = '';
  if (organisation.upi) {
    const total = invoice.total || invoice.totalAmount || 0;
    const upiString = `upi://pay?pa=${organisation.upi}&pn=${encodeURIComponent(organisation.name)}&am=${total.toFixed ? total.toFixed(2) : total}&cu=INR&tn=${encodeURIComponent('Invoice ' + invoice.invoiceNumber)}`;
    try { qrCodeDataUrl = await QRCode.toDataURL(upiString, { width: 150, margin: 1 }); }
    catch (err) { console.error('QR Code generation error:', err); }
  }

  const helpers = { isInterstate, qrCodeDataUrl, amountToWords, STATE_CODES };
  const template = getTemplate(templateId);

  console.log(`[${logPrefix}] 🏗️  Request ${requestId} - Using template "${template.name}" for invoice ${invoice.invoiceNumber}`);

  const copies = ['ORIGINAL FOR BUYER', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER', 'QUADRUPLICATE FOR RECEIVER'];
  const pdfBuffers = [];
  let htmlLogged = false;

  for (const copyType of copies) {
    const modifiedInvoice = { ...invoice, invoiceCopyType: copyType };
    const htmlContent = template.render(modifiedInvoice, organisation, billingAddress, shippingAddress, helpers);

    if (!htmlLogged && process.env.NODE_ENV !== 'production') {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(__dirname, '..', 'logs', `invoice-html-${invoice.invoiceNumber}-${requestId}.html`);
      try {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.writeFileSync(logPath, htmlContent, 'utf8');
        console.log(`[${logPrefix}] 📄 HTML logged to: ${logPath}`);
      } catch (e) {
        console.log(`[${logPrefix}] 📄 HTML (inline log):\n${htmlContent}`);
      }
      htmlLogged = true;
    }

    const pdfBuffer = await queuedPdfService.generatePdf(htmlContent, {
      paperWidth: '8.27', paperHeight: '11.7',
      marginTop: '0.39', marginBottom: '0.39',
      marginLeft: '0.39', marginRight: '0.39',
      printBackground: 'true'
    });
    pdfBuffers.push(pdfBuffer);
  }

  const mergedPdf = await PDFDocument.create();
  for (const buf of pdfBuffers) {
    const pdf = await PDFDocument.load(buf);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => mergedPdf.addPage(p));
  }
  return mergedPdf.save();
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/invoices/:id/pdf?template=modern
// ═══════════════════════════════════════════════════════════════════
exports.getInvoicePDF = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);

  try {
    const { id } = req.params;
    const templateId = req.query.template || 'classic';

    console.log(`[Invoice PDF] 📄 Request ${requestId} - Generating PDF (template: ${templateId}) for invoice ${id}`);

    const organisations = await prisma.organisation.findMany({ where: { userId: req.userId }, take: 1 });
    if (!organisations.length) return res.status(400).json({ error: 'No organisation found' });

    const organisationId = organisations[0].id;

    const invoice = await fetchInvoiceData({ where: { id, organisationId } }, requestId, 'Invoice PDF');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const organisation = await prisma.organisation.findUnique({ where: { id: organisationId } });
    if (!organisation) return res.status(404).json({ error: 'Organisation not found' });

    let billingAddress = null, shippingAddress = null;
    if (invoice.billingAddressId) billingAddress = await prisma.address.findUnique({ where: { id: invoice.billingAddressId } });
    if (invoice.shippingAddressId) shippingAddress = await prisma.address.findUnique({ where: { id: invoice.shippingAddressId } });

    const mergedBytes = await generateMergedPdf(invoice, organisation, billingAddress, shippingAddress, templateId, requestId, 'Invoice PDF');

    console.log(`[Invoice PDF] ✅ Request ${requestId} - PDF generated in ${Date.now() - startTime}ms`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(mergedBytes));
  } catch (error) {
    console.error(`[Invoice PDF] 💥 Request ${requestId} - Failed after ${Date.now() - startTime}ms:`, error.message, error.stack);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/invoices/:id/pdf/public/:signature?template=modern
// ═══════════════════════════════════════════════════════════════════
const generateSignature = (invoiceId) => {
  return crypto.createHash('sha256').update(invoiceId + process.env.JWT_SECRET).digest('hex').substring(0, 16);
};

exports.getInvoicePDFPublic = async (req, res) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substr(2, 9);

  try {
    const { id, signature } = req.params;
    const templateId = req.query.template || 'classic';

    if (signature !== generateSignature(id)) return res.status(403).json({ error: 'Invalid signature' });

    console.log(`[Public PDF] 📄 Request ${requestId} - Generating PDF (template: ${templateId}) for invoice ${id}`);

    const invoice = await fetchInvoiceData({ where: { id } }, requestId, 'Public PDF');
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const organisation = await prisma.organisation.findUnique({ where: { id: invoice.organisationId } });
    if (!organisation) return res.status(404).json({ error: 'Organisation not found' });

    let billingAddress = null, shippingAddress = null;
    if (invoice.billingAddressId) billingAddress = await prisma.address.findUnique({ where: { id: invoice.billingAddressId } });
    if (invoice.shippingAddressId) shippingAddress = await prisma.address.findUnique({ where: { id: invoice.shippingAddressId } });

    const mergedBytes = await generateMergedPdf(invoice, organisation, billingAddress, shippingAddress, templateId, requestId, 'Public PDF');

    console.log(`[Public PDF] ✅ Request ${requestId} - PDF generated in ${Date.now() - startTime}ms`);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoiceNumber}.pdf"`);
    res.send(Buffer.from(mergedBytes));
  } catch (error) {
    console.error(`[Public PDF] 💥 Request ${requestId} - Failed after ${Date.now() - startTime}ms:`, error.message, error.stack);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════════
// GET /api/invoice-templates — list available templates
// ═══════════════════════════════════════════════════════════════════
exports.getInvoiceTemplates = (req, res) => {
  res.json({ templates: listTemplates() });
};

// ═══════════════════════════════════════════════════════════════════
// Health / Queue endpoints (unchanged)
// ═══════════════════════════════════════════════════════════════════
exports.pdfServiceHealth = async (req, res) => {
  try {
    const isHealthy = await queuedPdfService.healthCheck();
    const stats = queuedPdfService.getQueueStats();
    res.json({ status: isHealthy ? 'healthy' : 'unhealthy', service: 'gotenberg-queued', timestamp: new Date().toISOString(), queue: stats });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message, timestamp: new Date().toISOString() });
  }
};

exports.pdfQueueStats = async (req, res) => {
  try { res.json(queuedPdfService.getQueueStats()); }
  catch (error) { res.status(500).json({ error: error.message }); }
};

exports.clearPdfQueue = async (req, res) => {
  try {
    const clearedJobs = queuedPdfService.clearQueue();
    res.json({ message: `Cleared ${clearedJobs} jobs from queue`, clearedJobs });
  } catch (error) { res.status(500).json({ error: error.message }); }
};
