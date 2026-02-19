const { seedTemplates } = require('../services/emailTemplates');

async function main() {
  try {
    console.log('Seeding email templates...');
    await seedTemplates();
    console.log('✅ Email templates seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    process.exit(1);
  }
}

main();
