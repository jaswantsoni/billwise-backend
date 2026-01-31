const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateInvoiceItemsFromProducts() {
  try {
    const items = await prisma.invoiceItem.findMany({
      include: { product: true }
    });
    
    let updated = 0;
    for (const item of items) {
      if (item.product && item.product.unit) {
        await prisma.invoiceItem.update({
          where: { id: item.id },
          data: { unit: item.product.unit }
        });
        updated++;
      }
    }
    
    console.log(`Updated ${updated} invoice items with product units`);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateInvoiceItemsFromProducts();
