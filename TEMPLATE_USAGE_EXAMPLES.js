const { renderTemplate } = require('./services/emailTemplates');
const { sendEmail } = require('./controllers/gmailController');

// Example 1: Send Invoice Email
async function sendInvoiceEmail(userId, invoiceData) {
  const { subject, html } = await renderTemplate('invoice', {
    customer_name: invoiceData.customerName,
    company_name: invoiceData.companyName,
    invoice_no: invoiceData.invoiceNumber,
    invoice_date: invoiceData.invoiceDate,
    due_date: invoiceData.dueDate,
    amount: invoiceData.total.toFixed(2),
    invoice_link: `${process.env.FRONTEND_URL}/invoices/${invoiceData.id}`,
  });

  await sendEmail(userId, {
    to: invoiceData.customerEmail,
    subject,
    html,
  });
}

// Example 2: Send Payment Received Email
async function sendPaymentReceivedEmail(userId, paymentData) {
  const { subject, html } = await renderTemplate('payment-received', {
    customer_name: paymentData.customerName,
    company_name: paymentData.companyName,
    invoice_no: paymentData.invoiceNumber,
    payment_date: paymentData.paymentDate,
    payment_method: paymentData.paymentMethod,
    amount: paymentData.amount.toFixed(2),
    receipt_link: `${process.env.FRONTEND_URL}/receipts/${paymentData.id}`,
  });

  await sendEmail(userId, {
    to: paymentData.customerEmail,
    subject,
    html,
  });
}

// Example 3: Send Payment Reminder
async function sendPaymentReminder(userId, reminderData) {
  const { subject, html } = await renderTemplate('reminder', {
    customer_name: reminderData.customerName,
    company_name: reminderData.companyName,
    invoice_no: reminderData.invoiceNumber,
    invoice_date: reminderData.invoiceDate,
    due_date: reminderData.dueDate,
    amount: reminderData.amount.toFixed(2),
    overdue_status: reminderData.isOverdue ? 'overdue' : 'due soon',
    payment_link: `${process.env.FRONTEND_URL}/pay/${reminderData.invoiceId}`,
    invoice_link: `${process.env.FRONTEND_URL}/invoices/${reminderData.invoiceId}`,
  });

  await sendEmail(userId, {
    to: reminderData.customerEmail,
    subject,
    html,
  });
}

// Example 4: Send Credit Note Email
async function sendCreditNoteEmail(userId, creditNoteData) {
  const { subject, html } = await renderTemplate('credit-note', {
    customer_name: creditNoteData.customerName,
    company_name: creditNoteData.companyName,
    credit_note_no: creditNoteData.noteNumber,
    invoice_no: creditNoteData.invoiceNumber,
    credit_note_date: creditNoteData.issueDate,
    reason: creditNoteData.reason,
    amount: creditNoteData.totalAmount.toFixed(2),
    credit_note_link: `${process.env.FRONTEND_URL}/credit-notes/${creditNoteData.id}`,
  });

  await sendEmail(userId, {
    to: creditNoteData.customerEmail,
    subject,
    html,
  });
}

// Example 5: Send Purchase Order Email
async function sendPurchaseOrderEmail(userId, poData) {
  const { subject, html } = await renderTemplate('purchase-order', {
    vendor_name: poData.vendorName,
    company_name: poData.companyName,
    po_no: poData.poNumber,
    po_date: poData.poDate,
    delivery_date: poData.deliveryDate,
    delivery_address: poData.deliveryAddress,
    amount: poData.total.toFixed(2),
    po_link: `${process.env.FRONTEND_URL}/purchase-orders/${poData.id}`,
  });

  await sendEmail(userId, {
    to: poData.vendorEmail,
    subject,
    html,
  });
}

module.exports = {
  sendInvoiceEmail,
  sendPaymentReceivedEmail,
  sendPaymentReminder,
  sendCreditNoteEmail,
  sendPurchaseOrderEmail,
};
