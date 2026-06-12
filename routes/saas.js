const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { apiKeyAuth, requirePermission } = require('../middleware/apiKeyAuth');
const { fireWebhooks } = require('../services/webhookService');

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ok  = (res, data, msg = 'Success') => res.json({ success: true, message: msg, data });
const err = (res, msg, status = 400)     => res.status(status).json({ success: false, error: msg });

// ─── 1. API Key Management (JWT auth) ─────────────────────────────────────────

/**
 * POST /api/saas/keys
 * Generate API key with optional scoped permissions
 * Body: { organisationId, name, permissions?: ["products:write", "invoices:read", ...] }
 * Available permissions: products:read products:write customers:read customers:write
 *   orders:read orders:write invoices:read invoices:write inventory:read inventory:write
 *   webhooks:write  — empty array = full access
 */
router.post('/keys', authenticate, async (req, res) => {
  try {
    const { organisationId, name, permissions = [] } = req.body;
    if (!organisationId || !name) return err(res, 'organisationId and name are required');

    const org = await prisma.organisation.findFirst({
      where: { id: organisationId, userId: req.userId },
    });
    if (!org) return err(res, 'Organisation not found', 404);

    const key = `kmp_${crypto.randomBytes(24).toString('hex')}`;

    const apiKey = await prisma.apiKey.create({
      data: { key, name, userId: req.userId, organisationId, permissions },
    });

    ok(res, { id: apiKey.id, key: apiKey.key, name: apiKey.name, permissions: apiKey.permissions, createdAt: apiKey.createdAt },
      'API key created. Store it safely — it will not be shown again.');
  } catch (e) {
    console.error(e);
    err(res, 'Server error', 500);
  }
});

router.get('/keys', authenticate, async (req, res) => {
  try {
    const { organisationId } = req.query;
    const keys = await prisma.apiKey.findMany({
      where: { organisationId, userId: req.userId },
      select: { id: true, name: true, active: true, permissions: true, lastUsedAt: true, createdAt: true, key: true },
    });
    ok(res, keys.map((k) => ({ ...k, key: `${k.key.slice(0, 10)}...${k.key.slice(-4)}` })));
  } catch (e) { err(res, 'Server error', 500); }
});

router.delete('/keys/:id', authenticate, async (req, res) => {
  try {
    await prisma.apiKey.updateMany({ where: { id: req.params.id, userId: req.userId }, data: { active: false } });
    ok(res, null, 'API key revoked');
  } catch (e) { err(res, 'Server error', 500); }
});

// ─── 2. Customer APIs ─────────────────────────────────────────────────────────

router.post('/customers', apiKeyAuth, requirePermission('customers:write'), async (req, res) => {
  try {
    const { name, email, phone, gstin, addresses = [] } = req.body;
    if (!name || !email) return err(res, 'name and email are required');

    const customer = await prisma.customer.create({
      data: {
        name, email, phone: phone || null, gstin: gstin || null,
        organisationId: req.organisationId,
        addresses: {
          create: addresses.map((a) => ({
            line1: a.line1, line2: a.line2 || null, city: a.city || null,
            state: a.state || null, pincode: a.pincode || null,
            type: a.type || 'BILLING', isDefault: !!a.isDefault,
          })),
        },
      },
      include: { addresses: true },
    });

    ok(res, customer, 'Customer created');
  } catch (e) { console.error(e); err(res, 'Server error', 500); }
});

router.put('/customers/:id', apiKeyAuth, requirePermission('customers:write'), async (req, res) => {
  try {
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, organisationId: req.organisationId } });
    if (!existing) return err(res, 'Customer not found', 404);

    const { name, email, phone, gstin } = req.body;
    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: { name: name ?? existing.name, email: email ?? existing.email, phone: phone ?? existing.phone, gstin: gstin ?? existing.gstin },
      include: { addresses: true },
    });

    ok(res, customer, 'Customer updated');
  } catch (e) { err(res, 'Server error', 500); }
});

router.post('/customers/:id/addresses', apiKeyAuth, requirePermission('customers:write'), async (req, res) => {
  try {
    const { line1, line2, city, state, pincode, type = 'BILLING', isDefault = false } = req.body;
    if (!line1) return err(res, 'line1 is required');

    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, organisationId: req.organisationId } });
    if (!customer) return err(res, 'Customer not found', 404);

    const address = await prisma.address.create({
      data: { line1, line2: line2 || null, city: city || null, state: state || null, pincode: pincode || null, type, isDefault, customerId: customer.id },
    });

    ok(res, address, 'Address added');
  } catch (e) { err(res, 'Server error', 500); }
});

router.delete('/customers/:id/addresses/:addressId', apiKeyAuth, requirePermission('customers:write'), async (req, res) => {
  try {
    const customer = await prisma.customer.findFirst({ where: { id: req.params.id, organisationId: req.organisationId } });
    if (!customer) return err(res, 'Customer not found', 404);

    await prisma.address.deleteMany({ where: { id: req.params.addressId, customerId: customer.id } });
    ok(res, null, 'Address removed');
  } catch (e) { err(res, 'Server error', 500); }
});

// Bulk create customers
router.post('/customers/bulk', apiKeyAuth, requirePermission('customers:write'), async (req, res) => {
  try {
    const { customers = [] } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) return err(res, 'customers array required');
    if (customers.length > 500) return err(res, 'Max 500 customers per bulk request');

    const results = await Promise.allSettled(
      customers.map((c) =>
        prisma.customer.create({
          data: { name: c.name, email: c.email, phone: c.phone || null, gstin: c.gstin || null, organisationId: req.organisationId },
        })
      )
    );

    const created = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
    const failed  = results.filter((r) => r.status === 'rejected').length;

    ok(res, { created: created.length, failed }, `${created.length} customers created, ${failed} failed`);
  } catch (e) { err(res, 'Server error', 500); }
});

// ─── 3. Product APIs ──────────────────────────────────────────────────────────

router.post('/products', apiKeyAuth, requirePermission('products:write'), async (req, res) => {
  try {
    const { name, sku, price, taxRate, unit, hsnCode, sacCode, description, images = [], taxInclusive = true } = req.body;
    if (!name || price === undefined || taxRate === undefined || !unit)
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
        images,
        organisationId: req.organisationId,
      },
    });

    ok(res, product, 'Product created');
  } catch (e) { console.error(e); err(res, 'Server error', 500); }
});

router.put('/products/:id', apiKeyAuth, requirePermission('products:write'), async (req, res) => {
  try {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, organisationId: req.organisationId } });
    if (!existing) return err(res, 'Product not found', 404);

    const { name, sku, price, taxRate, unit, hsnCode, sacCode, description, images, taxInclusive } = req.body;
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
  } catch (e) { err(res, 'Server error', 500); }
});

router.delete('/products/:id', apiKeyAuth, requirePermission('products:write'), async (req, res) => {
  try {
    const existing = await prisma.product.findFirst({ where: { id: req.params.id, organisationId: req.organisationId } });
    if (!existing) return err(res, 'Product not found', 404);

    await prisma.product.delete({ where: { id: req.params.id } });
    ok(res, null, 'Product deleted');
  } catch (e) { err(res, 'Server error', 500); }
});

// Bulk create products
router.post('/products/bulk', apiKeyAuth, requirePermission('products:write'), async (req, res) => {
  try {
    const { products = [] } = req.body;
    if (!Array.isArray(products) || products.length === 0) return err(res, 'products array required');
    if (products.length > 500) return err(res, 'Max 500 products per bulk request');

    const results = await Promise.allSettled(
      products.map((p) =>
        prisma.product.create({
          data: {
            name: p.name,
            sku: p.sku || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            price: parseFloat(p.price),
            taxRate: parseFloat(p.taxRate || 0),
            unit: p.unit || 'PCS',
            hsnCode: p.hsnCode || null,
            description: p.description || null,
            images: p.images || [],
            taxInclusive: !!p.taxInclusive,
            organisationId: req.organisationId,
          },
        })
      )
    );

    const created = results.filter((r) => r.status === 'fulfilled').length;
    const failed  = results.filter((r) => r.status === 'rejected').length;

    ok(res, { created, failed }, `${created} products created, ${failed} failed`);
  } catch (e) { err(res, 'Server error', 500); }
});

// ─── 4. Inventory APIs ────────────────────────────────────────────────────────

router.get('/inventory', apiKeyAuth, requirePermission('inventory:read'), async (req, res) => {
  try {
    const { page = 1, limit = 50, lowStock } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      organisationId: req.organisationId,
      ...(lowStock === 'true' ? { stockQuantity: { lte: 5 } } : {}),
    };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        select: { id: true, name: true, sku: true, unit: true, stockQuantity: true, price: true, taxRate: true },
        skip, take: parseInt(limit),
        orderBy: { stockQuantity: 'asc' },
      }),
      prisma.product.count({ where }),
    ]);

    ok(res, { inventory: products, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { err(res, 'Server error', 500); }
});

router.post('/inventory/adjust', apiKeyAuth, requirePermission('inventory:write'), async (req, res) => {
  try {
    const { productId, quantity, reason = 'MANUAL', notes } = req.body;
    if (!productId || quantity === undefined) return err(res, 'productId and quantity are required');

    const product = await prisma.product.findFirst({ where: { id: productId, organisationId: req.organisationId } });
    if (!product) return err(res, 'Product not found', 404);

    const newQty = (product.stockQuantity || 0) + parseInt(quantity);
    if (newQty < 0) return err(res, 'Insufficient stock');

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: newQty },
    });

    // Log in stock ledger
    await prisma.stockLedger.create({
      data: {
        productId,
        organisationId: req.organisationId,
        quantity: parseInt(quantity),
        type: quantity > 0 ? 'IN' : 'OUT',
        reason,
        notes: notes || null,
        balanceAfter: newQty,
      },
    }).catch(() => {}); // Non-fatal if StockLedger model doesn't exist yet

    // Fire low stock webhook if applicable
    if (newQty <= (product.lowStockAlert || 5)) {
      fireWebhooks(req.organisationId, 'inventory.low_stock', {
        productId: product.id, name: product.name, sku: product.sku, stockQuantity: newQty,
      });
    }
    if (newQty === 0) {
      fireWebhooks(req.organisationId, 'inventory.out_of_stock', {
        productId: product.id, name: product.name, sku: product.sku,
      });
    }

    ok(res, { id: updated.id, sku: updated.sku, stockQuantity: newQty }, 'Stock adjusted');
  } catch (e) { console.error(e); err(res, 'Server error', 500); }
});

// ─── 5. Order APIs ────────────────────────────────────────────────────────────

router.post('/orders', apiKeyAuth, requirePermission('orders:write'), async (req, res) => {
  try {
    const { customerId, items = [], billingAddressId, shippingAddressId, notes, source, externalOrderId } = req.body;
    if (!customerId || items.length === 0) return err(res, 'customerId and items required');

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organisationId: req.organisationId },
      include: { addresses: true },
    });
    if (!customer) return err(res, 'Customer not found', 404);

    // Enrich items with product data if productId provided
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let product = null;
        if (item.productId) {
          product = await prisma.product.findFirst({
            where: { id: item.productId, organisationId: req.organisationId },
          });
        }
        return {
          productId: item.productId || null,
          name: item.name || product?.name || 'Item',
          sku: item.sku || product?.sku || null,
          quantity: parseFloat(item.quantity) || 1,
          price: parseFloat(item.price ?? product?.price ?? 0),
          taxRate: parseFloat(item.taxRate ?? product?.taxRate ?? 0),
          taxInclusive: item.taxInclusive ?? product?.taxInclusive ?? false,
          hsnCode: item.hsnCode || product?.hsnCode || null,
          unit: item.unit || product?.unit || 'PCS',
        };
      })
    );

    // Calculate totals
    let subtotal = 0, taxAmount = 0;
    enrichedItems.forEach((item) => {
      const qty = item.quantity;
      const price = item.price;
      if (item.taxInclusive) {
        const base = (price * qty) / (1 + item.taxRate / 100);
        subtotal  += base;
        taxAmount += (price * qty) - base;
      } else {
        subtotal  += price * qty;
        taxAmount += price * qty * (item.taxRate / 100);
      }
    });

    subtotal   = Math.round(subtotal * 100) / 100;
    taxAmount  = Math.round(taxAmount * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    const orderNumber = `ORD-${Date.now()}`;

    const order = await prisma.saasOrder.create({
      data: {
        orderNumber,
        organisationId: req.organisationId,
        customerId,
        items: enrichedItems,
        subtotal, taxAmount, total,
        billingAddressId: billingAddressId || null,
        shippingAddressId: shippingAddressId || null,
        notes: notes || null,
        source: source || 'api',
        externalOrderId: externalOrderId || null,
      },
    });

    fireWebhooks(req.organisationId, 'order.created', order);

    ok(res, order, 'Order created');
  } catch (e) { console.error(e); err(res, 'Server error', 500); }
});

router.get('/orders', apiKeyAuth, requirePermission('orders:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, paymentStatus } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      organisationId: req.organisationId,
      ...(status ? { status } : {}),
      ...(paymentStatus ? { paymentStatus } : {}),
    };

    const [orders, total] = await Promise.all([
      prisma.saasOrder.findMany({ where, skip, take: parseInt(limit), orderBy: { createdAt: 'desc' } }),
      prisma.saasOrder.count({ where }),
    ]);

    ok(res, { orders, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { err(res, 'Server error', 500); }
});

router.get('/orders/:id', apiKeyAuth, requirePermission('orders:read'), async (req, res) => {
  try {
    const order = await prisma.saasOrder.findFirst({ where: { id: req.params.id, organisationId: req.organisationId } });
    if (!order) return err(res, 'Order not found', 404);
    ok(res, order);
  } catch (e) { err(res, 'Server error', 500); }
});

router.patch('/orders/:id/status', apiKeyAuth, requirePermission('orders:write'), async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const VALID_STATUS = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED'];
    const VALID_PAY = ['UNPAID', 'PAID', 'PARTIAL', 'REFUNDED'];

    if (status && !VALID_STATUS.includes(status)) return err(res, `Invalid status. Valid: ${VALID_STATUS.join(', ')}`);
    if (paymentStatus && !VALID_PAY.includes(paymentStatus)) return err(res, `Invalid paymentStatus. Valid: ${VALID_PAY.join(', ')}`);

    const existing = await prisma.saasOrder.findFirst({ where: { id: req.params.id, organisationId: req.organisationId } });
    if (!existing) return err(res, 'Order not found', 404);

    const updated = await prisma.saasOrder.update({
      where: { id: req.params.id },
      data: {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
      },
    });

    fireWebhooks(req.organisationId, 'order.status_changed', { orderId: updated.id, status: updated.status, paymentStatus: updated.paymentStatus });

    ok(res, updated, 'Order status updated');
  } catch (e) { err(res, 'Server error', 500); }
});

// ─── 6. Invoice APIs ──────────────────────────────────────────────────────────

router.post('/invoices', apiKeyAuth, requirePermission('invoices:write'), async (req, res) => {
  try {
    const { customerId, billingAddressId, shippingAddressId, invoiceDate, dueDate, items = [], notes, orderId } = req.body;
    if (!customerId || items.length === 0) return err(res, 'customerId and items required');

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organisationId: req.organisationId },
      include: { addresses: true },
    });
    if (!customer) return err(res, 'Customer not found', 404);

    // Enrich items with product data if productId provided
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        let product = null;
        if (item.productId) {
          product = await prisma.product.findFirst({ where: { id: item.productId, organisationId: req.organisationId } });
        }
        const price = parseFloat(item.price ?? product?.price ?? 0);
        const taxRate = parseFloat(item.taxRate ?? product?.taxRate ?? 0);
        const qty = parseFloat(item.quantity) || 1;
        const taxInclusive = item.taxInclusive ?? product?.taxInclusive ?? false;

        let taxableAmount, taxAmount;
        if (taxInclusive) {
          taxableAmount = (price * qty) / (1 + taxRate / 100);
          taxAmount = price * qty - taxableAmount;
        } else {
          taxableAmount = price * qty;
          taxAmount = taxableAmount * (taxRate / 100);
        }

        taxableAmount = Math.round(taxableAmount * 100) / 100;
        taxAmount     = Math.round(taxAmount * 100) / 100;

        // CGST/SGST vs IGST per item (determined later by org/customer state)
        // Pass 0 defaults — will be overridden below after state check
        return {
          productId: item.productId || null,
          description: item.name || product?.name || 'Item',
          hsnSac: item.hsnCode || product?.hsnCode || product?.sacCode || null,
          quantity: qty,
          rate: price,
          taxRate,
          taxInclusive,
          unit: item.unit || product?.unit || 'PCS',
          amount: taxableAmount,
          taxAmount,
          cgst: 0,
          sgst: 0,
          igst: 0,
          costPrice: product?.costPrice || 0,
        };
      })
    );

    const subtotal = enrichedItems.reduce((s, i) => s + i.amount, 0);
    const totalTax = enrichedItems.reduce((s, i) => s + i.taxAmount, 0);
    const total    = Math.round((subtotal + totalTax) * 100) / 100;

    const org = await prisma.organisation.findUnique({ where: { id: req.organisationId } });
    const billing = billingAddressId
      ? customer.addresses.find((a) => a.id === billingAddressId)
      : customer.addresses.find((a) => a.isDefault) || customer.addresses[0];

    const counter = org.invoiceCounter;
    const year = new Date().getFullYear();
    const invoiceNumber = (org.invoiceFormat || '{PREFIX}/{YY}-{YY+1}/{###}')
      .replace('{PREFIX}', org.invoicePrefix || 'INV')
      .replace('{YY+1}', String(year + 1).slice(-2))
      .replace('{YY}', String(year).slice(-2))
      .replace('{YYYY}', String(year))
      .replace('{###}', String(counter).padStart(3, '0'))
      .replace('{####}', String(counter).padStart(4, '0'));

    const isInterState = org.state && billing?.state && org.state !== billing.state;
    const cgst = isInterState ? 0 : totalTax / 2;
    const sgst = isInterState ? 0 : totalTax / 2;
    const igst = isInterState ? totalTax : 0;

    // Apply per-item cgst/sgst/igst split
    const finalItems = enrichedItems.map((item) => ({
      ...item,
      cgst: isInterState ? 0 : Math.round((item.taxAmount / 2) * 100) / 100,
      sgst: isInterState ? 0 : Math.round((item.taxAmount / 2) * 100) / 100,
      igst: isInterState ? Math.round(item.taxAmount * 100) / 100 : 0,
    }));

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
        placeOfSupply: billing?.state || org.state || '',
        subtotal: Math.round(subtotal * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        cgst: Math.round(cgst * 100) / 100,
        sgst: Math.round(sgst * 100) / 100,
        igst: Math.round(igst * 100) / 100,
        total,
        paymentStatus: 'UNPAID',
        notes: notes || null,
        items: { create: finalItems },
      },
      include: { items: true, customer: true },
    });

    await prisma.organisation.update({
      where: { id: req.organisationId },
      data: { invoiceCounter: { increment: 1 } },
    });

    // Link order to invoice if orderId provided
    if (orderId) {
      await prisma.saasOrder.update({
        where: { id: orderId },
        data: { invoiceId: invoice.id },
      }).catch(() => {});
    }

    fireWebhooks(req.organisationId, 'invoice.created', { id: invoice.id, invoiceNumber, total, customerId });

    ok(res, invoice, 'Invoice created');
  } catch (e) { console.error(e); err(res, 'Server error', 500); }
});

router.get('/invoices', apiKeyAuth, requirePermission('invoices:read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { organisationId: req.organisationId, ...(status ? { paymentStatus: status } : {}) },
        skip, take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true, email: true } } },
      }),
      prisma.invoice.count({ where: { organisationId: req.organisationId } }),
    ]);

    ok(res, { invoices, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (e) { err(res, 'Server error', 500); }
});

router.get('/invoices/:id', apiKeyAuth, requirePermission('invoices:read'), async (req, res) => {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, organisationId: req.organisationId },
      include: { customer: { include: { addresses: true } }, items: true },
    });
    if (!invoice) return err(res, 'Invoice not found', 404);
    ok(res, invoice);
  } catch (e) { err(res, 'Server error', 500); }
});

// ─── 7. Webhook Management ────────────────────────────────────────────────────

const VALID_EVENTS = [
  'invoice.created', 'invoice.paid', 'invoice.cancelled',
  'order.created', 'order.status_changed',
  'inventory.low_stock', 'inventory.out_of_stock',
];

router.post('/webhooks', apiKeyAuth, requirePermission('webhooks:write'), async (req, res) => {
  try {
    const { url, events = [], secret } = req.body;
    if (!url || events.length === 0) return err(res, 'url and events required');

    const invalid = events.filter((e) => !VALID_EVENTS.includes(e));
    if (invalid.length > 0) return err(res, `Invalid events: ${invalid.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`);

    const webhook = await prisma.webhookConfig.create({
      data: {
        url,
        events,
        organisationId: req.organisationId,
        secret: secret || crypto.randomBytes(16).toString('hex'),
      },
    });

    ok(res, webhook, 'Webhook registered. Keep the secret to verify signatures.');
  } catch (e) { err(res, 'Server error', 500); }
});

router.get('/webhooks', apiKeyAuth, requirePermission('webhooks:write'), async (req, res) => {
  try {
    const hooks = await prisma.webhookConfig.findMany({ where: { organisationId: req.organisationId } });
    ok(res, hooks);
  } catch (e) { err(res, 'Server error', 500); }
});

router.delete('/webhooks/:id', apiKeyAuth, requirePermission('webhooks:write'), async (req, res) => {
  try {
    await prisma.webhookConfig.updateMany({
      where: { id: req.params.id, organisationId: req.organisationId },
      data: { active: false },
    });
    ok(res, null, 'Webhook disabled');
  } catch (e) { err(res, 'Server error', 500); }
});

router.get('/webhooks/:id/deliveries', apiKeyAuth, requirePermission('webhooks:write'), async (req, res) => {
  try {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { webhookConfigId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    ok(res, deliveries);
  } catch (e) { err(res, 'Server error', 500); }
});

module.exports = router;
