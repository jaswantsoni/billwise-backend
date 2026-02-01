const prisma = require('../config/prisma');

exports.createPurchase = async (req, res) => {
  try {
    const {
      supplierId,
      purchaseDate,
      dueDate,
      billNumber,
      items,
      placeOfSupply,
      reverseCharge,
      otherCharges,
      notes
    } = req.body;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(400).json({ error: 'No organisation found' });
    }

    const organisationId = organisations[0].id;
    const organisation = organisations[0];

    // Verify supplier
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, organisationId }
    });

    if (!supplier) {
      return res.status(400).json({ error: 'Supplier not found' });
    }

    // Determine if interstate
    const orgState = organisation.state || '';
    const supplierState = supplier.state || '';
    const isInterstate = orgState && supplierState && orgState !== supplierState;

    // Generate purchase number
    const year = new Date().getFullYear();
    const lastPurchase = await prisma.purchase.findFirst({
      where: { purchaseNumber: { startsWith: `PUR-${year}-` } },
      orderBy: { createdAt: 'desc' }
    });

    let purchaseNumber;
    if (lastPurchase) {
      const lastNumber = parseInt(lastPurchase.purchaseNumber.split('-')[2]);
      purchaseNumber = `PUR-${year}-${String(lastNumber + 1).padStart(3, '0')}`;
    } else {
      purchaseNumber = `PUR-${year}-001`;
    }

    // Calculate totals
    let calculatedSubtotal = 0;
    let calculatedTotalTax = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const validatedItems = await Promise.all(items.map(async item => {
      const product = await prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const itemAmount = item.quantity * item.rate - (item.discount || 0);
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
        description: item.description || product.name,
        hsnSac: item.hsnSac || product.hsnCode || product.sacCode || '',
        quantity: item.quantity,
        unit: item.unit || product.unit,
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

    const calculatedTotal = calculatedSubtotal + calculatedTotalTax + (otherCharges || 0);

    // Create purchase with transaction
    const purchase = await prisma.$transaction(async (tx) => {
      const newPurchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId,
          purchaseDate: new Date(purchaseDate),
          dueDate: dueDate ? new Date(dueDate) : null,
          billNumber,
          placeOfSupply: placeOfSupply || supplierState,
          reverseCharge: reverseCharge || false,
          subtotal: calculatedSubtotal,
          cgst: totalCGST,
          sgst: totalSGST,
          igst: totalIGST,
          otherCharges: otherCharges || 0,
          totalTax: calculatedTotalTax,
          total: calculatedTotal,
          balanceAmount: calculatedTotal,
          notes,
          status: 'COMPLETED',
          organisationId,
          items: {
            create: validatedItems
          }
        },
        include: {
          items: true,
          supplier: true
        }
      });

      // Update stock for each item
      for (const item of validatedItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        const newStock = product.stock + item.quantity;

        await tx.product.update({
          where: { id: item.productId },
          data: { 
            stock: newStock,
            totalPurchased: product.totalPurchased + item.quantity
          }
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            type: 'IN',
            quantity: item.quantity,
            reference: purchaseNumber,
            referenceId: newPurchase.id,
            notes: `Purchase from ${supplier.name}`,
            balanceAfter: newStock
          }
        });
      }

      return newPurchase;
    });

    res.json({ success: true, data: purchase });
  } catch (error) {
    console.error('Purchase creation error:', error);
    res.status(500).json({ error: 'Failed to create purchase', details: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.json({ success: true, data: [] });
    }

    const purchases = await prisma.purchase.findMany({
      where: { organisationId: organisations[0].id },
      include: {
        supplier: true,
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: purchases });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
};

exports.getPurchase = async (req, res) => {
  try {
    const { id } = req.params;

    const organisations = await prisma.organisation.findMany({
      where: { userId: req.userId },
      take: 1
    });

    if (!organisations.length) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id, organisationId: organisations[0].id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    res.json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
};

exports.getStockMovements = async (req, res) => {
  try {
    const { productId } = req.params;

    const movements = await prisma.stockMovement.findMany({
      where: { productId },
      include: { product: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: movements });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
};
