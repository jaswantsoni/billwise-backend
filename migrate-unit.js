const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateInvoiceItems() {
  try {
    // This will update all invoice items in MongoDB
    const result = await prisma.$runCommandRaw({
      update: 'InvoiceItem',
      updates: [
        {
          q: { unit: null },
          u: { $set: { unit: 'PCS' } },
          multi: true
        }
      ]
    });
    
    console.log('Updated invoice items:', result);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateInvoiceItems();
