const prisma = require('../config/prisma');
const { getLedger } = require('../services/ledgerService');

// GET /api/ledger?organisationId=&partyId=&partyType=&fromDate=&toDate=
exports.getLedger = async (req, res) => {
  try {
    const { partyId, partyType, fromDate, toDate } = req.query;
    let { organisationId } = req.query;

    if (!partyId || !partyType) {
      return res.status(400).json({ error: 'partyId and partyType are required' });
    }
    if (!['customer', 'supplier'].includes(partyType)) {
      return res.status(400).json({ error: 'partyType must be customer or supplier' });
    }

    // Resolve org
    if (organisationId) {
      const org = await prisma.organisation.findFirst({ where: { id: organisationId, userId: req.userId } });
      if (!org) return res.status(403).json({ error: 'Access denied' });
    } else {
      const org = await prisma.organisation.findFirst({ where: { userId: req.userId } });
      if (!org) return res.status(400).json({ error: 'No organisation found' });
      organisationId = org.id;
    }

    const result = await getLedger({ organisationId, partyId, partyType, fromDate, toDate });
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Ledger]', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/payments — record a payment
exports.createPayment = async (req, res) => {
  try {
    const { customerId, supplierId, amount, type, method, reference, notes, date, organisationId: reqOrgId } = req.body;

    if (!amount || !type || (!customerId && !supplierId)) {
      return res.status(400).json({ error: 'amount, type, and customerId or supplierId are required' });
    }
    if (!['RECEIVED', 'PAID'].includes(type)) {
      return res.status(400).json({ error: 'type must be RECEIVED or PAID' });
    }

    let organisationId;
    if (reqOrgId) {
      const org = await prisma.organisation.findFirst({ where: { id: reqOrgId, userId: req.userId } });
      if (!org) return res.status(403).json({ error: 'Access denied' });
      organisationId = org.id;
    } else {
      const org = await prisma.organisation.findFirst({ where: { userId: req.userId } });
      if (!org) return res.status(400).json({ error: 'No organisation found' });
      organisationId = org.id;
    }

    const payment = await prisma.payment.create({
      data: {
        organisationId,
        customerId: customerId || null,
        supplierId: supplierId || null,
        amount: parseFloat(amount),
        type,
        method: method || null,
        reference: reference || null,
        notes: notes || null,
        date: date ? new Date(date) : new Date(),
      }
    });

    res.json({ success: true, data: payment });
  } catch (err) {
    console.error('[Payment]', err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/payments?organisationId=&customerId=&supplierId=
exports.getPayments = async (req, res) => {
  try {
    const { customerId, supplierId } = req.query;
    let { organisationId } = req.query;

    if (organisationId) {
      const org = await prisma.organisation.findFirst({ where: { id: organisationId, userId: req.userId } });
      if (!org) return res.status(403).json({ error: 'Access denied' });
    } else {
      const org = await prisma.organisation.findFirst({ where: { userId: req.userId } });
      if (!org) return res.status(400).json({ error: 'No organisation found' });
      organisationId = org.id;
    }

    const where = { organisationId };
    if (customerId) where.customerId = customerId;
    if (supplierId) where.supplierId = supplierId;

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 100,
    });

    res.json({ success: true, data: payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/payments/:id
exports.deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    const org = await prisma.organisation.findFirst({ where: { id: payment.organisationId, userId: req.userId } });
    if (!org) return res.status(403).json({ error: 'Access denied' });

    await prisma.payment.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
