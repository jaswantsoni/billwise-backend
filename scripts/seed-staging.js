/**
 * Seed script for staging demo data
 * User: jaswant soni (69dbdc9d4fa75d3f89fb18bd)
 * Org: PLUTO ELECTRICA (69dbdcc64fa75d3f89fb18c0)
 */
process.env.DATABASE_URL = 'mongodb+srv://hrconnect:BhhzaYpiVQ5AFG@cluster0.q8twacw.mongodb.net/Biller-staging?appName=Cluster0';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const ORG_ID = '69dbdcc64fa75d3f89fb18c0';
const USER_ID = '69dbdc9d4fa75d3f89fb18bd';

function d(daysAgo) {
  const dt = new Date();
  dt.setDate(dt.getDate() - daysAgo);
  return dt;
}

async function main() {
  console.log('🌱 Seeding staging data...');

  // ─── Products ────────────────────────────────────────────────────
  console.log('Creating products...');
  const products = await Promise.all([
    prisma.product.create({ data: { name: 'LED Bulb 9W', sku: 'LED-9W-001', description: 'Energy saving LED bulb 9W', hsnCode: '8539', unit: 'PCS', price: 85, purchasePrice: 45, taxRate: 12, stockQuantity: 500, minStock: 50, avgCost: 45, organisationId: ORG_ID } }),
    prisma.product.create({ data: { name: 'MCB 32A Single Pole', sku: 'MCB-32A-SP', description: 'Miniature Circuit Breaker 32A', hsnCode: '8536', unit: 'PCS', price: 320, purchasePrice: 180, taxRate: 18, stockQuantity: 200, minStock: 20, avgCost: 180, organisationId: ORG_ID } }),
    prisma.product.create({ data: { name: 'PVC Wire 1.5mm 90m', sku: 'WIRE-1.5-90', description: 'PVC insulated copper wire 1.5mm', hsnCode: '8544', unit: 'ROLL', price: 1250, purchasePrice: 850, taxRate: 18, stockQuantity: 80, minStock: 10, avgCost: 850, organisationId: ORG_ID } }),
    prisma.product.create({ data: { name: 'Ceiling Fan 48"', sku: 'FAN-48-001', description: 'Energy efficient ceiling fan 48 inch', hsnCode: '8414', unit: 'PCS', price: 2800, purchasePrice: 1800, taxRate: 18, stockQuantity: 30, minStock: 5, avgCost: 1800, organisationId: ORG_ID } }),
    prisma.product.create({ data: { name: 'Distribution Board 8-way', sku: 'DB-8W-001', description: 'MCB distribution board 8 way', hsnCode: '8537', unit: 'PCS', price: 1800, purchasePrice: 1100, taxRate: 18, stockQuantity: 25, minStock: 5, avgCost: 1100, organisationId: ORG_ID } }),
    prisma.product.create({ data: { name: 'Switch Socket 5A', sku: 'SW-5A-001', description: 'Modular switch socket 5A', hsnCode: '8536', unit: 'PCS', price: 95, purchasePrice: 55, taxRate: 18, stockQuantity: 400, minStock: 50, avgCost: 55, organisationId: ORG_ID } }),
    prisma.product.create({ data: { name: 'Exhaust Fan 6"', sku: 'EXH-6-001', description: 'Exhaust fan 6 inch 150mm', hsnCode: '8414', unit: 'PCS', price: 650, purchasePrice: 400, taxRate: 18, stockQuantity: 45, minStock: 10, avgCost: 400, organisationId: ORG_ID } }),
    prisma.product.create({ data: { name: 'Wiring Installation', sku: 'SVC-WIRE-001', description: 'Electrical wiring installation service', sacCode: '995461', unit: 'NOS', price: 5000, purchasePrice: 0, taxRate: 18, stockQuantity: 0, minStock: 0, avgCost: 0, organisationId: ORG_ID } }),
  ]);
  console.log(`✅ ${products.length} products created`);

  // ─── Customers ───────────────────────────────────────────────────
  console.log('Creating customers...');
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'Sharma Constructions Pvt Ltd', gstin: '06AABCS1234A1Z5', email: 'accounts@sharmaconstructions.com', phone: '9876543210', organisationId: ORG_ID, addresses: { create: [{ type: 'billing', line1: '45 Industrial Area Phase 2', city: 'Gurugram', state: 'Haryana', pincode: '122001', country: 'India', isDefault: true, isShipping: false }] } } }),
    prisma.customer.create({ data: { name: 'Rajesh Electricals', gstin: '07AABCR5678B1Z3', email: 'rajesh@rajeshelectricals.in', phone: '9812345678', organisationId: ORG_ID, addresses: { create: [{ type: 'billing', line1: 'Shop 12, Lajpat Nagar Market', city: 'New Delhi', state: 'Delhi', pincode: '110024', country: 'India', isDefault: true, isShipping: false }] } } }),
    prisma.customer.create({ data: { name: 'Metro Infra Projects', gstin: '06AABCM9012C1Z1', email: 'billing@metroinfra.com', phone: '9988776655', organisationId: ORG_ID, addresses: { create: [{ type: 'billing', line1: 'Tower B, Cyber City', city: 'Gurugram', state: 'Haryana', pincode: '122002', country: 'India', isDefault: true, isShipping: false }] } } }),
    prisma.customer.create({ data: { name: 'Sunita Devi (Retail)', gstin: '', email: '', phone: '9654321098', organisationId: ORG_ID, addresses: { create: [{ type: 'billing', line1: 'H-45 Sector 7', city: 'Faridabad', state: 'Haryana', pincode: '121006', country: 'India', isDefault: true, isShipping: false }] } } }),
  ]);
  console.log(`✅ ${customers.length} customers created`);

  // ─── Supplier ────────────────────────────────────────────────────
  console.log('Creating supplier...');
  const supplier = await prisma.supplier.create({
    data: { name: 'Havells India Ltd', gstin: '07AAACH1234D1Z2', mobile: '1800-103-1313', email: 'dealer@havells.com', address: 'QRG Towers, 2D, Sector 126', city: 'Noida', state: 'Uttar Pradesh', pincode: '201304', openingBalance: 0, paymentTerms: 'NET_30', organisationId: ORG_ID }
  });
  console.log('✅ Supplier created');

  // ─── Helper: get address id ───────────────────────────────────────
  const getAddr = async (customerId) => {
    const addrs = await prisma.address.findMany({ where: { customerId }, take: 1 });
    return addrs[0]?.id || null;
  };

  // ─── Invoices ────────────────────────────────────────────────────
  console.log('Creating invoices...');
  const inv1Addr = await getAddr(customers[0].id);
  const inv2Addr = await getAddr(customers[1].id);
  const inv3Addr = await getAddr(customers[2].id);
  const inv4Addr = await getAddr(customers[3].id);

  const invoices = [];

  // Invoice 1 — Sharma Constructions (intrastate Haryana)
  const i1 = await prisma.invoice.create({ data: {
    invoiceNumber: 'PE/25-26/001', invoiceType: 'TAX_INVOICE', invoiceCopyType: 'ORIGINAL',
    customerId: customers[0].id, billingAddressId: inv1Addr, shippingAddressId: inv1Addr,
    invoiceDate: d(45), dueDate: d(15), placeOfSupply: 'Haryana', reverseCharge: false,
    subtotal: 28000, cgst: 2520, sgst: 2520, igst: 0, totalTax: 5040, total: 33040,
    paymentStatus: 'PAID', paidAmount: 33040, balanceAmount: 0, status: 'ISSUED',
    paymentMethod: 'NEFT', paymentTerms: 'NET_30', organisationId: ORG_ID,
    items: { create: [
      { productId: products[3].id, description: 'Ceiling Fan 48"', hsnSac: '8414', quantity: 5, unit: 'PCS', rate: 2800, taxRate: 18, cgst: 1260, sgst: 1260, igst: 0, amount: 14000, taxAmount: 2520, costPrice: 1800, profit: 5000 },
      { productId: products[4].id, description: 'Distribution Board 8-way', hsnSac: '8537', quantity: 4, unit: 'PCS', rate: 1800, taxRate: 18, cgst: 648, sgst: 648, igst: 0, amount: 7200, taxAmount: 1296, costPrice: 1100, profit: 2800 },
      { productId: products[5].id, description: 'Switch Socket 5A', hsnSac: '8536', quantity: 80, unit: 'PCS', rate: 95, taxRate: 18, cgst: 684, sgst: 684, igst: 0, amount: 7600, taxAmount: 1368, costPrice: 55, profit: 3200 },
    ]}
  }});
  invoices.push(i1);

  // Invoice 2 — Rajesh Electricals (interstate Delhi)
  const i2 = await prisma.invoice.create({ data: {
    invoiceNumber: 'PE/25-26/002', invoiceType: 'TAX_INVOICE', invoiceCopyType: 'ORIGINAL',
    customerId: customers[1].id, billingAddressId: inv2Addr, shippingAddressId: inv2Addr,
    invoiceDate: d(38), dueDate: d(8), placeOfSupply: 'Delhi', reverseCharge: false,
    subtotal: 12750, cgst: 0, sgst: 0, igst: 2295, totalTax: 2295, total: 15045,
    paymentStatus: 'PARTIAL', paidAmount: 10000, balanceAmount: 5045, status: 'ISSUED',
    paymentTerms: 'NET_30', organisationId: ORG_ID,
    items: { create: [
      { productId: products[0].id, description: 'LED Bulb 9W', hsnSac: '8539', quantity: 100, unit: 'PCS', rate: 85, taxRate: 12, cgst: 0, sgst: 0, igst: 1020, amount: 8500, taxAmount: 1020, costPrice: 45, profit: 4000 },
      { productId: products[2].id, description: 'PVC Wire 1.5mm 90m', hsnSac: '8544', quantity: 2, unit: 'ROLL', rate: 1250, taxRate: 18, cgst: 0, sgst: 0, igst: 450, amount: 2500, taxAmount: 450, costPrice: 850, profit: 800 },
      { productId: products[1].id, description: 'MCB 32A Single Pole', hsnSac: '8536', quantity: 5, unit: 'PCS', rate: 350, taxRate: 18, cgst: 0, sgst: 0, igst: 315, amount: 1750, taxAmount: 315, costPrice: 180, profit: 850 },
    ]}
  }});
  invoices.push(i2);

  // Invoice 3 — Metro Infra (intrastate Haryana, large order)
  const i3 = await prisma.invoice.create({ data: {
    invoiceNumber: 'PE/25-26/003', invoiceType: 'TAX_INVOICE', invoiceCopyType: 'ORIGINAL',
    customerId: customers[2].id, billingAddressId: inv3Addr, shippingAddressId: inv3Addr,
    invoiceDate: d(25), dueDate: d(5), placeOfSupply: 'Haryana', reverseCharge: false,
    subtotal: 50000, cgst: 4500, sgst: 4500, igst: 0, totalTax: 9000, total: 59000,
    paymentStatus: 'UNPAID', paidAmount: 0, balanceAmount: 59000, status: 'ISSUED',
    paymentTerms: 'NET_30', organisationId: ORG_ID,
    notes: 'For Site B electrical work',
    items: { create: [
      { productId: products[7].id, description: 'Wiring Installation Service', hsnSac: '995461', quantity: 5, unit: 'NOS', rate: 5000, taxRate: 18, cgst: 2250, sgst: 2250, igst: 0, amount: 25000, taxAmount: 4500, costPrice: 0, profit: 25000 },
      { productId: products[4].id, description: 'Distribution Board 8-way', hsnSac: '8537', quantity: 5, unit: 'PCS', rate: 1800, taxRate: 18, cgst: 810, sgst: 810, igst: 0, amount: 9000, taxAmount: 1620, costPrice: 1100, profit: 3500 },
      { productId: products[2].id, description: 'PVC Wire 1.5mm 90m', hsnSac: '8544', quantity: 8, unit: 'ROLL', rate: 1250, taxRate: 18, cgst: 900, sgst: 900, igst: 0, amount: 10000, taxAmount: 1800, costPrice: 850, profit: 3200 },
      { productId: products[1].id, description: 'MCB 32A Single Pole', hsnSac: '8536', quantity: 18, unit: 'PCS', rate: 333.33, taxRate: 18, cgst: 540, sgst: 540, igst: 0, amount: 6000, taxAmount: 1080, costPrice: 180, profit: 2760 },
    ]}
  }});
  invoices.push(i3);

  // Invoice 4 — Retail (no GST)
  const i4 = await prisma.invoice.create({ data: {
    invoiceNumber: 'PE/25-26/004', invoiceType: 'BILL_OF_SUPPLY', invoiceCopyType: 'ORIGINAL',
    customerId: customers[3].id, billingAddressId: inv4Addr, shippingAddressId: inv4Addr,
    invoiceDate: d(10), dueDate: d(0), placeOfSupply: 'Haryana', reverseCharge: false,
    subtotal: 1700, cgst: 153, sgst: 153, igst: 0, totalTax: 306, total: 2006,
    paymentStatus: 'PAID', paidAmount: 2006, balanceAmount: 0, status: 'ISSUED',
    paymentMethod: 'CASH', paymentTerms: 'IMMEDIATE', organisationId: ORG_ID,
    items: { create: [
      { productId: products[0].id, description: 'LED Bulb 9W', hsnSac: '8539', quantity: 10, unit: 'PCS', rate: 85, taxRate: 12, cgst: 51, sgst: 51, igst: 0, amount: 850, taxAmount: 102, costPrice: 45, profit: 400 },
      { productId: products[6].id, description: 'Exhaust Fan 6"', hsnSac: '8414', quantity: 1, unit: 'PCS', rate: 650, taxRate: 18, cgst: 58.5, sgst: 58.5, igst: 0, amount: 650, taxAmount: 117, costPrice: 400, profit: 250 },
      { productId: products[5].id, description: 'Switch Socket 5A', hsnSac: '8536', quantity: 2, unit: 'PCS', rate: 100, taxRate: 18, cgst: 18, sgst: 18, igst: 0, amount: 200, taxAmount: 36, costPrice: 55, profit: 90 },
    ]}
  }});
  invoices.push(i4);

  // Delivery Challan
  const i5 = await prisma.invoice.create({ data: {
    invoiceNumber: 'PE/DC/25-26/001', invoiceType: 'DELIVERY_CHALLAN', invoiceCopyType: 'ORIGINAL',
    customerId: customers[2].id, billingAddressId: inv3Addr, shippingAddressId: inv3Addr,
    invoiceDate: d(20), dueDate: d(20), placeOfSupply: 'Haryana', reverseCharge: false,
    subtotal: 14000, cgst: 1260, sgst: 1260, igst: 0, totalTax: 2520, total: 16520,
    paymentStatus: 'UNPAID', paidAmount: 0, balanceAmount: 16520, status: 'ISSUED',
    modeOfDelivery: 'TRANSPORT', transportName: 'Shree Transport', vehicleNumber: 'HR26AB1234',
    organisationId: ORG_ID,
    items: { create: [
      { productId: products[3].id, description: 'Ceiling Fan 48"', hsnSac: '8414', quantity: 5, unit: 'PCS', rate: 2800, taxRate: 18, cgst: 1260, sgst: 1260, igst: 0, amount: 14000, taxAmount: 2520, costPrice: 1800, profit: 5000 },
    ]}
  }});
  invoices.push(i5);
  console.log(`✅ ${invoices.length} invoices/challans created`);

  // ─── Purchase ────────────────────────────────────────────────────
  console.log('Creating purchase...');
  const purchase = await prisma.purchase.create({ data: {
    billNumber: 'PO/25-26/001', invoiceNumber: 'HAV/2025/4521',
    supplierId: supplier.id, purchaseDate: d(50), dueDate: d(20),
    paymentMode: 'NEFT', transportCharges: 500,
    subtotal: 45000, cgst: 0, sgst: 0, igst: 8100, totalTax: 8100, grandTotal: 53600,
    paymentStatus: 'PAID', paidAmount: 53600, status: 'FINALIZED',
    notes: 'Quarterly stock replenishment', organisationId: ORG_ID,
    items: { create: [
      { productId: products[0].id, description: 'LED Bulb 9W', hsnSac: '8539', quantity: 500, unit: 'PCS', rate: 45, discount: 0, taxRate: 12, cgst: 0, sgst: 0, igst: 2700, taxAmount: 2700, lineTotal: 25200 },
      { productId: products[1].id, description: 'MCB 32A Single Pole', hsnSac: '8536', quantity: 100, unit: 'PCS', rate: 180, discount: 0, taxRate: 18, cgst: 0, sgst: 0, igst: 3240, taxAmount: 3240, lineTotal: 21240 },
      { productId: products[5].id, description: 'Switch Socket 5A', hsnSac: '8536', quantity: 200, unit: 'PCS', rate: 55, discount: 0, taxRate: 18, cgst: 0, sgst: 0, igst: 1980, taxAmount: 1980, lineTotal: 12980 },
    ]}
  }});
  console.log('✅ Purchase created');

  // ─── Payments ────────────────────────────────────────────────────
  console.log('Creating payments...');
  await Promise.all([
    prisma.payment.create({ data: { organisationId: ORG_ID, customerId: customers[0].id, amount: 33040, type: 'RECEIVED', method: 'NEFT', reference: 'NEFT/2025/001', notes: 'Full payment received', date: d(30) } }),
    prisma.payment.create({ data: { organisationId: ORG_ID, customerId: customers[1].id, amount: 10000, type: 'RECEIVED', method: 'UPI', reference: 'UPI/rajesh/001', notes: 'Advance payment', date: d(25) } }),
    prisma.payment.create({ data: { organisationId: ORG_ID, customerId: customers[3].id, amount: 2006, type: 'RECEIVED', method: 'CASH', notes: 'Cash payment at counter', date: d(10) } }),
    prisma.payment.create({ data: { organisationId: ORG_ID, supplierId: supplier.id, amount: 53600, type: 'PAID', method: 'NEFT', reference: 'NEFT/HAV/001', notes: 'Payment to Havells', date: d(35) } }),
  ]);
  console.log('✅ Payments created');

  // ─── Credit Note ─────────────────────────────────────────────────
  console.log('Creating credit note...');
  await prisma.creditNote.create({ data: {
    noteNumber: 'PE/CN/25-26/001',
    invoiceId: i2.id, customerId: customers[1].id,
    issueDate: d(20), reason: 'Defective LED bulbs returned - 10 pcs',
    subtotal: 850, cgst: 0, sgst: 0, igst: 102, totalTax: 102, totalAmount: 952,
    status: 'ISSUED', organisationId: ORG_ID,
    items: { create: [
      { productId: products[0].id, description: 'LED Bulb 9W - Return', hsnSac: '8539', quantity: 10, unit: 'PCS', rate: 85, taxRate: 12, cgst: 0, sgst: 0, igst: 102, lineTotal: 952, taxAmount: 102 }
    ]}
  }});
  console.log('✅ Credit note created');

  // ─── Debit Note ──────────────────────────────────────────────────
  console.log('Creating debit note...');
  await prisma.debitNote.create({ data: {
    noteNumber: 'PE/DN/25-26/001',
    invoiceId: i3.id, customerId: customers[2].id,
    issueDate: d(15), reason: 'Additional material supplied on site',
    subtotal: 3200, cgst: 288, sgst: 288, igst: 0, totalTax: 576, totalAmount: 3776,
    status: 'ISSUED', organisationId: ORG_ID,
    items: { create: [
      { productId: products[5].id, description: 'Switch Socket 5A - Additional', hsnSac: '8536', quantity: 32, unit: 'PCS', rate: 100, taxRate: 18, cgst: 288, sgst: 288, igst: 0, lineTotal: 3776, taxAmount: 576 }
    ]}
  }});
  console.log('✅ Debit note created');

  // ─── Update org counter ───────────────────────────────────────────
  await prisma.organisation.update({ where: { id: ORG_ID }, data: { invoiceCounter: 6, challanCounter: 2, creditNoteCounter: 2, debitNoteCounter: 2 } });

  console.log('\n🎉 Seeding complete!');
  console.log('Summary:');
  console.log('  Products: 8');
  console.log('  Customers: 4');
  console.log('  Supplier: 1 (Havells India)');
  console.log('  Invoices: 4 (Tax Invoice) + 1 (Delivery Challan)');
  console.log('  Purchase: 1 (Finalized)');
  console.log('  Payments: 4 (3 received + 1 paid)');
  console.log('  Credit Note: 1');
  console.log('  Debit Note: 1');
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
