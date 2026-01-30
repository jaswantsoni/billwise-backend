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
      subtotal,
      totalTax,
      total,
      notes
    } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ success: false, error: 'No organisation found' });
    }

    const organisationId = organisations[0].id;

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organisationId }
    });

    if (!customer) {
      return res.status(400).json({ success: false, error: 'Customer not found' });
    }

    if (billingAddressId) {
      const address = await prisma.address.findFirst({
        where: { id: billingAddressId, customerId }
      });
      if (!address) {
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

    const validatedItems = items.map(item => {
      const itemAmount = item.quantity * item.rate;
      const itemTaxAmount = itemAmount * (item.taxRate / 100);
      calculatedSubtotal += itemAmount;
      calculatedTotalTax += itemTaxAmount;

      return {
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        rate: item.rate,
        taxRate: item.taxRate,
        amount: itemAmount,
        taxAmount: itemTaxAmount
      };
    });

    const calculatedTotal = calculatedSubtotal + calculatedTotalTax;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId,
        billingAddressId,
        shippingAddressId,
        invoiceDate: new Date(invoiceDate),
        dueDate: new Date(dueDate),
        subtotal: calculatedSubtotal,
        totalTax: calculatedTotalTax,
        total: calculatedTotal,
        notes,
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
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const invoices = await prisma.invoice.findMany({
      where: { organisationId: organisations[0].id },
      include: {
        items: true,
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: invoices });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch invoices' });
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
    res.status(500).json({ success: false, error: 'Failed to fetch invoice' });
  }
};
