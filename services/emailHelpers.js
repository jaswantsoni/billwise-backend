const { sendTemplateEmail, sendEmail } = require('../services/emailService');

// Example: Send welcome email
async function sendWelcomeEmail(user) {
  await sendTemplateEmail(user.email, 'welcome', {
    name: user.name,
  });
}

// Example: Send email verification
async function sendVerificationEmail(user, verificationCode) {
  await sendTemplateEmail(user.email, 'emailVerification', {
    name: user.name,
    verificationLink: `${process.env.FRONTEND_URL}/verify?code=${verificationCode}`,
    code: verificationCode,
  });
}

// Example: Send payment reminder
async function sendPaymentReminderEmail(invoice, customer, organisation) {
  await sendTemplateEmail(customer.email, 'paymentReminder', {
    customerName: customer.name,
    invoiceNumber: invoice.invoiceNumber,
    amount: invoice.total,
    dueDate: new Date(invoice.dueDate).toLocaleDateString(),
    organisationName: organisation.name,
  });
}

// Example: Send inventory update
async function sendInventoryAlert(user, product) {
  await sendTemplateEmail(user.email, 'inventoryUpdate', {
    name: user.name,
    message: 'Low stock alert',
    productName: product.name,
    currentStock: product.stock,
    threshold: product.minStock,
  });
}

// Example: Send invoice with PDF
async function sendInvoiceEmail(invoice, customer, organisation, pdfBuffer, pdfLink) {
  await sendTemplateEmail(customer.email, 'invoiceShare', {
    customerName: customer.name,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: new Date(invoice.invoiceDate).toLocaleDateString(),
    dueDate: new Date(invoice.dueDate).toLocaleDateString(),
    total: invoice.total,
    organisationName: organisation.name,
    organisationEmail: organisation.email,
    organisationPhone: organisation.phone,
    pdfLink: pdfLink,
    items: invoice.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
    })),
    attachments: pdfBuffer ? [{
      filename: `Invoice-${invoice.invoiceNumber}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }] : [],
  });
}

// Send subscription expiry reminder
async function sendSubscriptionExpiryReminder(user) {
  const daysRemaining = Math.ceil((new Date(user.planExpiry) - new Date()) / (1000 * 60 * 60 * 24));
  await sendTemplateEmail(user.email, 'subscriptionExpiring', {
    name: user.name,
    planTier: user.planTier.charAt(0).toUpperCase() + user.planTier.slice(1),
    daysRemaining,
    expiryDate: new Date(user.planExpiry).toLocaleDateString(),
    renewLink: `${process.env.FRONTEND_URL}/pricing`,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPaymentReminderEmail,
  sendInventoryAlert,
  sendInvoiceEmail,
  sendSubscriptionExpiryReminder,
};
