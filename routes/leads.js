const express = require('express');
const router = express.Router();
const prisma = require('../config/prisma');
const { authenticate } = require('../middleware/auth');

// GET /api/leads — list all leads (admin use)
// Query params: status, source, page, limit
router.get('/', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const skip = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.source) where.source = req.query.source;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true, email: true, name: true,
          businessName: true, gstin: true, phone: true,
          city: true, state: true,
          source: true, sourcePage: true,
          utmSource: true, utmMedium: true, utmCampaign: true,
          status: true, convertedAt: true, userId: true,
          marketingConsent: true, createdAt: true,
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ success: true, data: leads, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/leads/:id — update status
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        status: req.body.status,
        convertedAt: req.body.status === 'converted' ? new Date() : undefined,
      },
    });
    res.json({ success: true, data: lead });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leads/export — CSV export
router.get('/export', authenticate, async (req, res) => {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        email: true, name: true, businessName: true, gstin: true,
        phone: true, city: true, state: true, source: true,
        status: true, createdAt: true,
      },
    });

    const header = 'Email,Name,Business,GSTIN,Phone,City,State,Source,Status,Date\n';
    const rows = leads.map(l =>
      [l.email, l.name, l.businessName, l.gstin, l.phone, l.city, l.state, l.source, l.status,
        new Date(l.createdAt).toLocaleDateString('en-IN')].map(v => `"${v || ''}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="kampony-leads.csv"');
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
