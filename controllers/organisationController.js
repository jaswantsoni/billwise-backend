const prisma = require('../config/prisma');

exports.createOrganisation = async (req, res) => {
  try {
    // Check existing organisations count
    const existingCount = await prisma.organisation.count({
      where: { userId: req.userId }
    });

    // First organisation is free, additional require Premium
    if (existingCount >= 1) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { planTier: true, planStatus: true, planExpiry: true }
      });

      const isPremium = user.planTier === 'premium' && 
                        user.planStatus === 'active' && 
                        (!user.planExpiry || new Date(user.planExpiry) > new Date());

      if (!isPremium) {
        return res.status(403).json({
          error: 'Premium plan required',
          requiresUpgrade: true,
          currentPlan: user.planTier || 'free',
          requiredPlan: 'premium',
          feature: 'multiple_businesses'
        });
      }
    }

    const { 
      name, 
      tradeName,
      gstin, 
      pan,
      address, 
      city,
      state,
      stateCode,
      pincode,
      phone, 
      email,
      logo,
      bankName,
      branch,
      accountHolderName,
      accountNumber,
      ifsc,
      upi,
      authorizedSignatory,
      signatureUrl,
      companySealUrl
    } = req.body;

    const organisation = await prisma.organisation.create({
      data: {
        name,
        tradeName,
        gstin,
        pan,
        address,
        city,
        state,
        stateCode,
        pincode,
        phone,
        email,
        logo,
        bankName,
        branch,
        accountHolderName,
        accountNumber,
        ifsc,
        upi,
        authorizedSignatory,
        signatureUrl,
        companySealUrl,
        userId: req.userId
      }
    });

    res.json({ success: true, data: organisation });
  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('gstin')) {
      return res.status(400).json({ error: 'GSTIN already registered with another organisation' });
    }
    res.status(500).json({ error: 'Failed to create organisation' });
  }
};

exports.getOrganisations = async (req, res) => {
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId }
    });

    // Auto-sync counters from last documents
    for (const org of organisations) {
      const year = new Date().getFullYear();
      const prefix = org.invoicePrefix || 'INV';
      
      const lastInvoice = await prisma.invoice.findFirst({
        where: { 
          organisationId: org.id,
          invoiceNumber: { startsWith: `${prefix}-${year}-` }
        },
        orderBy: { createdAt: 'desc' }
      });

      const lastCreditNote = await prisma.creditNote.findFirst({
        where: { 
          organisationId: org.id,
          noteNumber: { startsWith: `${org.creditNotePrefix || 'CN'}-${year}-` }
        },
        orderBy: { createdAt: 'desc' }
      });

      const lastDebitNote = await prisma.debitNote.findFirst({
        where: { 
          organisationId: org.id,
          noteNumber: { startsWith: `${org.debitNotePrefix || 'DN'}-${year}-` }
        },
        orderBy: { createdAt: 'desc' }
      });

      let needsUpdate = false;
      const updates = {};

      if (lastInvoice) {
        const lastNum = parseInt(lastInvoice.invoiceNumber.split('-')[2]) || 0;
        if (org.invoiceCounter <= lastNum) {
          updates.invoiceCounter = lastNum + 1;
          needsUpdate = true;
        }
      }

      if (lastCreditNote) {
        const lastNum = parseInt(lastCreditNote.noteNumber.split('-')[2]) || 0;
        if (org.creditNoteCounter <= lastNum) {
          updates.creditNoteCounter = lastNum + 1;
          needsUpdate = true;
        }
      }

      if (lastDebitNote) {
        const lastNum = parseInt(lastDebitNote.noteNumber.split('-')[2]) || 0;
        if (org.debitNoteCounter <= lastNum) {
          updates.debitNoteCounter = lastNum + 1;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await prisma.organisation.update({
          where: { id: org.id },
          data: updates
        });
        Object.assign(org, updates);
      }
    }

    res.json({ success: true, data: organisations });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch organisations' });
  }
};

exports.updateOrganisation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const organisation = await prisma.organisation.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: organisation });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update organisation' });
  }
};

exports.updateDocumentSettings = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoicePrefix, invoiceCounter, creditNotePrefix, creditNoteCounter, debitNotePrefix, debitNoteCounter } = req.body;

    const organisation = await prisma.organisation.findFirst({
      where: { id, userId: req.userId }
    });

    if (!organisation) {
      return res.status(404).json({ success: false, error: 'Organisation not found' });
    }

    const updated = await prisma.organisation.update({
      where: { id },
      data: {
        invoicePrefix,
        invoiceCounter,
        creditNotePrefix,
        creditNoteCounter,
        debitNotePrefix,
        debitNoteCounter
      }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update document settings error:', error);
    res.status(500).json({ success: false, error: 'Failed to update document settings', details: error.message });
  }
};
