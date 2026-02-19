const prisma = require('../config/prisma');

exports.getTemplates = async (req, res) => {
  try {
    const { category, linkedToBilling } = req.query;
    const where = { OR: [{ userId: req.userId }, { isPublic: true }] };
    if (category) where.category = category;
    if (linkedToBilling === 'true') where.linkedToBilling = true;

    const templates = await prisma.mailTemplate.findMany({ where, orderBy: { updatedAt: 'desc' } });
    res.json({ templates });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const template = await prisma.mailTemplate.findFirst({
      where: { id: req.params.id, OR: [{ userId: req.userId }, { isPublic: true }] },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch template' });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, subject, category, preview, tags, blocks, htmlContent, variables, isPublic, linkedToBilling, billingType } = req.body;
    const template = await prisma.mailTemplate.create({
      data: { name, subject, category, preview, tags: tags || [], blocks, htmlContent, variables, isPublic: isPublic || false, linkedToBilling: linkedToBilling || false, billingType, userId: req.userId },
    });
    res.status(201).json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const existing = await prisma.mailTemplate.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const template = await prisma.mailTemplate.update({ where: { id: req.params.id }, data: req.body });
    res.json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update template' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const existing = await prisma.mailTemplate.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.mailTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

exports.duplicateTemplate = async (req, res) => {
  try {
    const original = await prisma.mailTemplate.findFirst({
      where: { id: req.params.id, OR: [{ userId: req.userId }, { isPublic: true }] },
    });
    if (!original) return res.status(404).json({ error: 'Template not found' });

    const template = await prisma.mailTemplate.create({
      data: { ...original, id: undefined, name: `${original.name} (Copy)`, userId: req.userId, isPublic: false, linkedToBilling: false },
    });
    res.status(201).json({ template });
  } catch (error) {
    res.status(500).json({ error: 'Failed to duplicate template' });
  }
};
