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

// Send OTP for password reset
async function sendOTPEmail(email, otp) {
  await sendEmail({
    to: email,
    subject: 'Password Reset OTP - Kampony',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Your OTP for password reset is:</p>
        <h1 style="background: #0077B6; color: white; padding: 20px; text-align: center; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
  });
}

// Follow-up email after trial/signup
async function sendFollowUpEmail(user, daysAfterSignup) {
  await sendEmail({
    to: user.email,
    subject: `How's your experience with Kampony?`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Hi ${user.name},</h2>
        <p>You've been using Kampony for ${daysAfterSignup} days now. We'd love to hear how it's going!</p>
        <p>Need help with:</p>
        <ul>
          <li>Creating GST invoices?</li>
          <li>Managing inventory?</li>
          <li>Setting up integrations?</li>
        </ul>
        <p>Reply to this email or call us at +91 85277 16732</p>
        <p>Best regards,<br/>Team Kampony</p>
      </div>
    `,
  });
}

// Subscription offer email
async function sendSubscriptionOfferEmail(user, offerDetails) {
  await sendEmail({
    to: user.email,
    subject: `Special Offer: ${offerDetails.discount}% OFF on ${offerDetails.plan} Plan`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Exclusive Offer for You, ${user.name}!</h2>
        <p>Get <strong>${offerDetails.discount}% OFF</strong> on our ${offerDetails.plan} plan.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3>Plan: ${offerDetails.plan}</h3>
          <p>Original Price: ₹${offerDetails.originalPrice}</p>
          <p style="color: #0077B6; font-size: 24px; font-weight: bold;">Offer Price: ₹${offerDetails.offerPrice}</p>
          <p>Valid until: ${offerDetails.validUntil}</p>
        </div>
        <a href="${process.env.FRONTEND_URL}/subscription" style="background: #0077B6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Claim Offer</a>
      </div>
    `,
  });
}

// Subscription confirmation email
async function sendSubscriptionConfirmationEmail(user, subscription) {
  await sendEmail({
    to: user.email,
    subject: 'Subscription Activated - Kampony',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to ${subscription.tier} Plan!</h2>
        <p>Hi ${user.name},</p>
        <p>Your subscription has been successfully activated.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3>Subscription Details</h3>
          <p><strong>Plan:</strong> ${subscription.tier}</p>
          <p><strong>Billing:</strong> ${subscription.interval}</p>
          <p><strong>Amount:</strong> ₹${subscription.amount}</p>
          <p><strong>Start Date:</strong> ${new Date(subscription.startDate).toLocaleDateString()}</p>
          <p><strong>Next Billing:</strong> ${new Date(subscription.endDate).toLocaleDateString()}</p>
          <p><strong>Payment ID:</strong> ${subscription.paymentId}</p>
        </div>
        <p>You now have access to all premium features!</p>
        <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #0077B6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Go to Dashboard</a>
      </div>
    `,
  });
}

// Subscription status update email
async function sendSubscriptionStatusEmail(user, status, details) {
  const statusMessages = {
    renewed: { subject: 'Subscription Renewed', message: 'Your subscription has been renewed successfully.' },
    expired: { subject: 'Subscription Expired', message: 'Your subscription has expired. Renew now to continue using premium features.' },
    cancelled: { subject: 'Subscription Cancelled', message: 'Your subscription has been cancelled as requested.' },
    payment_failed: { subject: 'Payment Failed', message: 'We couldn\'t process your payment. Please update your payment method.' },
  };

  const { subject, message } = statusMessages[status];

  await sendEmail({
    to: user.email,
    subject: `${subject} - Kampony`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${subject}</h2>
        <p>Hi ${user.name},</p>
        <p>${message}</p>
        ${details ? `<div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>Plan:</strong> ${details.tier}</p>
          <p><strong>Status:</strong> ${details.status}</p>
          ${details.endDate ? `<p><strong>Valid Until:</strong> ${new Date(details.endDate).toLocaleDateString()}</p>` : ''}
        </div>` : ''}
        <a href="${process.env.FRONTEND_URL}/subscription" style="background: #0077B6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Manage Subscription</a>
      </div>
    `,
  });
}

module.exports = {
  sendWelcomeEmail,
  sendVerificationEmail,
  sendPaymentReminderEmail,
  sendInventoryAlert,
  sendInvoiceEmail,
  sendSubscriptionExpiryReminder,
  sendOTPEmail,
  sendFollowUpEmail,
  sendSubscriptionOfferEmail,
  sendSubscriptionConfirmationEmail,
  sendSubscriptionStatusEmail,
};
