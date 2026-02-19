const prisma = require('../config/prisma');
const axios = require('axios');
const { sendInvoiceEmailAuto } = require('./emailHelpers');

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
      otherChargesTaxRate
    } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ success: false, error: 'No organisation found' });
    }

    const organisationId = organisations[0].id;
    const organisation = organisations[0];

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

    const year = new Date().getFullYear();
    const prefix = organisation.invoicePrefix || 'INV';
    const counter = organisation.invoiceCounter || 1;
    const invoiceNumber = `${prefix}-${year}-${String(counter).padStart(3, '0')}`;
    
    // Update counter
    await prisma.organisation.update({
      where: { id: organisationId },
      data: { invoiceCounter: counter + 1 }
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
        taxAmount: itemTaxAmount
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

    res.json({ success: true, data: invoice });

    // Send email asynchronously (non-blocking)
    if (customer.email) {
      sendInvoiceEmailAuto(req.userId, {
        invoiceId: invoice.id,
        customerName: customer.name,
        customerEmail: customer.email,
        companyName: organisation.name,
        invoiceNumber: invoice.invoiceNumber,
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

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ success: false, error: 'Invoice not found' });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id, organisationId: organisations[0].id },
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
