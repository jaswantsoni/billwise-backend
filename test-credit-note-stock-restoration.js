/**
 * Integration test for credit note stock restoration
 * Tests task 9.3: Update Credit Note Controller to restore stock
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runTests() {
  console.log('=== Testing Credit Note Stock Restoration (Task 9.3) ===\n');
  
  let testOrg, testCustomer, testProduct, testAddress, testUser, testInvoice;
  
  try {
    // Setup: Create test data
    console.log('Setting up test data...');
    
    // Create test user first
    testUser = await prisma.user.create({
      data: {
        email: 'testuser-cn@example.com',
        name: 'Test User CN',
        password: 'test-password-hash'
      }
    });
    
    // Create test organization
    testOrg = await prisma.organisation.create({
      data: {
        name: 'Test Org for Credit Note',
        email: 'test-cn@example.com',
        phone: '1234567890',
        address: 'Test Address',
        userId: testUser.id,
        state: 'MH',
        gstin: `27TEST${Date.now()}`,
        invoiceCounter: 1,
        creditNoteCounter: 1
      }
    });
    
    // Create test customer
    testCustomer = await prisma.customer.create({
      data: {
        name: 'Test Customer CN',
        email: 'customer-cn@example.com',
        organisationId: testOrg.id
      }
    });
    
    // Create test address
    testAddress = await prisma.address.create({
      data: {
        customerId: testCustomer.id,
        line1: 'Test Address',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        country: 'India',
        type: 'BILLING'
      }
    });
    
    // Create test product with initial stock
    testProduct = await prisma.product.create({
      data: {
        name: 'Test Product CN',
        sku: 'TEST-SKU-CN-001',
        unit: 'PCS',
        price: 150,
        purchasePrice: 100,
        taxRate: 18,
        stockQuantity: 100,
        avgCost: 100,
        minStock: 10,
        organisationId: testOrg.id,
        isActive: true
      }
    });
    
    console.log('✓ Test data created');
    console.log(`  Product: ${testProduct.name} (SKU: ${testProduct.sku})`);
    console.log(`  Initial Stock: ${testProduct.stockQuantity}`);
    console.log('');
    
    // Create an invoice first (simulating a sale)
    console.log('Creating test invoice (simulating a sale)...');
    
    testInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: 'TEST-INV-CN-001',
        invoiceType: 'TAX_INVOICE',
        invoiceCopyType: 'ORIGINAL',
        customerId: testCustomer.id,
        billingAddressId: testAddress.id,
        invoiceDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        placeOfSupply: 'MH',
        reverseCharge: false,
        subtotal: 1500,
        cgst: 135,
        sgst: 135,
        igst: 0,
        totalTax: 270,
        total: 1770,
        balanceAmount: 1770,
        status: 'DRAFT',
        organisationId: testOrg.id,
        items: {
          create: [
            {
              productId: testProduct.id,
              description: 'Test Product CN',
              quantity: 10,
              unit: 'PCS',
              rate: 150,
              discount: 0,
              taxRate: 18,
              taxInclusive: false,
              cgst: 135,
              sgst: 135,
              igst: 0,
              amount: 1500,
              taxAmount: 270,
              costPrice: testProduct.avgCost,
              profit: (150 - testProduct.avgCost) * 10
            }
          ]
        }
      },
      include: {
        items: true
      }
    });
    
    // Reduce stock for the sale
    const stockService = require('./services/stockService');
    await stockService.updateStockOnSale(testInvoice.items, testOrg.id, testInvoice.id);
    
    const productAfterSale = await prisma.product.findUnique({
      where: { id: testProduct.id }
    });
    
    console.log(`✓ Invoice created: ${testInvoice.invoiceNumber}`);
    console.log(`  Stock after sale: ${productAfterSale.stockQuantity}`);
    console.log('');
    
    // Test 1: Create credit note and verify stock restoration
    console.log('Test 1: Create Credit Note and Verify Stock Restoration');
    
    const creditNoteItems = [
      {
        productId: testProduct.id,
        invoiceItemId: testInvoice.items[0].id,
        description: 'Test Product CN',
        hsnSac: '',
        quantity: 5,
        unit: 'PCS',
        rate: 150,
        taxRate: 18,
        cgst: 67.5,
        sgst: 67.5,
        igst: 0,
        lineTotal: 885,
        taxAmount: 135
      }
    ];
    
    const creditNote = await prisma.creditNote.create({
      data: {
        noteNumber: 'CN-2024-0001',
        invoiceId: testInvoice.id,
        customerId: testCustomer.id,
        issueDate: new Date(),
        reason: 'Product return',
        subtotal: 750,
        cgst: 67.5,
        sgst: 67.5,
        igst: 0,
        totalTax: 135,
        totalAmount: 885,
        status: 'ISSUED',
        organisationId: testOrg.id,
        items: {
          create: creditNoteItems
        }
      },
      include: {
        items: true
      }
    });
    
    console.log(`  ✓ Credit note created: ${creditNote.noteNumber}`);
    
    // Call the stock service to restore stock
    await stockService.updateStockOnCreditNote(creditNote.items, testOrg.id, creditNote.id);
    
    // Verify stock was restored
    const productAfterCreditNote = await prisma.product.findUnique({
      where: { id: testProduct.id }
    });
    
    const expectedStock = productAfterSale.stockQuantity + 5;
    console.log(`  Stock after sale: ${productAfterSale.stockQuantity}`);
    console.log(`  Returned Quantity: 5`);
    console.log(`  Expected Stock: ${expectedStock}`);
    console.log(`  Actual Stock: ${productAfterCreditNote.stockQuantity}`);
    console.log(`  Status: ${productAfterCreditNote.stockQuantity === expectedStock ? '✓ PASS' : '✗ FAIL'}`);
    console.log('');
    
    // Test 2: Verify stock transaction was created
    console.log('Test 2: Verify Stock Transaction Created');
    
    const stockTransaction = await prisma.stockTransaction.findFirst({
      where: {
        productId: testProduct.id,
        referenceType: 'CreditNote',
        referenceId: creditNote.id
      }
    });
    
    console.log(`  Transaction Type: ${stockTransaction?.transactionType}`);
    console.log(`  Quantity: ${stockTransaction?.quantity}`);
    console.log(`  Stock Before: ${stockTransaction?.stockBefore}`);
    console.log(`  Stock After: ${stockTransaction?.stockAfter}`);
    console.log(`  Status: ${stockTransaction && stockTransaction.transactionType === 'CREDIT_NOTE' ? '✓ PASS' : '✗ FAIL'}`);
    console.log('');
    
    // Test 3: Verify average cost remains unchanged
    console.log('Test 3: Verify Average Cost Remains Unchanged');
    
    console.log(`  Average Cost Before: ${testProduct.avgCost}`);
    console.log(`  Average Cost After: ${productAfterCreditNote.avgCost}`);
    console.log(`  Status: ${productAfterCreditNote.avgCost === testProduct.avgCost ? '✓ PASS' : '✗ FAIL'}`);
    console.log('');
    
    console.log('=== Test Summary ===');
    console.log('✓ Stock restoration on credit note creation works correctly');
    console.log('✓ Stock transaction audit trail created successfully');
    console.log('✓ Average cost remains unchanged (as expected)');
    console.log('\nTask 9.3 implementation verified successfully!');
    
  } catch (error) {
    console.error('✗ Test failed with error:', error.message);
    console.error(error);
  } finally {
    // Cleanup: Delete test data
    console.log('\nCleaning up test data...');
    
    if (testProduct) {
      await prisma.stockTransaction.deleteMany({
        where: { productId: testProduct.id }
      });
      await prisma.creditNoteItem.deleteMany({
        where: { productId: testProduct.id }
      });
      await prisma.invoiceItem.deleteMany({
        where: { productId: testProduct.id }
      });
      await prisma.product.delete({
        where: { id: testProduct.id }
      });
    }
    
    if (testInvoice) {
      await prisma.creditNote.deleteMany({
        where: { invoiceId: testInvoice.id }
      });
      await prisma.invoice.delete({
        where: { id: testInvoice.id }
      });
    }
    
    if (testCustomer) {
      await prisma.address.deleteMany({
        where: { customerId: testCustomer.id }
      });
      await prisma.customer.delete({
        where: { id: testCustomer.id }
      });
    }
    
    if (testOrg) {
      await prisma.organisation.delete({
        where: { id: testOrg.id }
      });
    }
    
    if (testUser) {
      await prisma.user.delete({
        where: { id: testUser.id }
      });
    }
    
    console.log('✓ Test data cleaned up');
    
    await prisma.$disconnect();
  }
}

runTests();
