/**
 * Public Invoice Generator
 *
 * Flow:
 * 1. POST /api/public/invoice/preview  — no auth, returns live HTML preview
 * 2. POST /api/public/invoice/download — Google ID token required
 *    - Verifies Google token → finds/creates user + organisation
 *    - Generates PDF with Kampony watermark
 *    - Returns PDF blob
 *    - User is now in the system (lead captured)
 */

const { OAuth2Client } = require('google-auth-library');
const prisma = require('../config/prisma');
const queuedPdfService = require('../services/queuedPdfService');
const { getTemplate } = require('../services/invoiceTemplates');
const QRCode = require('qrcode');
const { toWords } = require('number-to-words');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Helpers ──────────────────────────────────────────────────────

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

// ─── Build invoice data from request body ─────────────────────────

function buildInvoiceData(body) {
  const { seller, buyer, items, region = 'intra', invoiceNumber, invoiceDate } = body;
  const isInterstate = region === 'inter';

  let subtotal = 0, totalTax = 0, cgst = 0, sgst = 0, igst = 0;

  const processedItems = (items || []).map((item, idx) => {
    const lineAmount = (item.qty || 1) * (item.price || 0);
    const taxAmount = (lineAmount * (item.rate || 0)) / 100;
    subtotal += lineAmount;
    totalTax += taxAmount;
    if (isInterstate) { igst += taxAmount; }
    else { cgst += taxAmount / 2; sgst += taxAmount / 2; }
    return {
      id: `item-${idx}`,
      productId: `pub-${idx}`,
      product: { name: item.name || 'Item', hsnCode: item.hsn || '', sacCode: '' },
      description: item.name || 'Item',
      hsnSac: item.hsn || '',
      quantity: item.qty || 1,
      unit: item.unit || 'PCS',
      rate: item.price || 0,
      discount: 0,
      taxRate: item.rate || 0,
      taxInclusive: false,
      cgst: isInterstate ? 0 : taxAmount / 2,
      sgst: isInterstate ? 0 : taxAmount / 2,
      igst: isInterstate ? taxAmount : 0,
      amount: lineAmount,
      taxAmount,
    };
  });

  const total = subtotal + totalTax;

  return {
    invoice: {
      invoiceNumber: invoiceNumber || `INV/${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}/${String(Date.now()).slice(-4)}`,
      invoiceDate: invoiceDate || new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      invoiceType: 'TAX_INVOICE',
      invoiceCopyType: 'ORIGINAL FOR BUYER',
      placeOfSupply: buyer?.state || '',
      reverseCharge: false,
      paymentTerms: 'NET_30',
      subtotal,
      cgst,
      sgst,
      igst,
      cess: 0,
      deliveryCharges: 0,
      otherCharges: 0,
      roundOff: 0,
      total,
      totalAmount: total,
      items: processedItems,
      customer: {
        name: buyer?.name || 'Customer',
        gstin: buyer?.gstin || '',
        phone: buyer?.phone || '',
        email: buyer?.email || '',
      },
    },
    organisation: {
      name: seller?.name || 'Your Business',
      address: seller?.address || '',
      city: seller?.city || '',
      state: seller?.state || '',
      pincode: seller?.pincode || '',
      gstin: seller?.gstin || '',
      pan: seller?.pan || '',
      phone: seller?.phone || '',
      email: seller?.email || '',
      logo: null,
      bankName: seller?.bankName || '',
      accountNumber: seller?.accountNumber || '',
      ifsc: seller?.ifsc || '',
      upi: seller?.upi || '',
    },
    billingAddress: buyer ? {
      line1: buyer.address || '',
      city: buyer.city || '',
      state: buyer.state || '',
      pincode: buyer.pincode || '',
    } : null,
    isInterstate,
    total,
    subtotal,
  };
}

// ─── Watermark HTML ───────────────────────────────────────────────

const WATERMARK_CSS = `
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72px;
    font-weight: 900;
    color: rgba(79, 70, 229, 0.08);
    white-space: nowrap;
    pointer-events: none;
    z-index: 9999;
    letter-spacing: 8px;
    font-family: Arial, sans-serif;
  }
  .watermark-footer {
    text-align: center;
    font-size: 9px;
    color: #a0aec0;
    margin-top: 20px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
  }
`;

function addWatermark(html) {
  const watermarkDiv = `<div class="watermark">KAMPONY</div>`;
  const watermarkFooter = `<div class="watermark-footer">Generated with Kampony Free Invoice Generator — kampony.com · Sign up free for unlimited invoices</div>`;
  const styleTag = `<style>${WATERMARK_CSS}</style>`;

  return html
    .replace('</head>', `${styleTag}</head>`)
    .replace('</body>', `${watermarkDiv}${watermarkFooter}</body>`);
}

// ─── POST /api/public/invoice/preview ─────────────────────────────

exports.previewInvoice = async (req, res) => {
  try {
    const { invoice, organisation, billingAddress, isInterstate, total } = buildInvoiceData(req.body);

    let qrCodeDataUrl = '';
    if (organisation.upi) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(
          `upi://pay?pa=${organisation.upi}&pn=${encodeURIComponent(organisation.name)}&am=${total}&cu=INR`,
          { width: 120, margin: 1 }
        );
      } catch {}
    }

    const helpers = { isInterstate, qrCodeDataUrl, amountToWords, STATE_CODES };
    const template = getTemplate('classic');
    const html = template.render(invoice, organisation, billingAddress, null, helpers);

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('[Public Invoice] Preview error:', error.message);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
};

// ─── POST /api/public/invoice/download ────────────────────────────

exports.downloadInvoice = async (req, res) => {
  try {
    const { googleToken, ...invoiceBody } = req.body;

    if (!googleToken) {
      return res.status(401).json({ error: 'Google sign-in required to download' });
    }

    // 1. Verify Google token
    let googleUser;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      googleUser = ticket.getPayload();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }

    // 2. Find or create user
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId: googleUser.sub }, { email: googleUser.email }] }
    });

    if (!user) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 5);
      user = await prisma.user.create({
        data: {
          email: googleUser.email,
          name: googleUser.name || googleUser.email.split('@')[0],
          googleId: googleUser.sub,
          planTier: 'premium',
          planStatus: 'active',
          planExpiry: trialEnd,
        }
      });
      console.log(`[Public Invoice] New user created: ${user.email}`);
    } else if (!user.googleId) {
      await prisma.user.update({ where: { id: user.id }, data: { googleId: googleUser.sub } });
    }

    // 3. Upsert lead for marketing (fire-and-forget)
    const { seller, utm } = invoiceBody;
    if (prisma.lead) {
      (async () => {
        try {
          const existing = await prisma.lead.findFirst({ where: { email: googleUser.email } });
          if (existing) {
            await prisma.lead.update({
              where: { id: existing.id },
              data: {
                googleId: googleUser.sub,
                businessName: seller?.name || existing.businessName,
                gstin: seller?.gstin || existing.gstin,
                phone: seller?.phone || existing.phone,
                userId: user.id,
                invoiceCount: { increment: 1 },
              },
            });
          } else {
            await prisma.lead.create({
              data: {
                email: googleUser.email,
                name: googleUser.name || '',
                googleId: googleUser.sub,
                businessName: seller?.name || '',
                gstin: seller?.gstin || '',
                phone: seller?.phone || '',
                city: seller?.city || '',
                state: seller?.state || '',
                source: 'gst-invoice-generator',
                sourcePage: '/gst-invoice-generator-free',
                utmSource: utm?.source || '',
                utmMedium: utm?.medium || '',
                utmCampaign: utm?.campaign || '',
                userId: user.id,
                status: 'new',
                invoiceCount: 1,
              },
            });
          }
        } catch (err) {
          console.warn('[Public Invoice] Lead save failed:', err.message);
        }
      })();
    }

    const { invoice, organisation, billingAddress, isInterstate, total } = buildInvoiceData(invoiceBody);

    // 4. Generate QR
    let qrCodeDataUrl = '';
    if (organisation.upi) {
      try {
        qrCodeDataUrl = await QRCode.toDataURL(
          `upi://pay?pa=${organisation.upi}&pn=${encodeURIComponent(organisation.name)}&am=${total}&cu=INR`,
          { width: 120, margin: 1 }
        );
      } catch {}
    }

    // 5. Generate HTML + add watermark
    const helpers = { isInterstate, qrCodeDataUrl, amountToWords, STATE_CODES };
    const template = getTemplate('classic');
    const html = template.render(invoice, organisation, billingAddress, null, helpers);
    const watermarkedHtml = addWatermark(html);

    // 6. Generate PDF
    const pdfBuffer = await queuedPdfService.generatePdf(watermarkedHtml, {
      paperWidth: '8.27', paperHeight: '11.7',
      marginTop: '0.39', marginBottom: '0.39',
      marginLeft: '0.39', marginRight: '0.39',
      printBackground: 'true',
    });

    // 7. Return JWT + invoice count from DB
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Get real invoice count from lead record
    let invoiceCount = 1;
    try {
      const lead = await prisma.lead.findFirst({ where: { email: googleUser.email } });
      invoiceCount = lead?.invoiceCount || 1;
    } catch {}

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="invoice-kampony.pdf"');
    res.setHeader('X-Auth-Token', token);
    res.setHeader('X-Invoice-Count', String(invoiceCount));
    res.send(pdfBuffer);

  } catch (error) {
    console.error('[Public Invoice] Download error:', error.message);
    res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
  }
};
