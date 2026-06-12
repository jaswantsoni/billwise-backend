const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { apiKeyAuth } = require('../middleware/apiKeyAuth');

const prisma = new PrismaClient();

// ─── Helper ───────────────────────────────────────────────────────────────────

const ok = (res, data, msg = 'Success') =>
  res.json({ success: true, message: msg, data });

const err = (res, msg, status = 400) =>
  res.status(status).json({ success: false, error: msg });

// ─── API Key Management (requires JWT auth) ───────────────────────────────────

/**
 * POST /api/saas/keys
 * Generate a new never-expiring API key for an organisation
 */
router.post('/keys', authenticate, async (req, res) => {
  try {
    const { organisationId, name } = req.body;
    if (!organisationId || !name)
      return err(res, 'organisationId and name are required');

    // Verify user owns this organisation
    const org = await prisma.organisation.findFirst({
      where: { id: organisationId, userId: req.userId },
    });
    if (!org) return err(res, 'Organisation not found', 404);

    const key = `kmp_${crypto.randomBytes(24).toString('hex')}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        key,
        name,
        userId: req.userId,
        organisationId,
      },
    });

    ok(res, { id: apiKey.id, key: apiKey.key, name: apiKey.name, createdAt: apiKey.createdAt },
      'API key created. Store it safely — it will not be shown again.');
  } catch (e) {
    console.error(e);
    err(res, 'Server error', 500);
  }
});

/**
 * GET /api/saas/keys
 * List API keys for an organisation (keys are masked)
 */
router.get('/keys', authenticate, async (req, res) => {
  try {
    const { organisationId } = req.query;
    const keys = await prisma.apiKey.findMany({
      where: { organisationId, userId: req.userId },
      select: {
        id: true, name: true, active: true, lastUsedAt: true, createdAt: true,
        key: true, // masked below
      },
    });

    const masked = keys.map((k) => ({
      ...k,
      key: `${k.key.slice(0, 10)}...${k.key.slice(-4)}`,
    }));

    ok(res, masked);
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

/**
 * DELETE /api/saas/keys/:id
 * Disable (revoke) an API key
 */
router.delete('/keys/:id', authenticate, async (req, res) => {
  try {
    await prisma.apiKey.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: { active: false },
    });
    ok(res, null, 'API key revoked');
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

// ─── Customer APIs ─────────────────────────────────────────────────────────────

/**
 * POST /api/saas/customers
 * Create a customer
 * Body: { name, email, phone?, gstin?, addresses?: [{line1,city,state,pincode,type}] }
 */
router.post('/customers', apiKeyAuth, async (req, res) => {
  try {
    const { name, email, phone, gstin, addresses = [] } = req.body;

    if (!name || !email)
      return err(res, 'name and email are required');

    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone: phone || null,
        gstin: gstin || null,
        organisationId: req.organisationId,
        addresses: {
          create: addresses.map((a) => ({
            line1: a.line1,
            line2: a.line2 || null,
            city: a.city || null,
            state: a.state || null,
            pincode: a.pincode || null,
            type: a.type || 'BILLING',
            isDefault: a.isDefault || false,
          })),
        },
      },
      include: { addresses: true },
    });

    ok(res, customer, 'Customer created');
  } catch (e) {
    console.error(e);
    err(res, 'Server error', 500);
  }
});

/**
 * PUT /api/saas/customers/:id
 * Update customer name, email, phone, gstin
 */
router.put('/customers/:id', apiKeyAuth, async (req, res) => {
  try {
    const { name, email, phone, gstin } = req.body;

    const existing = await prisma.customer.findFirst({
      where: { id: req.params.id, organisationId: req.organisationId },
    });
    if (!existing) return err(res, 'Customer not found', 404);

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: {
        name: name ?? existing.name,
        email: email ?? existing.email,
        phone: phone ?? existing.phone,
        gstin: gstin ?? existing.gstin,
      },
      include: { addresses: true },
    });

    ok(res, customer, 'Customer updated');
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

/**
 * POST /api/saas/customers/:id/addresses
 * Add an address to a customer
 */
router.post('/customers/:id/addresses', apiKeyAuth, async (req, res) => {
  try {
    const { line1, line2, city, state, pincode, type = 'BILLING', isDefault = false } = req.body;
    if (!line1) return err(res, 'line1 is required');

    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, organisationId: req.organisationId },
    });
    if (!customer) return err(res, 'Customer not found', 404);

    const address = await prisma.address.create({
      data: {
        line1, line2: line2 || null, city: city || null,
        state: state || null, pincode: pincode || null,
        type, isDefault,
        customerId: customer.id,
      },
    });

    ok(res, address, 'Address added');
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

/**
 * DELETE /api/saas/customers/:id/addresses/:addressId
 * Remove an address from a customer
 */
router.delete('/customers/:id/addresses/:addressId', apiKeyAuth, async (req, res) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, organisationId: req.organisationId },
    });
    if (!customer) return err(res, 'Customer not found', 404);

    await prisma.address.deleteMany({
      where: { id: req.params.addressId, customerId: customer.id },
    });

    ok(res, null, 'Address removed');
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

// ─── Product APIs ─────────────────────────────────────────────────────────────

/**
 * POST /api/saas/products
 * Create a product
 * Body: { name, sku, price, taxRate, unit, hsnCode?, description?, images?: [url], taxInclusive? }
 */
router.post('/products', apiKeyAuth, async (req, res) => {
  try {
    const {
      name, sku, price, taxRate, unit, hsnCode,
      sacCode, description, images = [], taxInclusive = false,
    } = req.body;

    if (!name || price === undefined || !taxRate || !unit)
      return err(res, 'name, price, taxRate, unit are required');

    const product = await prisma.product.create({
      data: {
        name,
        sku: sku || `SKU-${Date.now()}`,
        price: parseFloat(price),
        taxRate: parseFloat(taxRate),
        unit,
        hsnCode: hsnCode || null,
        sacCode: sacCode || null,
        description: description || null,
        taxInclusive: !!taxInclusive,
        images: images, // array of URLs
        organisationId: req.organisationId,
      },
    });

    ok(res, product, 'Product created');
  } catch (e) {
    console.error(e);
    err(res, 'Server error', 500);
  }
});

/**
 * PUT /api/saas/products/:id
 * Update a product
 */
router.put('/products/:id', apiKeyAuth, async (req, res) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, organisationId: req.organisationId },
    });
    if (!existing) return err(res, 'Product not found', 404);

    const {
      name, sku, price, taxRate, unit, hsnCode,
      sacCode, description, images, taxInclusive,
    } = req.body;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        name: name ?? existing.name,
        sku: sku ?? existing.sku,
        price: price !== undefined ? parseFloat(price) : existing.price,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : existing.taxRate,
        unit: unit ?? existing.unit,
        hsnCode: hsnCode ?? existing.hsnCode,
        sacCode: sacCode ?? existing.sacCode,
        description: description ?? existing.description,
        images: images ?? existing.images,
        taxInclusive: taxInclusive !== undefined ? !!taxInclusive : existing.taxInclusive,
      },
    });

    ok(res, product, 'Product updated');
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

/**
 * DELETE /api/saas/products/:id
 */
router.delete('/products/:id', apiKeyAuth, async (req, res) => {
  try {
    const existing = await prisma.product.findFirst({
      where: { id: req.params.id, organisationId: req.organisationId },
    });
    if (!existing) return err(res, 'Product not found', 404);

    await prisma.product.delete({ where: { id: req.params.id } });
    ok(res, null, 'Product deleted');
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

// ─── Invoice API ──────────────────────────────────────────────────────────────

/**
 * POST /api/saas/invoices
 * Create an invoice
 * Body: {
 *   customerId,
 *   billingAddressId,       // optional — uses customer's default if omitted
 *   shippingAddressId,      // optional
 *   invoiceDate,            // YYYY-MM-DD, defaults to today
 *   dueDate,                // optional
 *   items: [{
 *     productId?,           // optional — use this OR name+price
 *     name,
 *     quantity,
 *     price,                // unit price
 *     taxRate,
 *     taxInclusive,         // true = price already includes GST
 *     hsnCode?,
 *     unit?
 *   }],
 *   notes?
 * }
 */
router.post('/invoices', apiKeyAuth, async (req, res) => {
  try {
    const {
      customerId, billingAddressId, shippingAddressId,
      invoiceDate, dueDate, items = [], notes,
    } = req.body;

    if (!customerId || items.length === 0)
      return err(res, 'customerId and at least one item are required');

    // Verify customer belongs to this org
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organisationId: req.organisationId },
      include: { addresses: true },
    });
    if (!customer) return err(res, 'Customer not found', 404);

    // Resolve billing address
    const billing = billingAddressId
      ? customer.addresses.find((a) => a.id === billingAddressId)
      : customer.addresses.find((a) => a.isDefault) || customer.addresses[0];

    // Get organisation for invoice numbering
    const org = await prisma.organisation.findUnique({
      where: { id: req.organisationId },
    });

    // Generate invoice number
    const counter = org.invoiceCounter;
    const year = new Date().getFullYear();
    const nextYear = year + 1;
    const invoiceNumber = (org.invoiceFormat || '{PREFIX}/{YY}-{YY+1}/{###}')
      .replace('{PREFIX}', org.invoicePrefix || 'INV')
      .replace('{YY+1}', String(nextYear).slice(-2))
      .replace('{YY}', String(year).slice(-2))
      .replace('{YYYY}', String(year))
      .replace('{###}', String(counter).padStart(3, '0'))
      .replace('{####}', String(counter).padStart(4, '0'));

    // Calculate line totals
    let subtotal = 0;
    let totalTax = 0;

    const lineItems = items.map((item) => {
      const qty = parseFloat(item.quantity) || 1;
      const taxRate = parseFloat(item.taxRate) || 0;
      let basePrice = parseFloat(item.price) || 0;

      let taxableAmount, taxAmount;
      if (item.taxInclusive) {
        // Price includes GST — back-calculate
        taxableAmount = (basePrice * qty) / (1 + taxRate / 100);
        taxAmount = (basePrice * qty) - taxableAmount;
      } else {
        taxableAmount = basePrice * qty;
        taxAmount = taxableAmount * (taxRate / 100);
      }

      subtotal += taxableAmount;
      totalTax += taxAmount;

      return {
        productId: item.productId || null,
        name: item.name || 'Item',
        quantity: qty,
        price: basePrice,
        taxRate,
        taxInclusive: !!item.taxInclusive,
        taxableAmount: Math.round(taxableAmount * 100) / 100,
        taxAmount: Math.round(taxAmount * 100) / 100,
        total: Math.round((taxableAmount + taxAmount) * 100) / 100,
        hsnCode: item.hsnCode || null,
        unit: item.unit || 'PCS',
      };
    });

    const total = Math.round((subtotal + totalTax) * 100) / 100;

    // Determine CGST/SGST vs IGST (same state = CGST+SGST, different = IGST)
    const orgState = org.state || '';
    const custState = billing?.state || '';
    const isInterState = orgState && custState && orgState !== custState;
    const cgst = isInterState ? 0 : totalTax / 2;
    const sgst = isInterState ? 0 : totalTax / 2;
    const igst = isInterState ? totalTax : 0;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: 'TAX_INVOICE',
        invoiceCopyType: 'ORIGINAL',
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : null,
        organisationId: req.organisationId,
        customerId,
        billingAddressId: billing?.id || null,
        shippingAddressId: shippingAddressId || billing?.id || null,
        placeOfSupply: custState || orgState,
        subtotal: Math.round(subtotal * 100) / 100,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        total,
        paymentStatus: 'UNPAID',
        notes: notes || null,
        items: {
          create: lineItems,
        },
      },
      include: { items: true, customer: true },
    });

    // Increment invoice counter
    await prisma.organisation.update({
      where: { id: req.organisationId },
      data: { invoiceCounter: { increment: 1 } },
    });

    ok(res, invoice, 'Invoice created');
  } catch (e) {
    console.error(e);
    err(res, 'Server error', 500);
  }
});

/**
 * GET /api/saas/invoices
 * List invoices for the organisation
 */
router.get('/invoices', apiKeyAuth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          organisationId: req.organisationId,
          ...(status ? { paymentStatus: status } : {}),
        },
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, email: true } } },
      }),
      prisma.invoice.count({ where: { organisationId: req.organisationId } }),
    ]);

    ok(res, { invoices, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

/**
 * GET /api/saas/invoices/:id
 */
router.get('/invoices/:id', apiKeyAuth, async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organisationId: req.organisationId },
      include: {
        customer: { include: { addresses: true } },
        items: true,
      },
    });
    if (!invoice) return err(res, 'Invoice not found', 404);
    ok(res, invoice);
  } catch (e) {
    err(res, 'Server error', 500);
  }
});

module.exports = router;
