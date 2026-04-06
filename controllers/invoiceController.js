const prisma = require('../config/prisma');
const axios = require('axios');
const { sendInvoiceEmailAuto } = require('./emailHelpers');
const stockService = require('../services/stockService');
const costService = require('../services/costService');
const { generateDocumentNumber } = require('../utils/documentNumberGenerator');

const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://localhost:3001';

// Wake up Gotenberg service
const wakeUpGotenberg = async () => {
  try {
    await axios.get(`${GOTENBERG_URL}/health`, { timeout: 5000 });
  } catch (err) {
    console.log('Waking up PDF service...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    await axios.get(`${GOTENBERG_URL}/health`, { timeout: 15000 }).catch(() => {});
  }
};

exports.createInvoice = async (req, res) => {
  try {
    // Wake up Gotenberg in background (non-blocking)
    wakeUpGotenberg().catch(() => {});
    const {
      customerId,
      organisationId: requestedOrgId,
      billingAddressId,
      shippingAddressId,
      invoiceDate,
      dueDate,
      items,
      notes,
      placeOfSupply,
      reverseCharge,
      invoiceType,
      invoiceCopyType,
      termsConditions,
      declaration,
      paymentInstructions,
      deliveryInstructions,
      returnPolicy,
      lateFeePolicy,
      warrantyInfo,
      supportContact,
      modeOfDelivery,
      vehicleNumber,
      transportName,
      lrNumber,
      ewayBillNumber,
      placeOfDelivery,
      deliveryDate,
      freightTerms,
      paymentMethod,
      paymentTerms,
      deliveryCharges,
      freightCharges,
      otherCharges,
      deliveryChargesTaxRate,
      freightChargesTaxRate,
      otherChargesTaxRate,
      sendEmail = false
    } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ success: false, error: 'No organisation found' });
    }

    // Use requested organisationId if provided and it belongs to this user, else fall back to first
    let organisation;
    if (requestedOrgId) {
      organisation = organisations.find(o => o.id === requestedOrgId)
        || await prisma.organisation.findFirst({ where: { id: requestedOrgId, userId: req.userId } });
      if (!organisation) {
        return res.status(403).json({ success: false, error: 'Organisation not found or access denied' });
      }
    } else {
      organisation = organisations[0];
    }
    const organisationId = organisation.id;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organisationId }
    });

    if (!customer) {
      return res.status(400).json({ success: false, error: 'Customer not found' });
    }

    let billingAddress = null;
    if (billingAddressId) {
      billingAddress = await prisma.address.findFirst({
        where: { id: billingAddressId, customerId }
      });
      if (!billingAddress) {
        return res.status(400).json({ success: false, error: 'Billing address not found' });
      }
    }

    if (shippingAddressId) {
      const address = await prisma.address.findFirst({
        where: { id: shippingAddressId, customerId }
      });
      if (!address) {
        return res.status(400).json({ success: false, error: 'Shipping address not found' });
      }
    }

    for (const item of items) {
      const product = await prisma.product.findFirst({
        where: { id: item.productId, organisationId }
      });
      if (!product) {
        return res.status(400).json({ success: false, error: `Product ${item.productId} not found` });
      }
    }

    const orgState = organisation.state || '';
    const billState = billingAddress?.state || '';
    const isInterstate = orgState && billState && orgState !== billState;

    // Generate document number based on invoice type
    let prefix, counter, format, counterField;
    
    switch (invoiceType) {
      case 'DELIVERY_CHALLAN':
        prefix = organisation.challanPrefix || 'DC';
        counter = organisation.challanCounter || 1;
        format = organisation.challanFormat || '{PREFIX}/{YY}-{YY+1}/{###}';
        counterField = 'challanCounter';
        break;
      case 'TAX_INVOICE':
      case 'BILL_OF_SUPPLY':
      case 'PROFORMA':
      default:
        prefix = organisation.invoicePrefix || 'INV';
        counter = organisation.invoiceCounter || 1;
        format = organisation.invoiceFormat || '{PREFIX}/{YY}-{YY+1}/{###}';
        counterField = 'invoiceCounter';
        break;
    }
    
    const invoiceNumber = generateDocumentNumber(format, prefix, counter);
    
    // Update counter
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { [counterField]: counter + 1 }
    });

    let calculatedSubtotal = 0;
    let calculatedTotalTax = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const validatedItems = await Promise.all(items.map(async item => {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      
      // Allow custom rate per invoice item (flexible pricing)
      const itemRate = item.rate;
      const itemTaxRate = item.taxRate;
      const isTaxInclusive = item.taxInclusive !== undefined ? item.taxInclusive : false;
      
      let itemAmount, itemTaxAmount;
      
      if (isTaxInclusive) {
        // Price includes tax - extract tax from total
        const totalWithTax = item.quantity * itemRate;
        itemAmount = totalWithTax / (1 + itemTaxRate / 100);
        itemTaxAmount = totalWithTax - itemAmount;
      } else {
        // Price excludes tax - add tax on top
        itemAmount = item.quantity * itemRate;
        itemTaxAmount = itemAmount * (itemTaxRate / 100);
      }
      
      calculatedSubtotal += itemAmount;
      calculatedTotalTax += itemTaxAmount;

      let cgst = 0, sgst = 0, igst = 0;
      if (isInterstate) {
        igst = itemTaxAmount;
        totalIGST += igst;
      } else {
        cgst = itemTaxAmount / 2;
        sgst = itemTaxAmount / 2;
        totalCGST += cgst;
        totalSGST += sgst;
      }

      // Get moving average cost for profit calculation
      const costPrice = product?.avgCost || 0;
      const profit = (itemRate - costPrice) * item.quantity;

      return {
        productId: item.productId,
        description: item.description,
        hsnSac: item.hsnSac || product?.hsnCode || product?.sacCode || '',
        quantity: item.quantity,
        unit: item.unit || product?.unit || 'PCS',
        rate: itemRate,
        discount: item.discount || 0,
        taxRate: itemTaxRate,
        taxInclusive: isTaxInclusive,
        cgst,
        sgst,
        igst,
        amount: itemAmount,
        taxAmount: itemTaxAmount,
        costPrice,
        profit
      };
    }));

    // Calculate tax on extra charges
    const deliveryTax = (deliveryCharges || 0) * ((deliveryChargesTaxRate || 0) / 100);
    const freightTax = (freightCharges || 0) * ((freightChargesTaxRate || 0) / 100);
    const otherTax = (otherCharges || 0) * ((otherChargesTaxRate || 0) / 100);
    const totalChargesTax = deliveryTax + freightTax + otherTax;
    
    if (totalChargesTax > 0) {
      if (isInterstate) {
        totalIGST += totalChargesTax;
      } else {
        totalCGST += totalChargesTax / 2;
        totalSGST += totalChargesTax / 2;
      }
      calculatedTotalTax += totalChargesTax;
    }

    const extraCharges = (deliveryCharges || 0) + (freightCharges || 0) + (otherCharges || 0);
    const calculatedTotal = calculatedSubtotal + calculatedTotalTax + extraCharges;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: invoiceType || 'TAX_INVOICE',
        invoiceCopyType: invoiceCopyType || 'ORIGINAL',
        customerId,
        billingAddressId,
        shippingAddressId,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : new Date(new Date(invoiceDate).getTime() + 30 * 24 * 60 * 60 * 1000),
        placeOfSupply: placeOfSupply || billState,
        reverseCharge: reverseCharge || false,
        subtotal: calculatedSubtotal,
        cgst: totalCGST,
        sgst: totalSGST,
        igst: totalIGST,
        deliveryCharges: deliveryCharges || 0,
        freightCharges: freightCharges || 0,
        otherCharges: otherCharges || 0,
        deliveryChargesTax: deliveryTax,
        freightChargesTax: freightTax,
        otherChargesTax: otherTax,
        totalTax: calculatedTotalTax,
        total: calculatedTotal,
        balanceAmount: calculatedTotal,
        notes,
        termsConditions,
        declaration,
        paymentInstructions,
        deliveryInstructions,
        returnPolicy,
        lateFeePolicy,
        warrantyInfo,
        supportContact,
        modeOfDelivery: modeOfDelivery || 'IN_HAND',
        vehicleNumber,
        transportName,
        lrNumber,
        ewayBillNumber,
        placeOfDelivery,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        freightTerms: freightTerms || 'PAID',
        paymentMethod,
        paymentTerms: paymentTerms || 'NET_30',
        status: 'DRAFT',
        organisationId,
        items: {
          create: validatedItems
        }
      },
      include: {
        items: true,
        customer: true
      }
    });

    // Reduce stock quantities for sold items
    try {
      await stockService.updateStockOnSale(validatedItems, organisationId, invoice.id);
    } catch (stockError) {
      // If stock update fails, delete the invoice and related items
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.invoice.delete({ where: { id: invoice.id } });
      throw new Error(`Stock update failed: ${stockError.message}`);
    }

    res.json({ success: true, data: invoice });

    // Send email asynchronously (non-blocking) only if requested
    if (sendEmail && customer.email) {
      sendInvoiceEmailAuto(req.userId, {
        invoiceId: invoice.id,
        customerName: customer.name,
        customerEmail: customer.email,
        companyName: organisation.name,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString('en-IN'),
        dueDate: new Date(invoice.dueDate).toLocaleDateString('en-IN'),
        total: invoice.total,
        id: invoice.id,
      }).catch(err => console.error('Failed to send invoice email:', err));
    }
  } catch (error) {
    console.error('Invoice creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create invoice', details: error.message });
  }
};

exports.getInvoices = async (req, res) => {
  let organisationId =  req.query.organisationId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [], pagination: { page: 1, limit, total: 0, totalPages: 0 } });
    }

    const orgId = organisationId ?? organisations[0].id;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { organisationId: orgId },
        include: {
          items: true,
          customer: true,
          creditNotes: { where: { status: { not: 'CANCELLED' } } },
          debitNotes: { where: { status: { not: 'CANCELLED' } } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.invoice.count({ where: { organisationId: orgId } })
    ]);

    res.json({ 
      success: true, 
      data: invoices,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoices', details: error.message });
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedOrgId = req.query.organisationId;

    // Verify org belongs to user
    const orgWhere = requestedOrgId
      ? { id: requestedOrgId, userId: req.userId }
      : { userId: req.userId };
    const organisation = await prisma.organisation.findFirst({ where: orgWhere });

    if (!organisation) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id, organisationId: organisation.id },
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: {
          include: {
            addresses: true
          }
        },
        creditNotes: {
          where: { status: { not: 'CANCELLED' } },
          include: { items: true }
        },
        debitNotes: {
          where: { status: { not: 'CANCELLED' } },
          include: { items: true }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch invoice', details: error.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const requestedOrgId = req.query.organisationId || req.body.organisationId;

    const orgWhere = requestedOrgId
      ? { id: requestedOrgId, userId: req.userId }
      : { userId: req.userId };
    const organisation = await prisma.organisation.findFirst({ where: orgWhere });

    if (!organisation) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const organisationId = organisation.id;

    // Fetch the invoice with items
    const invoice = await prisma.invoice.findFirst({
      where: { id, organisationId },
      include: {
        items: true
      }
    });

    if (!invoice) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    // Restore stock quantities before deleting the invoice
    try {
      await stockService.reverseStockOnSaleDelete(invoice.items, organisationId, invoice.id);
    } catch (stockError) {
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to restore stock', 
        details: stockError.message 
      });
    }

    // Delete invoice items first, then the invoice
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: id }
    });
    
    await prisma.invoice.delete({
      where: { id }
    });

    res.json({ success: true, message: 'Invoice deleted successfully' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete invoice', details: error.message });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { notes, termsConditions, declaration, paymentInstructions, dueDate, paymentMethod, paymentTerms, status } = req.body;

    const organisations = await prisma.organisation.findMany({ where: { userId: req.userId }, take: 1 });
    if (!organisations.length) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const invoice = await prisma.invoice.findFirst({
      where: { id, organisationId: organisations[0].id }
    });
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...(notes !== undefined && { notes }),
        ...(termsConditions !== undefined && { termsConditions }),
        ...(declaration !== undefined && { declaration }),
        ...(paymentInstructions !== undefined && { paymentInstructions }),
        ...(dueDate && { dueDate: new Date(dueDate) }),
        ...(paymentMethod && { paymentMethod }),
        ...(paymentTerms && { paymentTerms }),
        ...(status && { status }),
      },
      include: { items: { include: { product: true } }, customer: true }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to update invoice', details: error.message });
  }
};

exports.cancelInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const organisations = await prisma.organisation.findMany({ where: { userId: req.userId }, take: 1 });
    if (!organisations.length) return res.status(404).json({ success: false, error: 'Invoice not found' });

    const organisationId = organisations[0].id;
    const invoice = await prisma.invoice.findFirst({
      where: { id, organisationId },
      include: { items: true }
    });
    if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
    if (invoice.status === 'CANCELLED') return res.status(400).json({ success: false, error: 'Invoice is already cancelled' });

    // Restore stock
    try {
      await stockService.reverseStockOnSaleDelete(invoice.items, organisationId, invoice.id);
    } catch (e) {
      console.warn('[Cancel Invoice] Stock reversal warning:', e.message);
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Cancel invoice error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel invoice', details: error.message });
  }
};
