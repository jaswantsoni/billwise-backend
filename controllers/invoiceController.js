const prisma = require('../config/prisma');

exports.createInvoice = async (req, res) => {
  try {
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
      packingCharges,
      otherCharges
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
    const lastInvoice = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: `INV-${year}-` } },
      orderBy: { createdAt: 'desc' }
    });

    let invoiceNumber;
    if (lastInvoice) {
      const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
      invoiceNumber = `INV-${year}-${String(lastNumber + 1).padStart(3, '0')}`;
    } else {
      invoiceNumber = `INV-${year}-001`;
    }

    let calculatedSubtotal = 0;
    let calculatedTotalTax = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const validatedItems = await Promise.all(items.map(async item => {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      const itemAmount = item.quantity * item.rate;
      const itemTaxAmount = itemAmount * (item.taxRate / 100);
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
        rate: item.rate,
        discount: item.discount || 0,
        taxRate: item.taxRate,
        cgst,
        sgst,
        igst,
        amount: itemAmount,
        taxAmount: itemTaxAmount
      };
    }));

    const calculatedTotal = calculatedSubtotal + calculatedTotalTax + (deliveryCharges || 0) + (packingCharges || 0) + (otherCharges || 0);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        invoiceType: invoiceType || 'TAX_INVOICE',
        invoiceCopyType: invoiceCopyType || 'ORIGINAL',
        customerId,
        billingAddressId,
        shippingAddressId,
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        placeOfSupply: placeOfSupply || billState,
        reverseCharge: reverseCharge || false,
        subtotal: calculatedSubtotal,
        cgst: totalCGST,
        sgst: totalSGST,
        igst: totalIGST,
        deliveryCharges: deliveryCharges || 0,
        packingCharges: packingCharges || 0,
        otherCharges: otherCharges || 0,
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
  } catch (error) {
    console.error('Invoice creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create invoice', details: error.message });
  }
};

exports.getInvoices = async (req, res) => {
  let organisationId =  req.query.organisationId;
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const invoices = await prisma.invoice.findMany({
      where: { organisationId: organisationId??organisations[0].id },
      include: {
        items: true,
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: invoices });
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
