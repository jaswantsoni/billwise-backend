/**
 * Quick Invoice Controller
 *
 * Zero-setup billing. Accepts free-text items and customer name/phone.
 * Silently builds product + customer database in the background.
 *
 * POST /api/quick-invoice
 * Body: {
 *   customer: { name, phone }          // optional
 *   items: [{ name, qty, price, gst }] // free text, no productId needed
 *   invoiceNumber: string              // optional
 *   invoiceDate: string                // optional
 *   notes: string                      // optional
 * }
 */

const prisma = require('../config/prisma');
const { getTemplate } = require('../services/invoiceTemplates');
const { PDFDocument } = require('pdf-lib');
const { generateDocumentNumber } = require('../utils/documentNumberGenerator');
const queuedPdfService = require('../services/queuedPdfService');
const QRCode = require('qrcode');

const { toWords } = require('number-to-words');

const normalize = (str) => (str || '').toLowerCase().trim().replace(/\s+/g, ' ');

const amountToWords = (amount) => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = toWords(rupees).replace(/,/g, '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  words += ' Rupees';
  if (paise > 0) words += ` and ${toWords(paise)} Paise`;
  return words + ' Only';
};

const STATE_CODES = {
  'Andhra Pradesh': '37', 'Arunachal Pradesh': '12', 'Assam': '18', 'Bihar': '10',
  'Chhattisgarh': '22', 'Goa': '30', 'Gujarat': '24', 'Haryana': '06', 'Himachal Pradesh': '02',
  'Jharkhand': '20', 'Karnataka': '29', 'Kerala': '32', 'Madhya Pradesh': '23', 'Maharashtra': '27',
  'Manipur': '14', 'Meghalaya': '17', 'Mizoram': '15', 'Nagaland': '13', 'Odisha': '21',
  'Punjab': '03', 'Rajasthan': '08', 'Sikkim': '11', 'Tamil Nadu': '33', 'Telangana': '36',
  'Tripura': '16', 'Uttar Pradesh': '09', 'Uttarakhand': '05', 'West Bengal': '19',
  'Delhi': '07', 'Chandigarh': '04', 'Jammu and Kashmir': '01', 'Puducherry': '34',
};

// ─── Auto-capture: find or create product silently ────────────────

async function findOrCreateProduct(itemName, price, gstRate, organisationId) {
  const key = normalize(itemName);
  if (!key) return null;

  // Try to find existing product by normalized name
  const existing = await prisma.product.findFirst({
    where: {
      organisationId,
      isActive: true,
      name: { equals: key, mode: 'insensitive' },
    },
  });

  if (existing) {
    // Update last price silently
    await prisma.product.update({
      where: { id: existing.id },
      data: { price: price || existing.price },
    }).catch(() => {});
    return existing;
  }

  // Create new product silently
  const sku = `AUTO-${Date.now().toString(36).toUpperCase()}`;
  return prisma.product.create({
    data: {
      name: itemName.trim(),
      description: '',
      sku,
      hsnCode: '',
      sacCode: '',
      unit: 'PCS',
      price: price || 0,
      taxRate: gstRate || 0,
      currency: 'INR',
      taxInclusive: false,
      purchasePrice: 0,
      stockQuantity: 0,
      avgCost: 0,
      minStock: 0,
      organisationId,
      isActive: true,
    },
  }).catch(() => null);
}

// ─── Auto-capture: find or create customer silently ───────────────

async function findOrCreateCustomer(customerData, organisationId) {
  const { name, phone } = customerData || {};
  if (!name && !phone) return null;

  const key = normalize(name);

  // Try find by phone first (more reliable), then name
  let existing = null;
  if (phone) {
    existing = await prisma.customer.findFirst({
      where: { organisationId, phone: phone.trim() },
    });
  }
  if (!existing && key) {
    existing = await prisma.customer.findFirst({
      where: { organisationId, name: { equals: key, mode: 'insensitive' } },
    });
  }

  if (existing) return existing;

  // Create new customer silently
  return prisma.customer.create({
    data: {
      name: (name || phone || 'Customer').trim(),
      phone: phone || '',
      email: '',
      gstin: '',
      organisationId,
    },
  }).catch(() => null);
}

// ─── POST /api/quick-invoice ──────────────────────────────────────

exports.createQuickInvoice = async (req, res) => {
  try {
    const { customer: customerData, items = [], invoiceNumber, invoiceDate, notes } = req.body;

    if (!items.length) {
      return res.status(400).json({ error: 'Add at least one item' });
    }

    // Get organisation
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1,
    });
    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found' });
    }
    const organisation = organisations[0];

    // Auto-capture customer
    const customer = await findOrCreateCustomer(customerData, organisation.id);
    const customerName = customer?.name || customerData?.name || '';
    const customerPhone = customer?.phone || customerData?.phone || '';
    const customerGstin = customer?.gstin || customerData?.gstin || '';

    console.log(`[Quick Invoice] Customer: "${customerName}" (from ${customer ? 'DB' : 'form data'})`);

    // Process items — auto-capture products in background
    let subtotal = 0, totalTax = 0;
    const processedItems = await Promise.all(
      items.map(async (item) => {
        const qty = Number(item.qty) || 1;
        const price = Number(item.price) || 0;
        const gstRate = Number(item.gst) || 0;
        const taxInclusive = item.taxInclusive === true;
        const details = item.details || '';
        const lineTotal = qty * price;

        let lineAmount, taxAmount;
        if (taxInclusive && gstRate > 0) {
          lineAmount = lineTotal / (1 + gstRate / 100);
          taxAmount = lineTotal - lineAmount;
        } else {
          lineAmount = lineTotal;
          taxAmount = (lineAmount * gstRate) / 100;
        }

        subtotal += lineAmount;
        totalTax += taxAmount;

        // Auto-capture product silently (don't await — fire and forget)
        findOrCreateProduct(item.name, price, gstRate, organisation.id).catch(() => {});

        return {
          name: item.name || 'Item',
          details,
          qty,
          price,
          gstRate,
          taxInclusive,
          lineAmount,
          taxAmount,
          cgst: taxAmount / 2,
          sgst: taxAmount / 2,
          igst: 0,
          amount: lineAmount,
        };
      })
    );

    const total = subtotal + totalTax;
    const invDate = invoiceDate || new Date().toISOString();

    // Generate invoice number using same logic as detailed invoice
    let invNumber = invoiceNumber;
    if (!invNumber) {
      const prefix = organisation.invoicePrefix || 'INV';
      const counter = organisation.invoiceCounter || 1;
      const format = organisation.invoiceFormat || '{PREFIX}/{YY}-{YY+1}/{###}';
      invNumber = generateDocumentNumber(format, prefix, counter);

      // Increment counter before saving (same as detailed invoice)
      await prisma.organisation.update({
        where: { id: organisation.id },
        data: { invoiceCounter: counter + 1 },
      });
    }

    // Save invoice to DB so it appears in history
    // Auto-create/find products for DB items
    const dbItems = await Promise.all(
      processedItems.map(async (it) => {
        const product = await findOrCreateProduct(it.name, it.price, it.gstRate, organisation.id);
        return { product, it };
      })
    );

    let savedInvoice = null;
    if (customer) {
      try {
        savedInvoice = await prisma.invoice.create({
          data: {
            invoiceNumber: invNumber,
            invoiceDate: new Date(invDate),
            dueDate: new Date(invDate),
            invoiceType: 'TAX_INVOICE',
            placeOfSupply: organisation.state || '',
            reverseCharge: false,
            paymentTerms: 'IMMEDIATE',
            subtotal,
            cgst: totalTax / 2,
            sgst: totalTax / 2,
            igst: 0,
            cess: 0,
            totalTax,
            total,
            notes: notes || '',
            status: 'DRAFT',
            organisationId: organisation.id,
            customerId: customer.id,
            items: {
              create: dbItems
                .filter(({ product }) => product !== null)
                .map(({ product, it }) => ({
                  productId: product.id,
                  description: it.name,
                  hsnSac: '',
                  quantity: it.qty,
                  unit: 'PCS',
                  rate: it.price,
                  discount: 0,
                  taxRate: it.gstRate,
                  taxInclusive: it.taxInclusive || false,
                  cgst: it.cgst,
                  sgst: it.sgst,
                  igst: 0,
                  amount: it.lineAmount,
                  taxAmount: it.taxAmount,
                })),
            },
          },
        });
        console.log(`[Quick Invoice] Saved to DB: ${invNumber}`);
      } catch (dbErr) {
        console.warn('[Quick Invoice] DB save failed (PDF still generated):', dbErr.message);
      }
    }

    // Build invoice object for template
    const invoiceObj = {
      invoiceNumber: invNumber,
      invoiceDate: invDate,
      dueDate: invDate,
      invoiceType: 'TAX_INVOICE',
      invoiceCopyType: 'ORIGINAL FOR BUYER',
      placeOfSupply: organisation.state || '',
      reverseCharge: false,
      paymentTerms: 'IMMEDIATE',
      subtotal,
      cgst: totalTax / 2,
      sgst: totalTax / 2,
      igst: 0,
      cess: 0,
      deliveryCharges: 0,
      otherCharges: 0,
      roundOff: 0,
      total,
      totalAmount: total,
      notes: notes || '',
      customer: {
        name: customerName || 'Customer',
        gstin: customerGstin,
        phone: customerPhone,
        email: customer?.email || '',
      },
      items: processedItems.map((it, idx) => ({
        id: `qi-${idx}`,
        productId: `qi-${idx}`,
        product: { name: it.name, hsnCode: '', sacCode: '' },
        description: it.name,
        subDescription: it.details || '',
        hsnSac: '',
        quantity: it.qty,
        unit: 'PCS',
        rate: it.price,
        discount: 0,
        taxRate: it.gstRate,
        taxInclusive: it.taxInclusive || false,
        cgst: it.cgst,
        sgst: it.sgst,
        igst: 0,
        amount: it.lineAmount,
        taxAmount: it.taxAmount,
      })),
    };

    // Generate QR
    let qrCodeDataUrl = '';
    if (organisation.upi) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(
          `upi://pay?pa=${organisation.upi}&pn=${encodeURIComponent(organisation.name)}&am=${total}&cu=INR`,
          { width: 120, margin: 1 }
        );
      } catch {}
    }

    const helpers = { isInterstate: false, qrCodeDataUrl, amountToWords, STATE_CODES };
    const template = getTemplate(organisation.defaultTemplate || 'classic');

    // Create a minimal billing address so customer name shows on the invoice
    const minimalBillingAddress = customerName ? {
      line1: customerPhone ? `Ph: ${customerPhone}` : '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
    } : null;
    const html = template.render(invoiceObj, organisation, null, null, helpers);

    // Generate 4-copy PDF
    const copies = ['ORIGINAL FOR BUYER', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER', 'QUADRUPLICATE FOR RECEIVER'];
    const pdfBuffers = [];
    for (const copyType of copies) {
      const modifiedInvoice = { ...invoiceObj, invoiceCopyType: copyType };
      const copyHtml = template.render(modifiedInvoice, organisation, minimalBillingAddress, null, helpers);
      const buf = await queuedPdfService.generatePdf(copyHtml, {
        paperWidth: '8.27', paperHeight: '11.7',
        marginTop: '0.39', marginBottom: '0.39',
        marginLeft: '0.39', marginRight: '0.39',
        printBackground: 'true',
      });
      pdfBuffers.push(buf);
    }

    const mergedPdf = await PDFDocument.create();
    for (const buf of pdfBuffers) {
      const pdf = await PDFDocument.load(buf);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(p => mergedPdf.addPage(p));
    }
    const mergedBytes = await mergedPdf.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invNumber}.pdf"`);
    res.send(Buffer.from(mergedBytes));

  } catch (error) {
    console.error('[Quick Invoice] Error:', error.message);
    res.status(500).json({ error: 'Failed to generate invoice', details: error.message });
  }
};

// ─── GET /api/quick-invoice/suggest/products?q=nut ───────────────

exports.suggestProducts = async (req, res) => {
  try {
    const { q = '' } = req.query;
    const organisations = await prisma.organisation.findMany({ where: { userId: req.userId }, take: 1 });
    if (!organisations.length) return res.json({ data: [] });

    const products = await prisma.product.findMany({
      where: {
        organisationId: organisations[0].id,
        isActive: true,
        name: { contains: q.trim(), mode: 'insensitive' },
      },
      take: 8,
      select: { id: true, name: true, price: true, taxRate: true, unit: true },
    });

    res.json({ data: products });
  } catch (err) {
    res.json({ data: [] });
  }
};

// ─── GET /api/quick-invoice/suggest/customers?q=raj ──────────────

exports.suggestCustomers = async (req, res) => {
  try {
    const { q = '' } = req.query;
    const organisations = await prisma.organisation.findMany({ where: { userId: req.userId }, take: 1 });
    if (!organisations.length) return res.json({ data: [] });

    const customers = await prisma.customer.findMany({
      where: {
        organisationId: organisations[0].id,
        OR: [
          { name: { contains: q.trim(), mode: 'insensitive' } },
          { phone: { contains: q.trim() } },
        ],
      },
      take: 8,
      select: { id: true, name: true, phone: true, gstin: true },
    });

    res.json({ data: customers });
  } catch (err) {
    res.json({ data: [] });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────
