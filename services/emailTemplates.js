const fs = require('fs').promises;
const path = require('path');
const prisma = require('../config/prisma');

// Load template from file
async function loadTemplate(templateName) {
  const templatePath = path.join(__dirname, '../email-templates', `${templateName}.html`);
  return await fs.readFile(templatePath, 'utf-8');
}

// Replace variables in template
function replaceVariables(html, variables) {
  let result = html;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  }
  return result;
}

// Get template from database or file
async function getTemplate(templateName) {
  try {
    // Try to get from database first
    const dbTemplate = await prisma.emailTemplate.findUnique({
      where: { name: templateName },
    });
    
    if (dbTemplate && dbTemplate.isActive) {
      return {
        subject: dbTemplate.subject,
        html: dbTemplate.html,
        variables: dbTemplate.variables,
      };
    }
  } catch (error) {
    console.log('Database template not found, using file template');
  }
  
  // Fallback to file template
  const html = await loadTemplate(templateName);
  const defaultSubjects = {
    'invoice': 'Invoice {{invoice_no}} from {{company_name}}',
    'payment-received': 'Payment Received - Invoice {{invoice_no}}',
    'reminder': 'Payment Reminder - Invoice {{invoice_no}}',
    'credit-note': 'Credit Note {{credit_note_no}} from {{company_name}}',
    'purchase-order': 'Purchase Order {{po_no}} from {{company_name}}',
    'subscriptionExpiring': 'Your {{planTier}} Subscription Expires in {{daysRemaining}} Days',
  };
  
  return {
    subject: defaultSubjects[templateName] || 'Notification from {{company_name}}',
    html,
    variables: {},
  };
}

// Render template with variables
async function renderTemplate(templateName, variables) {
  const template = await getTemplate(templateName);
  
  return {
    subject: replaceVariables(template.subject, variables),
    html: replaceVariables(template.html, variables),
  };
}

// Seed default templates to database
async function seedTemplates() {
  const templates = [
    {
      name: 'invoice',
      subject: 'Invoice {{invoice_no}} from {{company_name}}',
      description: 'Invoice email template',
      variables: {
        customer_name: 'Customer name',
        company_name: 'Company name',
        invoice_no: 'Invoice number',
        invoice_date: 'Invoice date',
        due_date: 'Due date',
        amount: 'Total amount',
        invoice_link: 'Link to view invoice',
      },
    },
    {
      name: 'payment-received',
      subject: 'Payment Received - Invoice {{invoice_no}}',
      description: 'Payment confirmation email',
      variables: {
        customer_name: 'Customer name',
        company_name: 'Company name',
        invoice_no: 'Invoice number',
        payment_date: 'Payment date',
        payment_method: 'Payment method',
        amount: 'Amount paid',
        receipt_link: 'Link to download receipt',
      },
    },
    {
      name: 'reminder',
      subject: 'Payment Reminder - Invoice {{invoice_no}}',
      description: 'Payment reminder email',
      variables: {
        customer_name: 'Customer name',
        company_name: 'Company name',
        invoice_no: 'Invoice number',
        invoice_date: 'Invoice date',
        due_date: 'Due date',
        amount: 'Amount due',
        overdue_status: 'due soon/overdue',
        payment_link: 'Payment link',
        invoice_link: 'Invoice link',
      },
    },
    {
      name: 'credit-note',
      subject: 'Credit Note {{credit_note_no}} from {{company_name}}',
      description: 'Credit note email',
      variables: {
        customer_name: 'Customer name',
        company_name: 'Company name',
        credit_note_no: 'Credit note number',
        invoice_no: 'Original invoice number',
        credit_note_date: 'Credit note date',
        reason: 'Reason for credit',
        amount: 'Credit amount',
        credit_note_link: 'Link to view credit note',
      },
    },
    {
      name: 'purchase-order',
      subject: 'Purchase Order {{po_no}} from {{company_name}}',
      description: 'Purchase order email',
      variables: {
        vendor_name: 'Vendor name',
        company_name: 'Company name',
        po_no: 'PO number',
        po_date: 'PO date',
        delivery_date: 'Expected delivery date',
        delivery_address: 'Delivery address',
        amount: 'Total amount',
        po_link: 'Link to view PO',
      },
    },
  ];

  for (const template of templates) {
    const html = await loadTemplate(template.name);
    
    await prisma.emailTemplate.upsert({
      where: { name: template.name },
      update: {
        subject: template.subject,
        html,
        variables: template.variables,
        description: template.description,
      },
      create: {
        name: template.name,
        subject: template.subject,
        html,
        variables: template.variables,
        description: template.description,
      },
    });
  }
  
  console.log('Email templates seeded successfully');
}

module.exports = {
  loadTemplate,
  replaceVariables,
  getTemplate,
  renderTemplate,
  seedTemplates,
};
