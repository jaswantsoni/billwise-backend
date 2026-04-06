const prisma = require('../config/prisma');
const XLSX = require('xlsx');

// ─── Field definitions per entity ────────────────────────────────────────────

const INVOICE_FIELDS = {
  invoiceNumber:  { label: 'Invoice Number',    get: r => r.invoiceNumber },
  invoiceType:    { label: 'Invoice Type',       get: r => r.invoiceType },
  invoiceDate:    { label: 'Invoice Date',       get: r => r.invoiceDate ? new Date(r.invoiceDate).toLocaleDateString('en-IN') : '' },
  dueDate:        { label: 'Due Date',           get: r => r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : '' },
  customerName:   { label: 'Customer Name',      get: r => r.customer?.name || '' },
  customerGstin:  { label: 'Customer GSTIN',     get: r => r.customer?.gstin || '' },
  customerPhone:  { label: 'Customer Phone',     get: r => r.customer?.phone || '' },
  customerEmail:  { label: 'Customer Email',     get: r => r.customer?.email || '' },
  subtotal:       { label: 'Subtotal',           get: r => r.subtotal || 0 },
  cgst:           { label: 'CGST',               get: r => r.cgst || 0 },
  sgst:           { label: 'SGST',               get: r => r.sgst || 0 },
  igst:           { label: 'IGST',               get: r => r.igst || 0 },
  totalTax:       { label: 'Total Tax',          get: r => r.totalTax || 0 },
  total:          { label: 'Grand Total',        get: r => r.total || 0 },
  paidAmount:     { label: 'Paid Amount',        get: r => r.paidAmount || 0 },
  balanceAmount:  { label: 'Balance Amount',     get: r => r.balanceAmount || 0 },
  paymentStatus:  { label: 'Payment Status',     get: r => r.paymentStatus || '' },
  paymentMethod:  { label: 'Payment Method',     get: r => r.paymentMethod || '' },
  status:         { label: 'Status',             get: r => r.status || '' },
  placeOfSupply:  { label: 'Place of Supply',    get: r => r.placeOfSupply || '' },
  reverseCharge:  { label: 'Reverse Charge',     get: r => r.reverseCharge ? 'Yes' : 'No' },
  notes:          { label: 'Notes',              get: r => r.notes || '' },
};

const PURCHASE_FIELDS = {
  billNumber:     { label: 'Bill Number',        get: r => r.billNumber },
  invoiceNumber:  { label: 'Supplier Invoice',   get: r => r.invoiceNumber || '' },
  purchaseDate:   { label: 'Purchase Date',      get: r => r.purchaseDate ? new Date(r.purchaseDate).toLocaleDateString('en-IN') : '' },
  dueDate:        { label: 'Due Date',           get: r => r.dueDate ? new Date(r.dueDate).toLocaleDateString('en-IN') : '' },
  supplierName:   { label: 'Supplier Name',      get: r => r.supplier?.name || '' },
  supplierGstin:  { label: 'Supplier GSTIN',     get: r => r.supplier?.gstin || '' },
  subtotal:       { label: 'Subtotal',           get: r => r.subtotal || 0 },
  cgst:           { label: 'CGST',               get: r => r.cgst || 0 },
  sgst:           { label: 'SGST',               get: r => r.sgst || 0 },
  igst:           { label: 'IGST',               get: r => r.igst || 0 },
  totalTax:       { label: 'Total Tax',          get: r => r.totalTax || 0 },
  grandTotal:     { label: 'Grand Total',        get: r => r.grandTotal || 0 },
  paidAmount:     { label: 'Paid Amount',        get: r => r.paidAmount || 0 },
  paymentStatus:  { label: 'Payment Status',     get: r => r.paymentStatus || '' },
  paymentMode:    { label: 'Payment Mode',       get: r => r.paymentMode || '' },
  status:         { label: 'Status',             get: r => r.status || '' },
  notes:          { label: 'Notes',              get: r => r.notes || '' },
};

const PRODUCT_FIELDS = {
  name:           { label: 'Product Name',       get: r => r.name },
  sku:            { label: 'SKU',                get: r => r.sku },
  description:    { label: 'Description',        get: r => r.description || '' },
  hsnCode:        { label: 'HSN Code',           get: r => r.hsnCode || '' },
  sacCode:        { label: 'SAC Code',           get: r => r.sacCode || '' },
  unit:           { label: 'Unit',               get: r => r.unit },
  price:          { label: 'Selling Price',      get: r => r.price || 0 },
  purchasePrice:  { label: 'Purchase Price',     get: r => r.purchasePrice || 0 },
  taxRate:        { label: 'Tax Rate %',         get: r => r.taxRate || 0 },
  taxInclusive:   { label: 'Tax Inclusive',      get: r => r.taxInclusive ? 'Yes' : 'No' },
  stockQuantity:  { label: 'Stock Quantity',     get: r => r.stockQuantity || 0 },
  minStock:       { label: 'Min Stock',          get: r => r.minStock || 0 },
  avgCost:        { label: 'Avg Cost',           get: r => r.avgCost || 0 },
  isLowStock:     { label: 'Low Stock',          get: r => (r.stockQuantity < r.minStock) ? 'Yes' : 'No' },
  createdAt:      { label: 'Created At',         get: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '' },
};

const CUSTOMER_FIELDS = {
  name:           { label: 'Customer Name',      get: r => r.name },
  gstin:          { label: 'GSTIN',              get: r => r.gstin || '' },
  email:          { label: 'Email',              get: r => r.email || '' },
  phone:          { label: 'Phone',              get: r => r.phone || '' },
  addressLine1:   { label: 'Address Line 1',     get: r => r.addresses?.[0]?.line1 || '' },
  addressLine2:   { label: 'Address Line 2',     get: r => r.addresses?.[0]?.line2 || '' },
  city:           { label: 'City',               get: r => r.addresses?.[0]?.city || '' },
  state:          { label: 'State',              get: r => r.addresses?.[0]?.state || '' },
  pincode:        { label: 'Pincode',            get: r => r.addresses?.[0]?.pincode || '' },
  totalInvoices:  { label: 'Total Invoices',     get: r => r._count?.invoices || 0 },
  createdAt:      { label: 'Created At',         get: r => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '' },
};

const FIELD_DEFS = { invoice: INVOICE_FIELDS, purchase: PURCHASE_FIELDS, product: PRODUCT_FIELDS, customer: CUSTOMER_FIELDS };

// ─── List available fields ────────────────────────────────────────────────────

exports.getFields = (req, res) => {
  const { entity } = req.params;
  const defs = FIELD_DEFS[entity];
  if (!defs) return res.status(400).json({ error: `Unknown entity: ${entity}` });
  res.json({
    fields: Object.entries(defs).map(([key, def]) => ({ key, label: def.label }))
  });
};

// ─── Export data ──────────────────────────────────────────────────────────────

exports.exportData = async (req, res) => {
  try {
    const { entity, fields, format = 'xlsx', startDate, endDate, organisationId: reqOrgId } = req.body;

    if (!entity || !fields?.length) {
      return res.status(400).json({ error: 'entity and fields are required' });
    }

    const defs = FIELD_DEFS[entity];
    if (!defs) return res.status(400).json({ error: `Unknown entity: ${entity}` });

    // Resolve org
    const orgWhere = reqOrgId
      ? { id: reqOrgId, userId: req.userId }
      : { userId: req.userId };
    const org = await prisma.organisation.findFirst({ where: orgWhere });
    if (!org) return res.status(403).json({ error: 'Organisation not found' });
    const organisationId = org.id;

    // Date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.gte = startDate ? new Date(startDate) : undefined;
      dateFilter.lte = endDate ? new Date(new Date(endDate).setHours(23, 59, 59, 999)) : undefined;
    }

    // Fetch data
    let rows = [];

    if (entity === 'invoice') {
      const where = { organisationId };
      if (startDate || endDate) where.invoiceDate = dateFilter;
      rows = await prisma.invoice.findMany({
        where,
        include: { customer: true },
        orderBy: { invoiceDate: 'desc' },
      });
    } else if (entity === 'purchase') {
      const where = { organisationId: { in: [organisationId] } };
      // purchases are linked via supplier -> organisation
      const purchases = await prisma.purchase.findMany({
        where: {
          supplier: { organisationId },
          ...(startDate || endDate ? { purchaseDate: dateFilter } : {}),
        },
        include: { supplier: true },
        orderBy: { purchaseDate: 'desc' },
      });
      rows = purchases;
    } else if (entity === 'product') {
      rows = await prisma.product.findMany({
        where: {
          organisationId,
          isActive: true,
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
        orderBy: { name: 'asc' },
      });
    } else if (entity === 'customer') {
      rows = await prisma.customer.findMany({
        where: {
          organisationId,
          ...(startDate || endDate ? { createdAt: dateFilter } : {}),
        },
        include: {
          addresses: true,
          _count: { select: { invoices: true } },
        },
        orderBy: { name: 'asc' },
      });
    }

    // Validate requested fields
    const validFields = fields.filter(f => defs[f]);
    if (!validFields.length) return res.status(400).json({ error: 'No valid fields selected' });

    // Build rows
    const header = validFields.map(f => defs[f].label);
    const dataRows = rows.map(row => validFields.map(f => defs[f].get(row)));

    // Generate file
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

    // Auto column widths
    ws['!cols'] = header.map((h, i) => ({
      wch: Math.max(h.length, ...dataRows.map(r => String(r[i] ?? '').length), 10)
    }));

    const sheetName = entity.charAt(0).toUpperCase() + entity.slice(1) + 's';
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}-export-${Date.now()}.csv"`);
      return res.send(csv);
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}-export-${Date.now()}.xlsx"`);
    res.send(buf);
  } catch (err) {
    console.error('[DataExport]', err.message);
    res.status(500).json({ error: err.message });
  }
};
