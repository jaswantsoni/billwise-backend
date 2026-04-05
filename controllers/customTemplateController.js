const prisma = require('../config/prisma');

// Verify org belongs to user
const verifyOrg = async (organisationId, userId) => {
  const org = await prisma.organisation.findFirst({ where: { id: organisationId, userId } });
  return org;
};

exports.listTemplates = async (req, res) => {
  try {
    const { organisationId } = req.query;
    if (!organisationId) return res.status(400).json({ error: 'organisationId required' });
    if (!await verifyOrg(organisationId, req.userId)) return res.status(403).json({ error: 'Access denied' });

    const templates = await prisma.customTemplate.findMany({
      where: { organisationId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true, paperSize: true, fields: true, backgroundImage: false, createdAt: true, updatedAt: true }
    });

    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.customTemplate.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!await verifyOrg(template.organisationId, req.userId)) return res.status(403).json({ error: 'Access denied' });
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, backgroundImage, fields, paperSize, organisationId } = req.body;
    if (!organisationId) return res.status(400).json({ error: 'organisationId required' });
    if (!await verifyOrg(organisationId, req.userId)) return res.status(403).json({ error: 'Access denied' });

    const template = await prisma.customTemplate.create({
      data: {
        name: name || 'Untitled',
        backgroundImage: backgroundImage || null,
        fields: fields || [],
        paperSize: paperSize || 'A4',
        organisationId,
      }
    });

    res.json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, backgroundImage, fields, paperSize } = req.body;

    const existing = await prisma.customTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (!await verifyOrg(existing.organisationId, req.userId)) return res.status(403).json({ error: 'Access denied' });

    const updated = await prisma.customTemplate.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(backgroundImage !== undefined && { backgroundImage }),
        ...(fields !== undefined && { fields }),
        ...(paperSize !== undefined && { paperSize }),
      }
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.customTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    if (!await verifyOrg(existing.organisationId, req.userId)) return res.status(403).json({ error: 'Access denied' });

    await prisma.customTemplate.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate PDF from a custom template with real invoice data
exports.generateTemplatePdf = async (req, res) => {
  try {
    const { id } = req.params;
    const withBackground = req.query.bg !== 'false';
    const { invoiceId } = req.query;

    const template = await prisma.customTemplate.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!await verifyOrg(template.organisationId, req.userId)) return res.status(403).json({ error: 'Access denied' });

    // Fetch invoice data if invoiceId provided
    let invoiceData = {};
    let invoice = null;
    if (invoiceId) {
      invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, organisationId: template.organisationId },
        include: { customer: { include: { addresses: true } }, items: { include: { product: true } } }
      });
      if (invoice) {
        const billing = invoice.billingAddressId
          ? await prisma.address.findUnique({ where: { id: invoice.billingAddressId } })
          : invoice.customer?.addresses?.[0];
        const org = await prisma.organisation.findUnique({ where: { id: template.organisationId } });

        // Map invoice fields to template variable tokens
        invoiceData = {
          CUSTOMER_NAME: invoice.customer?.name || '',
          CUSTOMER_ADDRESS_LINE1: billing?.line1 || '',
          CUSTOMER_ADDRESS_LINE2: billing?.line2 || '',
          CUSTOMER_CITY: billing?.city || '',
          CUSTOMER_STATE: billing?.state || '',
          CUSTOMER_PINCODE: billing?.pincode || '',
          CUSTOMER_PHONE: invoice.customer?.phone || '',
          CUSTOMER_EMAIL: invoice.customer?.email || '',
          CUSTOMER_GSTIN: invoice.customer?.gstin || '',
          INVOICE_NUMBER: invoice.invoiceNumber || '',
          INVOICE_DATE: invoice.invoiceDate ? new Date(invoice.invoiceDate).toLocaleDateString('en-IN') : '',
          DUE_DATE: invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-IN') : '',
          SUBTOTAL: `₹${(invoice.subtotal || 0).toFixed(2)}`,
          TOTAL: `₹${(invoice.total || 0).toFixed(2)}`,
          CGST_AMOUNT: `₹${(invoice.cgst || 0).toFixed(2)}`,
          SGST_AMOUNT: `₹${(invoice.sgst || 0).toFixed(2)}`,
          IGST_AMOUNT: `₹${(invoice.igst || 0).toFixed(2)}`,
          TOTAL_TAX: `₹${(invoice.totalTax || 0).toFixed(2)}`,
          PLACE_OF_SUPPLY: invoice.placeOfSupply || '',
          REVERSE_CHARGE: invoice.reverseCharge ? 'Yes' : 'No',
          EWAY_BILL: invoice.ewayBillNumber || '',
          VEHICLE_NUMBER: invoice.vehicleNumber || '',
          TRANSPORT_NAME: invoice.transportName || '',
          LR_NUMBER: invoice.lrNumber || '',
          PAYMENT_TERMS: invoice.paymentTerms || '',
          NOTES: invoice.notes || '',
          TERMS_CONDITIONS: invoice.termsConditions || '',
          DECLARATION: invoice.declaration || '',
          SELLER_GSTIN: org?.gstin || '',
          BANK_NAME: org?.bankName || '',
          ACCOUNT_NUMBER: org?.accountNumber || '',
          IFSC_CODE: org?.ifsc || '',
          BRANCH_NAME: org?.branch || '',
          UPI_ID: org?.upi || '',
        };
      }
    }

    // Build HTML from template fields
    const fields = Array.isArray(template.fields) ? template.fields : JSON.parse(template.fields || '[]');
    const paperSize = template.paperSize || 'A4';
    const width = paperSize === 'A4' ? '210mm' : '8.5in';
    const height = paperSize === 'A4' ? '297mm' : '11in';
    const bgStyle = withBackground && template.backgroundImage
      ? `background-image: url('${template.backgroundImage}'); background-size: cover; background-repeat: no-repeat; background-position: center;`
      : '';

    // Item column field IDs — rendered as per-row positioned divs using {{TOKEN_N}} pattern
    const ITEM_FIELD_IDS = ['item_sr_no','item_name','item_id','item_hsn_sac','item_qty','item_unit','item_price','item_discount','item_tax','item_amount'];
    const itemFields = fields.filter(f => ITEM_FIELD_IDS.includes(f.id));
    const nonItemFields = fields.filter(f => !ITEM_FIELD_IDS.includes(f.id));

    // Render non-item fields as positioned divs
    const fieldDivs = nonItemFields.map(f => {
      const style = [
        `position: absolute`,
        `left: ${f.x}%`,
        `top: ${f.y}%`,
        `width: ${f.width}%`,
        `font-size: ${f.fontSize * 0.75}px`,
        `font-family: ${f.fontFamily}, sans-serif`,
        `font-weight: ${f.fontWeight}`,
        `font-style: ${f.fontStyle}`,
        `color: ${f.color}`,
        `text-align: ${f.textAlign}`,
      ].join('; ');
      const token = f.id.toUpperCase();
      const value = invoiceData[token] !== undefined ? invoiceData[token] : `{{${token}}}`;
      return `<div data-field="${f.id}" style="${style}">${value}</div>`;
    }).join('\n  ');

    // Render item rows using per-row positioned divs
    let itemDivs = '';
    if (itemFields.length > 0 && invoice && invoice.items && invoice.items.length > 0) {
      const lineHeight = Math.max(...itemFields.map(f => f.fontSize)) * 0.12 + 1.2;
      itemDivs = invoice.items.map((item, idx) => {
        const rowNum = idx + 1;
        const rowData = {
          [`ITEM_SR_NO_${rowNum}`]: String(rowNum),
          [`ITEM_NAME_${rowNum}`]: item.product?.name || item.description || '',
          [`ITEM_ID_${rowNum}`]: item.product?.sku || '',
          [`ITEM_HSN_SAC_${rowNum}`]: item.hsnSac || item.product?.hsnCode || '',
          [`ITEM_QTY_${rowNum}`]: String(item.quantity),
          [`ITEM_UNIT_${rowNum}`]: item.unit || '',
          [`ITEM_PRICE_${rowNum}`]: `₹${(item.rate || 0).toFixed(2)}`,
          [`ITEM_DISCOUNT_${rowNum}`]: `₹${(item.discount || 0).toFixed(2)}`,
          [`ITEM_TAX_${rowNum}`]: `${item.taxRate || 0}%`,
          [`ITEM_AMOUNT_${rowNum}`]: `₹${(item.amount || 0).toFixed(2)}`,
        };
        return itemFields.map(f => {
          const extraY = idx * lineHeight;
          const style = [
            `position: absolute`,
            `left: ${f.x}%`,
            `top: ${(f.y + extraY).toFixed(2)}%`,
            `width: ${f.width}%`,
            `font-size: ${f.fontSize * 0.75}px`,
            `font-family: ${f.fontFamily}, sans-serif`,
            `font-weight: ${f.fontWeight}`,
            `font-style: ${f.fontStyle}`,
            `color: ${f.color}`,
            `text-align: ${f.textAlign}`,
          ].join('; ');
          const token = `${f.id.toUpperCase()}_${rowNum}`;
          return `<div data-field="${f.id}" data-row="${rowNum}" style="${style}">${rowData[token] || ''}</div>`;
        }).join('\n  ');
      }).join('\n  ');
    }

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      @page { size: ${width} ${height}; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { margin: 0; }
      .invoice-page { position: relative; width: ${width}; height: ${height}; overflow: hidden; ${bgStyle} }
    </style></head><body><div class="invoice-page">${fieldDivs}${itemDivs}</div></body></html>`;

    const queuedPdfService = require('../services/queuedPdfService');
    const pdfBuffer = await queuedPdfService.generatePdf(html, {
      paperWidth: '8.27', paperHeight: '11.7',
      marginTop: '0', marginBottom: '0',
      marginLeft: '0', marginRight: '0',
      printBackground: 'true'
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="custom-template.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[CustomTemplate PDF]', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.setAsDefault = async (req, res) => {
  try {
    const { id } = req.params;
    const withBg = req.body.withBackground !== false; // default true
    const template = await prisma.customTemplate.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (!await verifyOrg(template.organisationId, req.userId)) return res.status(403).json({ error: 'Access denied' });

    await prisma.organisation.update({
      where: { id: template.organisationId },
      data: { defaultCustomTemplateId: id, defaultCustomTemplateBg: withBg }
    });

    res.json({ success: true, message: 'Custom template set as default' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
