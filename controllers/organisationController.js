const prisma = require('../config/prisma');

exports.createOrganisation = async (req, res, next) => {
  try {
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
      email
    } = req.body;

    // Validate required fields
    if (!name || !address || !phone || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['name', 'address', 'phone', 'email']
      });
    }

    // Validate GSTIN format if provided
    if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GSTIN format',
        field: 'gstin'
      });
    }

    // Validate PAN format if provided
    if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PAN format',
        field: 'pan'
      });
    }

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
          success: false,
          error: 'Premium plan required for multiple businesses',
          requiresUpgrade: true,
          currentPlan: user.planTier || 'free',
          requiredPlan: 'premium',
          feature: 'multiple_businesses'
        });
      }
    }

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
        logo: req.body.logo,
        bankName: req.body.bankName,
        branch: req.body.branch,
        accountHolderName: req.body.accountHolderName,
        accountNumber: req.body.accountNumber,
        ifsc: req.body.ifsc,
        upi: req.body.upi,
        authorizedSignatory: req.body.authorizedSignatory,
        signatureUrl: req.body.signatureUrl,
        companySealUrl: req.body.companySealUrl,
        userId: req.userId
      }
    });

    res.json({ success: true, data: organisation });
  } catch (error) {
    next(error);
  }
};

exports.getOrganisations = async (req, res, next) => {
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
    next(error);
  }
};

exports.updateOrganisation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Validate GSTIN format if being updated
    if (updateData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(updateData.gstin)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid GSTIN format',
        field: 'gstin'
      });
    }

    // Validate PAN format if being updated
    if (updateData.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(updateData.pan)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid PAN format',
        field: 'pan'
      });
    }

    const organisation = await prisma.organisation.update({
      where: { id },
      data: updateData
    });

    res.json({ success: true, data: organisation });
  } catch (error) {
    next(error);
  }
};

exports.updateDocumentSettings = async (req, res, next) => {
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
    next(error);
  }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify organisation belongs to user
    const organisation = await prisma.organisation.findFirst({
      where: { id, userId: req.userId }
    });

    if (!organisation) {
      return res.status(404).json({ success: false, error: 'Organisation not found' });
    }

    let logoData = null;

    // Handle file upload
    if (req.file) {
      const base64 = req.file.buffer.toString('base64');
      logoData = `data:${req.file.mimetype};base64,${base64}`;
    } 
    // Handle base64 string from body
    else if (req.body.logo) {
      logoData = req.body.logo;
    } else {
      return res.status(400).json({ success: false, error: 'No logo provided' });
    }

    // Validate it's an image
    if (!logoData.startsWith('data:image/')) {
      return res.status(400).json({ success: false, error: 'Invalid image format' });
    }

    const updated = await prisma.organisation.update({
      where: { id },
      data: { logo: logoData }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteLogo = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify organisation belongs to user
    const organisation = await prisma.organisation.findFirst({
      where: { id, userId: req.userId }
    });

    if (!organisation) {
      return res.status(404).json({ success: false, error: 'Organisation not found' });
    }

    const updated = await prisma.organisation.update({
      where: { id },
      data: { logo: null }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
